# Technical Specification: Warehouse Receiving System

| Item | Detail |
|---|---|
| Version | 1.0 |
| Date | 25 October 2026 |
| Derived from | docs/prd.md (v1.1), docs/openapi.yaml (v1.0.0) |
| Related artifacts | docs/erd.mmd, docs/design.md (Phase 7A), docs/testing.md, docs/ai-workflow.md |

Where this document and the PRD disagree, the PRD wins and this document must be corrected. Where this document and openapi.yaml disagree on a path, method, field or status code, openapi.yaml wins. Section 16 lists the places where openapi.yaml needs a small addition.

---

## 1. Technology Decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router), TypeScript, Node.js 22 LTS | One codebase for UI and REST route handlers. The assessment allows it. |
| Database | PostgreSQL 16 | Relational integrity, row locks, CHECK constraints, partial unique indexes. |
| Database access | node-postgres (`pg`) with parameterized SQL | Explicit SQL makes locking and transaction boundaries visible for review. |
| Migrations | node-pg-migrate | SQL-first migrations, tracked in the `pgmigrations` table, safe to re-run. |
| Validation | zod | One schema per request body and query, shared by route handlers and tests. |
| Password hashing | bcryptjs | Pure JavaScript, no native build step in Docker. Cost factor 12. |
| UI | Tailwind CSS, shadcn/ui, lucide-react, Inter via next/font | Matches docs/design.md. |
| Unit and integration tests | Vitest | Fast, TypeScript-native. Integration tests run against real PostgreSQL. |
| End-to-end test | Playwright | One test covering the main receiving workflow with two roles. |
| Packaging | Docker, Docker Compose | Required by the assessment. |

Libraries beyond the prompt's stack (zod, node-pg-migrate) are recorded here so that the review can challenge them.

---

## 2. System Architecture

### 2.1 Components

```mermaid
flowchart LR
    Browser["Browser (React UI)"]
    Routes["Route Handlers under app/api"]
    Services["Service layer (business rules, transactions)"]
    Repos["Repositories (parameterized SQL)"]
    DB[("PostgreSQL")]
    Migrate["Migration job (node-pg-migrate)"]
    Seed["Seed script (one Operator, one Supervisor)"]

    Browser -->|"fetch /api, JSON, session cookie"| Routes
    Routes --> Services
    Services --> Repos
    Repos --> DB
    Migrate --> DB
    Seed --> DB
```

| Component | Responsibility | Must not |
|---|---|---|
| UI (client components) | Renders screens, collects input, calls /api, shows errors from the API. | Access the database. Decide business rules. |
| Route handlers | Parse and validate input with zod, check session and role, call one service function, map errors to the Error schema. | Contain business rules or SQL. |
| Service layer | Enforces every rule in PRD sections 6 and 7. Owns transaction boundaries and lock order. Writes audit rows. | Know about HTTP. |
| Repositories | Execute parameterized SQL on a given transaction client. | Make decisions. |
| Migration job | Applies pending migrations once, then exits with code 0 or 1. | Run on every request. |
| Seed script | Creates or updates the two seed users from environment variables. | Create users when the variables are missing. |

### 2.2 Folder structure

```
app/
  (auth)/login/page.tsx
  (app)/layout.tsx                  sidebar and header shell
  (app)/page.tsx                    dashboard
  (app)/products/page.tsx
  (app)/receiving-documents/page.tsx
  (app)/receiving-documents/new/page.tsx
  (app)/receiving-documents/[id]/page.tsx
  (app)/inventory/page.tsx
  (app)/transactions/page.tsx
  (app)/users/page.tsx
  api/                              route handlers mirroring openapi.yaml paths
  api/health/live/route.ts
  api/health/ready/route.ts
components/                         shared UI (shell, badges, tables, toast)
components/ui/                      shadcn/ui primitives
src/
  server/
    db/pool.ts                      pg Pool from DATABASE_URL
    db/tx.ts                        withTransaction helper
    auth/session.ts                 create, validate, revoke sessions
    auth/guard.ts                   requireRole helper
    errors.ts                       AppError and error codes
    services/                       one file per aggregate
    repositories/                   SQL by table
    http/respond.ts                 Error schema mapping
  lib/
    api-client.ts                   typed fetch wrapper used by UI
    validation/                     zod schemas shared with tests
    format.ts                       dates in APP_TIMEZONE, numbers
migrations/                         node-pg-migrate files, timestamp-prefixed
scripts/
  migrate.ts
  seed.ts
tests/
  unit/
  integration/
  concurrency/
  e2e/
docs/
```

### 2.3 Request lifecycle

1. The request enters a route handler.
2. The handler reads the session cookie and loads the user (section 5).
3. The handler checks the role for the endpoint (section 5.3).
4. The handler validates the body and query with zod. Failures return 400 VALIDATION_ERROR with the field name.
5. The handler calls one service function with the user and the parsed input.
6. The service runs the rules and, when it writes, opens a database transaction.
7. The handler returns the JSON result or maps the thrown `AppError` to the Error schema.
8. The response carries `X-Request-Id`. The same id appears in every log line for the request.

---

## 3. Database Design

The ERD is in docs/erd.mmd. This section gives the column-level detail that the ERD omits.

Conventions:
- Primary keys are `uuid` generated with `gen_random_uuid()`, except `audit_logs` (`bigint identity`) and `document_number_counters` (natural key `year`).
- All timestamps are `timestamptz`, stored in UTC.
- Every table has `created_at` with default `now()`. Mutable tables also have `updated_at`.
- Enumerations are stored as `varchar` with a CHECK constraint, which keeps migrations simple. The allowed values match openapi.yaml exactly.
- Monetary values do not exist in v1, so no numeric money types are needed.

### 3.1 Table definitions

**users**

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | uuid | no | PK |
| username | varchar(50) | no | UNIQUE; CHECK `username ~ '^[a-z0-9._-]{3,50}$'` |
| full_name | varchar(120) | no | CHECK length >= 1 |
| role | varchar(20) | no | CHECK in ('OPERATOR','SUPERVISOR') |
| password_hash | text | no | bcrypt hash |
| is_active | boolean | no | default true |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

Index: `users_role_active_idx (role, is_active)` for the last-supervisor check.

**sessions**

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | varchar(64) | no | PK; SHA-256 hex of the cookie token. The raw token is never stored. |
| user_id | uuid | no | FK users(id) ON DELETE CASCADE |
| created_at | timestamptz | no | default now() |
| expires_at | timestamptz | no | |

Indexes: `sessions_user_id_idx (user_id)`, `sessions_expires_at_idx (expires_at)`.

**products**

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | uuid | no | PK |
| sku | varchar(32) | no | UNIQUE; CHECK `sku = upper(sku)`; CHECK `sku ~ '^[A-Z0-9][A-Z0-9._-]*$'` |
| name | varchar(150) | no | CHECK length >= 1 |
| base_unit | varchar(20) | no | default 'pcs' |
| is_active | boolean | no | default true |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

Index: `products_is_active_idx (is_active)`. Search on SKU and name uses `ILIKE` over at most 1,000 products, which meets NFR-03 without a trigram index. Add one only if the performance test fails.

**receiving_documents**

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | uuid | no | PK |
| document_number | varchar(16) | no | UNIQUE; CHECK `document_number ~ '^RD-[0-9]{4}-[0-9]{6}$'` |
| status | varchar(24) | no | CHECK in ('DRAFT','OPEN','PARTIALLY_RECEIVED','COMPLETED','CANCELLED') |
| supplier_name | varchar(150) | no | CHECK length >= 1 |
| supplier_key | varchar(150) | no | `lower(btrim(supplier_name))`, set by the service |
| reference_number | varchar(60) | yes | |
| expected_arrival_date | date | yes | |
| notes | varchar(1000) | yes | |
| created_by | uuid | no | FK users(id) ON DELETE RESTRICT |
| submitted_at | timestamptz | yes | |
| completed_at | timestamptz | yes | |
| cancelled_at | timestamptz | yes | |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

Indexes:
- `receiving_documents_supplier_ref_uq` UNIQUE (supplier_key, reference_number) WHERE reference_number IS NOT NULL. Implements BR-14.
- `receiving_documents_status_created_idx (status, created_at DESC)` for list filters.
- `receiving_documents_created_idx (created_at DESC)` for date filters.
- `receiving_documents_expected_idx (expected_arrival_date)`.

**document_number_counters**

| Column | Type | Null | Constraints |
|---|---|---|---|
| year | integer | no | PK |
| last_value | integer | no | default 0 |

Generating a number runs in the creating transaction:

```sql
INSERT INTO document_number_counters (year, last_value)
VALUES ($1, 1)
ON CONFLICT (year) DO UPDATE SET last_value = document_number_counters.last_value + 1
RETURNING last_value;
```

The row lock taken by the upsert makes the number unique and sequential per year. If the creating transaction rolls back, the counter rolls back with it, so no committed document ever shows a skipped number that could be reused. Numbers may have gaps only if a transaction is rolled back after the upsert, which is acceptable under BR-15.

**receiving_lines**

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | uuid | no | PK |
| document_id | uuid | no | FK receiving_documents(id) ON DELETE RESTRICT |
| product_id | uuid | no | FK products(id) ON DELETE RESTRICT |
| expected_qty | integer | no | CHECK `expected_qty BETWEEN 1 AND 1000000` (BR-02) |
| received_qty | integer | no | default 0; CHECK `received_qty >= 0`; CHECK `received_qty <= expected_qty` (BR-04) |
| created_at | timestamptz | no | default now() |
| updated_at | timestamptz | no | default now() |

Constraints and indexes:
- UNIQUE (document_id, product_id). Implements BR-11.
- Index `receiving_lines_product_idx (product_id)`.
- `received_qty` is a cached sum of `receipts.received_qty` for the line. The service keeps it equal to that sum inside the same transaction. The consistency test checks this (section 13.5).

**receipts** (append-only)

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | uuid | no | PK |
| batch_id | uuid | no | Groups the receipts of one request |
| document_id | uuid | no | FK receiving_documents(id) ON DELETE RESTRICT |
| line_id | uuid | no | FK receiving_lines(id) ON DELETE RESTRICT |
| received_qty | integer | no | CHECK `received_qty >= 1` (BR-03) |
| note | varchar(255) | yes | |
| received_at | timestamptz | no | From the request body |
| recorded_by | uuid | no | FK users(id) ON DELETE RESTRICT |
| recorded_at | timestamptz | no | default now() |

Indexes: `receipts_line_idx (line_id)`, `receipts_document_recorded_idx (document_id, recorded_at DESC)`, `receipts_batch_idx (batch_id)`.

Append-only enforcement: a trigger `receipts_no_mutation` raises an exception on UPDATE or DELETE (BR-13). This trigger is required, not optional.

**inventory_transactions** (append-only)

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | uuid | no | PK |
| type | varchar(20) | no | CHECK in ('RECEIPT') |
| product_id | uuid | no | FK products(id) ON DELETE RESTRICT |
| quantity | integer | no | CHECK `quantity > 0` for RECEIPT |
| document_id | uuid | no | FK receiving_documents(id) ON DELETE RESTRICT |
| line_id | uuid | no | FK receiving_lines(id) ON DELETE RESTRICT |
| receipt_id | uuid | yes | UNIQUE; FK receipts(id) ON DELETE RESTRICT; required when type = RECEIPT |
| created_by | uuid | no | FK users(id) ON DELETE RESTRICT |
| created_at | timestamptz | no | default now() |

Indexes: `inv_tx_product_created_idx (product_id, created_at DESC)`, `inv_tx_created_idx (created_at DESC, id DESC)`, `inv_tx_document_idx (document_id)`.

Append-only enforcement: trigger `inventory_transactions_no_mutation`, same as receipts.

**idempotency_keys**

| Column | Type | Null | Constraints |
|---|---|---|---|
| user_id | uuid | no | FK users(id) ON DELETE CASCADE |
| key | varchar(64) | no | PK (user_id, key) |
| request_hash | char(64) | no | SHA-256 of the canonical request body |
| response_status | integer | no | Status code of the original response (201) |
| response_body | jsonb | no | Original response body, returned on replay |
| created_at | timestamptz | no | default now() |

A key is scoped to the user who sent it. Keys are kept for 7 days. A cleanup job is not part of v1 (section 15).

**audit_logs** (append-only)

| Column | Type | Null | Constraints |
|---|---|---|---|
| id | bigint | no | identity PK |
| request_id | varchar(64) | yes | |
| actor_id | uuid | yes | FK users(id) ON DELETE SET NULL |
| action | varchar(60) | no | for example `product.create`, `receipt.record`, `document.complete` |
| entity_type | varchar(40) | no | |
| entity_id | uuid | yes | |
| before_data | jsonb | yes | |
| after_data | jsonb | yes | |
| created_at | timestamptz | no | default now() |

Indexes: `audit_entity_idx (entity_type, entity_id)`, `audit_created_idx (created_at DESC)`. Append-only trigger as above. Audit rows are written inside the same transaction as the change they describe (FR-21).

### 3.2 Inventory calculation

On-hand quantity is never stored. It is always computed:

```sql
SELECT p.id, p.sku, p.name, p.base_unit, p.is_active,
       COALESCE(SUM(t.quantity), 0)::int AS on_hand_qty,
       MAX(t.created_at) AS last_movement_at
FROM products p
LEFT JOIN inventory_transactions t ON t.product_id = p.id AND t.type = 'RECEIPT'
GROUP BY p.id
ORDER BY p.sku
LIMIT $1 OFFSET $2;
```

`availableQty` in the API equals `onHandQty` (A-05). Computing the sum at read time keeps a single source of truth, and NFR-03 is met by the `(product_id, created_at)` index.

### 3.3 Migration strategy

- One migration file per logical change, named `YYYYMMDDHHMM_description.ts`, in the `migrations/` folder.
- Order: `users` and `sessions`; `products`; `document_number_counters`; `receiving_documents`; `receiving_lines`; `receipts`; `inventory_transactions`; `idempotency_keys`; `audit_logs`; triggers for append-only tables.
- `npm run db:migrate` runs `node-pg-migrate up`. Re-running it when nothing is pending is a no-op, which satisfies NFR-06.
- Migrations never edit a file that has already been applied. Changes are new migrations.
- The Compose file runs migrations in a one-shot service `migrate` that the app waits for. The app also refuses readiness while migrations are pending (section 10.4).
- Down migrations exist for local development only and are not used in deployment.

---

## 4. Configuration

All configuration comes from environment variables. `.env.example` lists every variable, and the application validates them at startup with zod. Missing or invalid values stop the process with a clear message.

| Variable | Example | Required | Purpose |
|---|---|---|---|
| NODE_ENV | production | yes | Standard Node setting. |
| PORT | 3000 | no | HTTP port. Default 3000. |
| DATABASE_URL | postgres://app:change-me@db:5432/warehouse | yes | PostgreSQL connection string. |
| TEST_DATABASE_URL | postgres://app:change-me@localhost:5432/warehouse_test | tests only | Separate database for integration tests. |
| APP_TIMEZONE | Asia/Jakarta | yes | Display timezone and the boundary for "today". |
| SESSION_TTL_HOURS | 8 | no | Session lifetime. Default 8. |
| SEED_OPERATOR_USERNAME | operator | yes for seed | Username of the seeded Operator. |
| SEED_OPERATOR_PASSWORD | (set locally) | yes for seed | Password of the seeded Operator. Never committed. |
| SEED_SUPERVISOR_USERNAME | supervisor | yes for seed | Username of the seeded Supervisor. |
| SEED_SUPERVISOR_PASSWORD | (set locally) | yes for seed | Password of the seeded Supervisor. Never committed. |
| LOG_LEVEL | info | no | `debug`, `info`, `warn` or `error`. Default info. |
| POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | | yes for Compose | Used by the `db` service. |

Rules:
- `.env` is in `.gitignore`. `.env.example` contains placeholder values only.
- Passwords are never logged.
- The seed script refuses to run when `NODE_ENV=production` and a seed password is shorter than 12 characters.

---

## 5. Authentication and Authorization

### 5.1 Login

1. `POST /auth/login` receives `username` and `password`.
2. The service loads the user by `username` (lowercased). If the user is missing or inactive, it still runs a bcrypt compare against a dummy hash, so the response time does not reveal which usernames exist.
3. On success, it generates 32 random bytes, encodes them as base64url for the cookie, stores `sha256(token)` in `sessions`, and sets:
   `Set-Cookie: session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=<SESSION_TTL_HOURS * 3600>; Secure` (Secure is set when `NODE_ENV=production`).
4. On failure, it returns 401 INVALID_CREDENTIALS. The message does not say which field is wrong.

### 5.2 Session check

Every protected request hashes the cookie token and reads the session row. A row is valid when `expires_at > now()` and the user is active. Logout deletes the row and clears the cookie.

### 5.3 Role guard

`requireRole(user, allowed)` throws FORBIDDEN (403) when the role is not in `allowed`. Every write endpoint calls it first. The table below is the complete permission map for the API. It matches PRD section 8.

| Endpoint | Method | OPERATOR | SUPERVISOR | Notes |
|---|---|---|---|---|
| /auth/login | POST | public | public | |
| /auth/logout | POST | yes | yes | |
| /auth/me | GET | yes | yes | |
| /products | GET | yes | yes | |
| /products | POST | no | yes | |
| /products/{id} | GET | yes | yes | |
| /products/{id} | PATCH | no | yes | |
| /products/{id}/deactivate | POST | no | yes | |
| /receiving-documents | GET | yes | yes | |
| /receiving-documents | POST | yes | yes | |
| /receiving-documents/{id} | GET | yes | yes | |
| /receiving-documents/{id} | PATCH | DRAFT only | yes | Supervisor may change notes in OPEN or PARTIALLY_RECEIVED. |
| /receiving-documents/{id}/lines | POST | DRAFT only | yes | |
| /receiving-documents/{id}/lines/{lineId} | PATCH | DRAFT only | yes | Outside DRAFT, Supervisor only. |
| /receiving-documents/{id}/lines/{lineId} | DELETE | DRAFT only | yes | |
| /receiving-documents/{id}/submit | POST | yes | yes | |
| /receiving-documents/{id}/complete | POST | no | yes | |
| /receiving-documents/{id}/cancel | POST | no | yes | |
| /receiving-documents/{id}/receipts | POST | yes | yes | |
| /inventory | GET | yes | yes | |
| /transactions | GET | yes | yes | |
| /users | GET | no | yes | |
| /users | POST | no | yes | |
| /users/{id} | PATCH | no | yes | |
| /health/live | GET | public | public | |
| /health/ready | GET | public | public | Returns no user data. |

"DRAFT only" means the Operator gets 403 FORBIDDEN when the document is not in DRAFT, even if the status would otherwise reject the request with 409. The check order is: authentication, role, document state, then field rules.

### 5.4 Request forgery

Session cookies use `SameSite=Lax`, and all state-changing endpoints accept `application/json` bodies only. In addition, the route handler rejects any POST, PATCH or DELETE whose `Origin` header is present and differs from the application origin, with 403 FORBIDDEN. Requests without an `Origin` header (for example from curl in tests) are allowed, because the cookie still requires a valid session.

---

## 6. Receiving Document State Machine

### 6.1 States

```mermaid
stateDiagram-v2
    [*] --> DRAFT: create
    DRAFT --> OPEN: submit (at least one line)
    DRAFT --> CANCELLED: cancel (Supervisor)
    OPEN --> PARTIALLY_RECEIVED: first receipt
    OPEN --> CANCELLED: cancel (Supervisor, no receipts)
    PARTIALLY_RECEIVED --> COMPLETED: complete (Supervisor, all lines full)
    COMPLETED --> [*]
    CANCELLED --> [*]
```

### 6.2 Transition rules

| From | To | Action | Guard | Error if guard fails |
|---|---|---|---|---|
| (none) | DRAFT | POST /receiving-documents | supplierName present | 400 VALIDATION_ERROR |
| DRAFT | OPEN | POST .../submit | line count >= 1 | 422 NO_LINES |
| DRAFT | CANCELLED | POST .../cancel | role SUPERVISOR | 403 FORBIDDEN |
| OPEN | PARTIALLY_RECEIVED | POST .../receipts (automatic) | batch accepted | (not applicable) |
| OPEN | CANCELLED | POST .../cancel | no receipts | 409 DOCUMENT_HAS_RECEIPTS |
| PARTIALLY_RECEIVED | COMPLETED | POST .../complete | every line received_qty = expected_qty | 422 DOCUMENT_NOT_FULLY_RECEIVED |

Any other combination returns 409 INVALID_DOCUMENT_STATE. Terminal states (COMPLETED, CANCELLED) reject every write with 409 INVALID_DOCUMENT_STATE, which implements BR-08.

### 6.3 Reasoning about OPEN and COMPLETED

Under this specification, a document can reach COMPLETED only through PARTIALLY_RECEIVED, because any receipt sets the status. The lifecycle in PRD v1.0 showed an OPEN to COMPLETED path. That path could never run, so PRD v1.1 removes it (decision D-02). The service therefore never needs an OPEN to COMPLETED branch, and the state-transition unit test asserts that the transition is rejected.

---

## 7. Line Rules

| Operation | Allowed states | Allowed roles | Rule | Error |
|---|---|---|---|---|
| Add line | DRAFT | OPERATOR, SUPERVISOR | Product exists and is_active = true | 422 PRODUCT_INACTIVE |
| Add line | DRAFT | OPERATOR, SUPERVISOR | Product not already on this document | 409 DUPLICATE_PRODUCT_ON_DOCUMENT |
| Add line | not DRAFT | (state check) | | 409 INVALID_DOCUMENT_STATE |
| Change expected_qty | DRAFT | OPERATOR, SUPERVISOR | New value >= 1 | 400 VALIDATION_ERROR |
| Change expected_qty | OPEN, PARTIALLY_RECEIVED | SUPERVISOR | New value >= received_qty | 400 VALIDATION_ERROR (see section 16, item 2) |
| Change expected_qty | COMPLETED, CANCELLED | (state check) | | 409 INVALID_DOCUMENT_STATE |
| Remove line | DRAFT | OPERATOR, SUPERVISOR | No receipts on the line | 409 INVALID_DOCUMENT_STATE |
| Remove line | not DRAFT | (state check) | | 409 INVALID_DOCUMENT_STATE |

Changing the product of an existing line is not allowed. Remove the line and add a new one while the document is DRAFT.

---

## 8. Product Rules

| Operation | Rule | Error |
|---|---|---|
| Create | SKU normalized to upper case after trim; unique across all rows | 409 DUPLICATE_SKU |
| Update SKU | Allowed only when the product has no receiving lines and no inventory transactions | 409 SKU_LOCKED |
| Update name or base unit | Always allowed for a Supervisor | |
| Deactivate | Idempotent. Deactivating an inactive product returns 200 with the current state. | |
| Reactivate | Not in v1. PATCH with `isActive` is not in the contract. | |

`hasTransactions` in the API is computed as: a receiving line exists for the product, or an inventory transaction exists for the product.

---

## 9. Receiving Workflow: Detailed Flows

### 9.1 Data flow

```mermaid
flowchart LR
    Op["Operator in browser"] -->|"enter lines and quantities"| UI["Receiving detail page"]
    UI -->|"POST receipts + Idempotency-Key"| API["Receipts route"]
    API --> Svc["ReceiptService"]
    Svc -->|"one transaction"| DB[("PostgreSQL")]
    DB -->|"receipts, lines, inventory_transactions, documents, audit_logs, idempotency_keys"| DB
    DB -->|"committed"| Svc
    Svc -->|"201 ReceiptBatchResult"| API
    API -->|"render updated lines and status"| UI
    UI --> Op
```

### 9.2 Receipt batch: sequence

```mermaid
sequenceDiagram
    participant U as Operator UI
    participant R as Receipts route
    participant S as ReceiptService
    participant DB as PostgreSQL

    U->>R: POST /receiving-documents/{id}/receipts (Idempotency-Key, body)
    R->>R: session, role, Origin check, zod validation
    R->>S: recordReceipts(user, documentId, key, body)
    S->>DB: BEGIN
    S->>DB: INSERT idempotency_keys ON CONFLICT DO NOTHING
    alt key already stored
        S->>DB: SELECT stored row
        alt same request_hash
            S->>DB: ROLLBACK
            S-->>R: 200 replay of stored response
        else different request_hash
            S->>DB: ROLLBACK
            S-->>R: 409 IDEMPOTENCY_KEY_REUSED
        end
    else new key
        S->>DB: SELECT document FOR UPDATE
        S->>S: status is OPEN or PARTIALLY_RECEIVED?
        S->>DB: SELECT lines WHERE id = ANY(...) ORDER BY id FOR UPDATE
        S->>S: every line belongs to document? remaining >= requested?
        alt any check fails
            S->>DB: ROLLBACK
            S-->>R: 409 or 422 with details
        else all checks pass
            S->>DB: INSERT receipts (batch_id)
            S->>DB: UPDATE receiving_lines SET received_qty = received_qty + n
            S->>DB: INSERT inventory_transactions (one per receipt)
            S->>DB: UPDATE receiving_documents SET status = PARTIALLY_RECEIVED if OPEN
            S->>DB: INSERT audit_logs
            S->>DB: UPDATE idempotency_keys SET response_status, response_body
            S->>DB: COMMIT
            S-->>R: 201 ReceiptBatchResult
        end
    end
    R-->>U: response, Operator sees updated lines
```

### 9.3 Receipt batch: step by step

1. Authenticate the session and check the role (OPERATOR or SUPERVISOR).
2. Validate the `Idempotency-Key` header (8 to 64 characters) and the body. Reject a batch with duplicate `lineId` values with 400 VALIDATION_ERROR, field `items`.
3. Compute `request_hash` as the SHA-256 of the canonical JSON of the body. Canonical means keys sorted at every level and no insignificant whitespace.
4. Open a transaction.
5. Insert the idempotency row with `ON CONFLICT DO NOTHING`. If a concurrent request with the same key is still running, this insert waits for it to commit. After the wait, the row is visible and step 6 handles it.
6. If the row already existed, compare hashes. Equal hashes return the stored response with 200 and end the transaction. Different hashes return 409 IDEMPOTENCY_KEY_REUSED.
7. Lock the document row with `SELECT ... FOR UPDATE`. A missing document returns 404 NOT_FOUND. A status other than OPEN or PARTIALLY_RECEIVED returns 409 INVALID_DOCUMENT_STATE.
8. Lock the requested lines with `SELECT ... FROM receiving_lines WHERE id = ANY($1) AND document_id = $2 ORDER BY id FOR UPDATE`. A line that is not on this document is reported as a 400 VALIDATION_ERROR with the lineId in `details`.
9. Check every item against the locked line. Collect all failures, not just the first. If any item asks for more than the remaining quantity, return 422 OVER_RECEIPT with one `details` entry per failing line. The transaction rolls back, so nothing is saved (US-06).
10. Insert one `receipts` row per item, all sharing the same `batch_id`.
11. Update each line: `received_qty = received_qty + requested`. The CHECK constraint is the last line of defense. If PostgreSQL raises a check violation (SQLSTATE 23514), the service maps it to 422 OVER_RECEIPT and rolls back.
12. Insert one `inventory_transactions` row per receipt, with `type = 'RECEIPT'`, the receipt's quantity and `receipt_id` set.
13. If the document status is OPEN, set it to PARTIALLY_RECEIVED. Always update `updated_at`.
14. Insert an `audit_logs` row with action `receipt.record`, the batch id, and the lines changed.
15. Store the response in `idempotency_keys` (status 201, body = ReceiptBatchResult).
16. Commit. Return 201 with ReceiptBatchResult.

Because the document row is locked first and the lines second, two receipt requests for the same document run one after the other. Concurrent requests for different documents do not block each other. This gives NFR-02.

Lock order across the whole system, which prevents deadlocks: document, then lines in ascending id. Complete and cancel follow the same order.

### 9.4 Complete flow

1. Supervisor role check.
2. Lock the document `FOR UPDATE`. Status must be PARTIALLY_RECEIVED, else 409 INVALID_DOCUMENT_STATE.
3. Lock the lines `FOR UPDATE` in id order and check `received_qty = expected_qty` for each.
4. Any short line returns 422 DOCUMENT_NOT_FULLY_RECEIVED with `details` listing the lines and their remaining quantities.
5. Set status COMPLETED, `completed_at = now()`, `updated_at = now()`. Write an audit row.

### 9.5 Cancel flow

1. Supervisor role check.
2. Lock the document `FOR UPDATE`.
3. Status DRAFT or OPEN, and no receipts exist for the document. Otherwise: if the status is COMPLETED or CANCELLED, return 409 INVALID_DOCUMENT_STATE; if the status is PARTIALLY_RECEIVED or any receipt exists, return 409 DOCUMENT_HAS_RECEIPTS.
4. Set status CANCELLED, `cancelled_at = now()`. Write an audit row.

### 9.6 Document number

Generated in step 1 of the create flow, inside the same transaction as the insert, using the upsert in section 3.1. The format is `RD-` followed by the four-digit year in APP_TIMEZONE and a six-digit zero-padded counter.

---

## 10. API Conventions

### 10.1 Errors

Every error body follows the `Error` schema in openapi.yaml: `code`, `message`, optional `field`, optional `details`. Status codes map as follows:

| Status | Used for |
|---|---|
| 400 | Malformed or invalid input, including references to lines outside the document |
| 401 | No session or expired session |
| 403 | Role not permitted, or Operator acting on a non-DRAFT document |
| 404 | Resource not found |
| 409 | Conflict with current state or uniqueness |
| 422 | Input is valid but breaks a business rule |
| 500 | Unexpected error. Body is `INTERNAL_ERROR` with no stack trace. The stack goes to the log. |

### 10.2 Pagination

Lists accept `page` (default 1) and `pageSize` (default 20, maximum 100). The response includes `pagination` with `page`, `pageSize` and `total`. Sort orders:

- Products: sku ascending.
- Receiving documents: created_at descending.
- Inventory: sku ascending.
- Transactions: created_at descending, then id descending.

### 10.3 Date handling

- Request dates in filters (`dateFrom`, `dateTo` of type `date`) are interpreted in APP_TIMEZONE. `dateFrom` maps to 00:00 local, `dateTo` is inclusive and maps to the start of the following day, so the range is half-open in UTC.
- Responses return timestamps in UTC ISO 8601 with a `Z` suffix. The UI converts them to APP_TIMEZONE for display.
- "Receipts today" on the dashboard uses the start of today in APP_TIMEZONE, converted to UTC.

### 10.4 Health

- `GET /health/live` returns 200 with `status: ok`. It checks nothing else.
- `GET /health/ready` runs `SELECT 1` and compares the applied migrations in `pgmigrations` with the migration files in the image. It returns 200 with `database: up` and `migrations: up_to_date`. If the database is unreachable it returns 503 with `database: down`. If migrations are pending it returns 503 with `migrations: pending`.

### 10.5 Logging

Each request logs one line at completion with: `requestId`, `userId` (if known), `method`, `path`, `status`, `durationMs`, and `code` for errors. Passwords, session tokens, and request bodies of login are never logged.

---

## 11. Frontend Architecture

### 11.1 Routes and data

| Route | Roles | Data source |
|---|---|---|
| /login | public | POST /auth/login |
| / | both | GET /receiving-documents?status=OPEN, ?status=PARTIALLY_RECEIVED, GET /products?active=true, GET /transactions?type=RECEIPT&dateFrom=... |
| /products | both list; Supervisor actions | GET /products, POST, PATCH, POST deactivate |
| /receiving-documents | both | GET /receiving-documents |
| /receiving-documents/new | both | POST /receiving-documents, then redirect to detail |
| /receiving-documents/[id] | both | GET detail; actions by role and state |
| /inventory | both | GET /inventory |
| /transactions | both | GET /transactions |
| /users | Supervisor | GET /users, POST, PATCH |

The UI calls the API through `src/lib/api-client.ts`, a thin typed wrapper. It sends cookies, parses the Error schema, and throws a typed error. No page queries the database.

### 11.2 Navigation visibility

The sidebar hides Users for Operators and hides Products create and edit actions for Operators. Hiding is convenience only. The API returns 403 regardless.

### 11.3 Error display

- Field errors: the UI maps `field` to the input and shows the message below it (role="alert").
- Line-level receipt errors: the UI maps `details[].lineId` to the row.
- Page-level errors: an inline alert at the top of the content.

### 11.4 Data loading

Pages load data on mount with the API client and show skeleton rows while loading. After a mutation, the page refetches the affected resource. There is no client-side global store in v1.

---

## 12. Security Summary

| Area | Control |
|---|---|
| Passwords | bcrypt, cost 12. Never logged. |
| Sessions | Random 32-byte token. Only SHA-256 stored. HttpOnly, SameSite=Lax, Secure in production. Expire after SESSION_TTL_HOURS. |
| Login enumeration | Same error and similar timing for unknown and wrong passwords. |
| SQL injection | Parameterized queries only. A lint rule or code review checks for template-string SQL. |
| Input | zod validation on every body and query. Length limits match the database. |
| Authorization | Role guard in every write handler. The API is the only enforcement point that matters. |
| CSRF | SameSite=Lax, JSON-only writes, Origin check (section 5.4). |
| Secrets | Environment variables only. `.env` ignored by Git. `.env.example` has placeholders. |
| Headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, a restrictive Content-Security-Policy set by next.config. |
| Dependencies | `npm audit` run before submission. Findings are documented in docs/testing.md. |

Rate limiting on login is not in v1 and is listed as a known limitation.

---

## 13. Testing Strategy

### 13.1 Levels

| Level | Tool | Scope | Location |
|---|---|---|---|
| Unit | Vitest | Status transition table, quantity arithmetic, canonical JSON hashing, zod schemas, SKU normalization, date range conversion | tests/unit |
| Integration | Vitest against real PostgreSQL | Every endpoint: success, each error code, role checks, pagination, filters | tests/integration |
| Concurrency | Vitest with a pool of at least 20 connections | Parallel receipts on one document | tests/concurrency |
| End-to-end | Playwright | Operator creates, submits and receives; Supervisor completes | tests/e2e |
| Consistency | SQL check, run as a test | NFR-01 and the line cache (13.5) | tests/integration/consistency.test.ts |

Integration tests run migrations once, then truncate all tables before each test file. They never use mocks for the database.

### 13.2 Required test cases

Each case maps to a PRD requirement.

- Auth: no session returns 401; Operator on a Supervisor endpoint returns 403; logout invalidates the session; expired session returns 401.
- Products: BR-01 case-insensitive duplicate returns 409; FR-03 SKU change after a line exists returns 409 SKU_LOCKED; BR-12 inactive product rejected on line add with 422.
- Documents: BR-14 duplicate reference per supplier (case-insensitive supplier) returns 409 DUPLICATE_REFERENCE; BR-15 numbers are sequential within a year and format-valid; US-02 empty supplier returns 400 VALIDATION_ERROR.
- Lines: US-03 duplicate product returns 409 DUPLICATE_PRODUCT_ON_DOCUMENT; BR-02 expectedQty 0 returns 400.
- Submit: US-04 no lines returns 422 NO_LINES.
- Receipts: US-05 partial receipt updates status, received and inventory; BR-03 over-receipt returns 422 OVER_RECEIPT and changes nothing; BR-05 receipt on DRAFT returns 409; US-06 one invalid line rolls back the whole batch; BR-09 one transaction row per receipt; line not on document returns 400.
- Idempotency: BR-10 same key and body returns the same body, one receipt set and one transaction row per line; same key with a different body returns 409 IDEMPOTENCY_KEY_REUSED; failed request does not store its key, so a corrected retry succeeds.
- Complete: BR-06 with a short line returns 422 DOCUMENT_NOT_FULLY_RECEIVED; full receipt then complete returns COMPLETED; COMPLETED rejects further receipts (BR-08).
- Cancel: BR-07 with receipts returns 409 DOCUMENT_HAS_RECEIPTS; DRAFT cancel succeeds.
- Inventory and transactions: US-10 on-hand equals the receipt sum; zero-stock products listed; filters and newest-first order.
- Health: ready returns 503 when migrations are pending (simulate by inserting a fake migration file name in a test copy) and when the database is unreachable.

### 13.3 Concurrency test

- Setup: one product, one document in OPEN with one line expected 10.
- Action: 20 receipt requests with distinct idempotency keys, each for quantity 1, sent in parallel through a pool of 20 connections.
- Expected: exactly 10 succeed with 201, exactly 10 fail with 422 OVER_RECEIPT, the line ends with received_qty = 10, and there are exactly 10 receipt rows and 10 inventory transactions.
- Repeat the test 5 times in CI to reduce the chance of a false pass.

### 13.4 Idempotency test under concurrency

Send 10 parallel requests with the same key and body. Expected: all return the same body, exactly one receipt batch exists, and the line is increased once.

### 13.5 Consistency check

Run after the full suite and once in CI:

```sql
-- NFR-01: on-hand equals sum of RECEIPT transactions (by definition, so this checks the join)
SELECT p.id
FROM products p
LEFT JOIN inventory_transactions t ON t.product_id = p.id AND t.type = 'RECEIPT'
GROUP BY p.id
HAVING COALESCE(SUM(t.quantity), 0) <> (
  SELECT COALESCE(SUM(r.received_qty), 0)
  FROM receipts r
  JOIN receiving_lines l ON l.id = r.line_id
  WHERE l.product_id = p.id
);

-- Line cache: received_qty equals sum of receipts for each line
SELECT l.id
FROM receiving_lines l
LEFT JOIN receipts r ON r.line_id = l.id
GROUP BY l.id, l.received_qty
HAVING l.received_qty <> COALESCE(SUM(r.received_qty), 0);

-- Document status consistent with receipts
SELECT d.id
FROM receiving_documents d
WHERE d.status = 'PARTIALLY_RECEIVED' AND NOT EXISTS (
  SELECT 1 FROM receipts r WHERE r.document_id = d.id
);
```

Each query must return zero rows.

### 13.6 Evidence to submit

`docs/testing.md` records: the commands used, the date and output of the last full run, coverage of each PRD requirement with the test file name, the consistency check output, the concurrency test result over the 5 repetitions, and the known limitations from section 15.

---

## 14. Docker and Deployment

### 14.1 Services

| Service | Image | Role |
|---|---|---|
| db | postgres:16 | Data store. Volume `pgdata`. Healthcheck with `pg_isready`. |
| migrate | app image | Runs `npm run db:migrate` once, then exits. Depends on db healthy. |
| app | app image | Runs `npm run start`. Depends on migrate completing successfully. |
| seed | app image | Optional profile. Runs `npm run db:seed`. |

The app image is a multi-stage build: dependencies, build, and a slim runtime that runs as a non-root user. The image contains no `.env` file.

### 14.2 Clean-environment start

```
cp .env.example .env          # then edit passwords
docker compose up --build -d
docker compose --profile seed run --rm seed
curl -f http://localhost:3000/api/health/ready
```

The readiness check must return 200 after these commands.

### 14.3 Health in Compose

The `app` service healthcheck calls `/api/health/live`. Readiness is checked by the documented curl command and by the end-to-end test setup.

---

## 15. Known Limitations (v1)

These are documented here and repeated in docs/testing.md. Each one is a deliberate scope decision.

| ID | Limitation | Why | Improvement |
|---|---|---|---|
| L-01 | No way to correct or void a receipt. | A-03, Q-03. | Adjustment documents with a Supervisor approval step. |
| L-02 | Idempotency keys are never deleted by the application. | No cleanup job in v1. | Scheduled job deleting keys older than 7 days. |
| L-03 | No login rate limiting. | Not in PRD. | Per-IP and per-username limits with a lockout window. |
| L-04 | Single warehouse, no locations. | A-05. | Location table and transfer documents. |
| L-05 | Supplier is free text. | A-02, Q-09. | Supplier master data with a picker. |
| L-06 | Dashboard counts are computed on each load. | Simplicity; data volume is small. | Summary table or cached counts if load grows. |
| L-07 | Sessions have no sliding expiry. | Simplicity. | Refresh on activity. |
| L-08 | No automated backup or restore procedure. | Out of scope for the assessment. | Scheduled `pg_dump` with restore test. |
| L-09 | English only. | A-10. | i18n with message catalogues. |

---

## 16. Required Changes to openapi.yaml

Writing this specification exposed four places where openapi.yaml does not yet say what this document requires. The changes are small. Apply them to openapi.yaml before the agent starts Phase 5, and record them in docs/ai-workflow.md.

1. **Username conflict.** `POST /users` returns 409 with the generic Conflict example, which uses `DUPLICATE_SKU`. Add `DUPLICATE_USERNAME` to the `Error.code` enum and change the example in the `Conflict` response, or add a specific 409 response on `POST /users`.

2. **Expected quantity below received quantity.** `PATCH /receiving-documents/{id}/lines/{lineId}` has no error code for "new expected quantity is below what has already been received". Section 7 uses 400 VALIDATION_ERROR with `field: expectedQty`. Confirm this choice, or add an error code such as `EXPECTED_BELOW_RECEIVED` with status 422.

3. **Self-deactivation rule.** The description of `PATCH /users/{userId}` says a Supervisor cannot deactivate their own account. Section 8 of this spec instead blocks deactivating or demoting the last active Supervisor, using the existing `LAST_SUPERVISOR_ACTION_FORBIDDEN` code. Update the description to match, so that a Supervisor may deactivate their own account when another active Supervisor exists.

4. **Duplicate lines in a receipt batch.** `ReceiptBatchCreate.items` does not say that `lineId` values must be unique within the batch. Add `uniqueItems` on the lineId values or a description stating the rule. Section 9.3 rejects duplicates with 400 VALIDATION_ERROR.

---

## 17. Open Items for Review

| ID | Item | Owner | Status |
|---|---|---|---|
| TD-01 | Confirm the library choices in section 1 (zod, node-pg-migrate). | Developer | Open |
| TD-02 | Confirm the four openapi.yaml changes in section 16. | Developer | Open |
| TD-03 | Confirm that the OPEN to PARTIALLY_RECEIVED rule in section 6 matches PRD v1.1 decision D-02. | Developer and reviewer | Open |
