# AI Workflow Log

This document records the interaction history, prompts used, what the AI agent produced, decisions accepted, changes made, and the rationale across every phase.

---

## Phase 0: Plan & Specification Review

### User Prompt
User provided the project brief:
- Tech stack: Next.js (App Router, TypeScript), PostgreSQL (`pg`), bcryptjs, Tailwind CSS, shadcn/ui primitives, lucide-react, Inter font, Vitest, Playwright, Docker Compose.
- Non-negotiable rules: service layer separation, parameterized SQL, row locks in ascending line ID order, idempotency key handling, audit logs, session cookies (httpOnly, SameSite=Lax), APP_TIMEZONE handling, strict scope limits.
- Phased approach (Phases 0 through 9).
- Phase 0 deliverable: Map PRD sections to files, report missing files/contradictions, write no code.

### Agent Output
1. **File Location Audit**: Detected that `docs/` folder was missing and specification files were in the workspace root (`prd (1).md`, `technical-spec.md`, `openapi.yaml`, `erd.mmd`). Proposed standardizing them into `docs/`.
2. **Discrepancy Audit**:
   - Document number counter vs sequence: Prompt mentioned PostgreSQL sequence, but PRD Decision D-05, Tech Spec 3.1 & 9.6, and ERD specify the `document_number_counters` table with transactional upsert row locks.
   - Cancellation of `PARTIALLY_RECEIVED`: OpenAPI description mentioned `PARTIALLY_RECEIVED`, but PRD Decision D-02 / BR-07 makes it impossible since any receipt moves document to `PARTIALLY_RECEIVED` and documents with receipts cannot be cancelled.
   - OpenAPI updates: Proposed 4 adjustments from Tech Spec Section 16 (`DUPLICATE_USERNAME`, line qty drop error, supervisor self-deactivation condition, unique `lineId` in batch).
   - Additional Libraries: Formally proposed `zod` and `node-pg-migrate` per Tech Spec Section 1.
3. **PRD-to-File Mapping**: Complete breakdown of PRD sections mapped to architectural components, routes, and services.

### User Response & Acceptance
User approved all 3 items:
1. Approved libraries (`zod`, `node-pg-migrate`).
2. Approved OpenAPI schema adjustments.
3. Approved folder reorganization into `docs/`.

### Changes Applied
- Reorganized root files into `docs/`: `docs/prd.md`, `docs/technical-spec.md`, `docs/openapi.yaml`, `docs/erd.mmd`.
- Applied OpenAPI adjustments to `docs/openapi.yaml`.
- Initialized `docs/ai-workflow.md`.

---

## Phase 1: Foundation Scaffold & Health Probes

### User Prompt / Requirements
- Next.js (App Router, TypeScript) scaffold, Tailwind CSS, shadcn/ui primitives configuration, ESLint.
- Docker Compose with PostgreSQL (postgres:16, volume, healthcheck).
- Startup environment validation (`src/server/config/env.ts` with Zod).
- `.env.example` with documented environment variables.
- Health endpoints: `GET /api/health/live` (200 with status: ok), `GET /api/health/ready` (503 when db unreachable or migrations pending, 200 when up to date).
- Unit tests for environment validation and health endpoints.

### What Was Produced
- Initialized `package.json` with exact stack: `next@14.2.24`, `react@18.3.1`, `pg`, `bcryptjs`, `zod`, `node-pg-migrate`, `tailwindcss`, `vitest`.
- Configured `tsconfig.json`, `next.config.mjs` (security headers), `tailwind.config.ts` (design tokens: near-black, borders #E5E7EB, radii, status colours), `postcss.config.mjs`, `.eslintrc.json`, `vitest.config.ts`.
- Created `.gitignore` ensuring `.env` is never committed while `.env.example` is tracked.
- Created `docker-compose.yml` (`db`, `migrate`, `app`, `seed` services) and multi-stage `Dockerfile`.
- Implemented `src/server/config/env.ts` for strict startup environment validation.
- Implemented `src/server/db/pool.ts` providing managed `pg.Pool` connection pool.
- Implemented `src/server/errors.ts` (`AppError` and OpenAPI error codes) and `src/server/http/respond.ts` (standardized JSON and error response mapping).
- Implemented `src/server/services/health.service.ts` checking liveness, database connectivity, and pending migrations against `pgmigrations`.
- Created route handlers `app/api/health/live/route.ts` and `app/api/health/ready/route.ts`.
- Created root layout `app/layout.tsx` with Inter font and `app/globals.css`.
- Wrote unit tests in `tests/unit/env.test.ts` and `tests/unit/health.test.ts`.

### Test Output
```
> warehouse-receiving-system@1.0.0 test:unit
> vitest run tests/unit

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/env.test.ts (3 tests) 6ms
 ✓ tests/unit/health.test.ts (5 tests) 6ms

 Test Files  2 passed (2)
      Tests  8 passed (8)
   Duration  786ms
```

`next lint` passed with zero errors or warnings.
`next build` passed successfully creating optimized production build and registering `/api/health/live` and `/api/health/ready` dynamic routes.

---

## Phase 2: Schema Migrations & Seed Script

### User Prompt / Context
- User requested getting the application running locally ("jalankan hingga bisa running..karena di run sendiri tidak bisa").
- Addressed root cause: host Windows machine had native `postgres.exe` (PID 6248) listening on port 5432, preventing connections to Docker PostgreSQL. Configured `POSTGRES_PORT=5433` for mapped container access.

### What Was Produced
- **Port Mapping & Local Configuration**:
  - Configured `"${POSTGRES_PORT:-5433}:5432"` in `docker-compose.yml`.
  - Configured `.env` and `.env.example` with port 5433 for local developer access.
  - Added `.dockerignore` to keep image builds clean and fast.
- **10 Idempotent Migrations (`migrations/*.ts`)**:
  1. `20261025000001_create_users_and_sessions.ts`: `users` (uuid PK, regex username, role check, bcrypt hash) and `sessions` (token hash PK, cascade delete, indexes).
  2. `20261025000002_create_products.ts`: `products` (uppercase check, format check, active index).
  3. `20261025000003_create_document_number_counters.ts`: `document_number_counters` (year PK, last_value).
  4. `20261025000004_create_receiving_documents.ts`: `receiving_documents` (format check, status enum check, unique `(supplier_key, reference_number)` index, date and status indexes).
  5. `20261025000005_create_receiving_lines.ts`: `receiving_lines` (expected_qty between 1 and 1000000, received_qty >= 0 and <= expected_qty, unique `(document_id, product_id)`).
  6. `20261025000006_create_receipts.ts`: `receipts` (received_qty >= 1, batch_id, line and document indexes).
  7. `20261025000007_create_inventory_transactions.ts`: `inventory_transactions` (type RECEIPT, positive quantity, unique receipt_id).
  8. `20261025000008_create_idempotency_keys.ts`: `idempotency_keys` (PK on `(user_id, key)`, request_hash, jsonb response).
  9. `20261025000009_create_audit_logs.ts`: `audit_logs` (bigint identity PK, action, before/after jsonb).
  10. `20261025000010_create_append_only_triggers.ts`: triggers `receipts_no_mutation`, `inventory_transactions_no_mutation`, and `audit_logs_no_mutation` enforcing immutability (BR-13).
- **Scripts**:
  - `scripts/migrate.ts`: CLI migration runner using `node-pg-migrate` (`npm run db:migrate`).
  - `scripts/seed.ts`: Seed runner upserting one Operator and one Supervisor (`npm run db:seed`) with bcrypt cost factor 12.
- **Integration Tests**:
  - `tests/integration/health.test.ts`: Verifies liveness (200), readiness (200 when up to date, 503 when pending), presence of all 10 tables, and seeded users.

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/env.test.ts (3 tests) 7ms
 ✓ tests/unit/health.test.ts (5 tests) 5ms
 ✓ tests/integration/health.test.ts (5 tests) 51ms

 Test Files  3 passed (3)
      Tests  13 passed (13)
   Duration  770ms
```

### Running Server Output
- Development server running on `http://localhost:3000`.
- Health probes verified via HTTP:
  - `GET http://localhost:3000/api/health/live` $\rightarrow$ `{"status":"ok"}`
  - `GET http://localhost:3000/api/health/ready` $\rightarrow$ `{"status":"ok","database":"up","migrations":"up_to_date"}`

---

## Phase 3: Authentication & Role Guards

### User Prompt / Requirements
- Implement `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- Implement `requireRole` guard and `requireAuth` helper used across write endpoints.
- Build Login page UI (centered card max-width 380px, wordmark, near-black button, accessible error handling).
- Tests: 401 without session, 403 when an Operator calls a Supervisor-only endpoint.

### What Was Produced
- **Validation**:
  - `src/lib/validation/auth.schema.ts`: Zod schema for `LoginRequest` (username 3-50 chars, password 8-128 chars).
- **Core Domain & Security**:
  - `src/types/domain.ts`: Core domain models (`User`, `CurrentUser`, `Role`, `Session`, `DocumentStatus`).
  - `src/server/auth/token.ts`: Crypto utilities for 32-byte base64url session token generation, SHA-256 session ID hashing, and HTTP-only cookie construction with SameSite=Lax and Max-Age.
  - `src/server/repositories/user.repository.ts`: Parameterized queries to find users by username (case-insensitive) or ID.
  - `src/server/repositories/session.repository.ts`: Parameterized queries to insert sessions, lookup active sessions (checking `expires_at > now()` and `is_active = true`), and delete sessions.
  - `src/server/services/auth.service.ts`:
    - Constant-time bcrypt comparison against dummy hash when a username does not exist or is inactive, preventing username enumeration timing attacks.
    - Session expiration timestamp calculated using `SESSION_TTL_HOURS`.
    - Logout and `getCurrentUser` session verification.
  - `src/server/auth/guard.ts`:
    - `requireAuth`: Validates session cookie from request and returns user.
    - `requireRole`: Validates user role against allowed list; throws 403 FORBIDDEN if unauthorized.
    - `validateOrigin`: Enforces CSRF defense by rejecting state-changing requests (POST/PATCH/DELETE) with mismatched `Origin` headers.
- **REST API Routes**:
  - `app/api/auth/login/route.ts` (`POST /api/auth/login`)
  - `app/api/auth/logout/route.ts` (`POST /api/auth/logout`)
  - `app/api/auth/me/route.ts` (`GET /api/auth/me`)
- **Frontend**:
  - `src/lib/api-client.ts`: Typed fetch wrapper handling cookie credentials and OpenAPI Error schema mapping.
  - `app/(auth)/login/page.tsx`: Centered 380px card, wordmark, field and page-level error alerts (`role="alert"`), near-black primary button with disabled states.
- **Automated Tests**:
  - `tests/unit/auth-guard.test.ts`: Role guard permission checks, 403 on Operator access to Supervisor actions, CSRF origin checks, schema validation.
  - `tests/integration/auth.test.ts`: 401 without session, 401 on wrong username/password, 200 on login with Set-Cookie, 200 on `/auth/me` with session, 403 on role guard check, 204 on logout and subsequent 401.

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/env.test.ts (3 tests) 8ms
 ✓ tests/unit/health.test.ts (5 tests) 7ms
 ✓ tests/integration/health.test.ts (5 tests) 76ms
 ✓ tests/unit/auth-guard.test.ts (5 tests) 10ms
 ✓ tests/integration/auth.test.ts (6 tests) 1119ms

 Test Files  5 passed (5)
      Tests  24 passed (24)
   Duration  2.30s
```

`next lint` passed with 0 warnings or errors.
`next build` passed successfully generating `/login` and dynamic API routes `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.

---

## Phase 4: Product Catalogue API & UI

### User Prompt / Requirements
- API: List products (paginated, search by SKU or name, active filter), Create product, Update product, Deactivate product.
- UI: Product table, search bar, right-side slide-over sheet for create and edit, active status badges, actions restricted to Supervisor.
- Tests: BR-01 case-insensitive uniqueness (409 DUPLICATE_SKU), FR-03 SKU locked after transactions exist (409 SKU_LOCKED), BR-12 deactivated products rejected/deactivation idempotency, 403 on Operator mutations.

### What Was Produced
- **Validation**:
  - `src/lib/validation/product.schema.ts`: Zod schemas for `ProductCreate` (uppercase regex format, trim, 1-32 chars), `ProductUpdate` (refine requiring at least 1 field), and `ProductQuery` (q, active boolean, page, pageSize).
- **Domain & Repository**:
  - `src/types/domain.ts`: Added `Product`, `ProductPage`, `Pagination`.
  - `src/server/repositories/product.repository.ts`:
    - `findProducts`: Filter by search term (`ILIKE` on SKU or name) and active flag, sorted by `sku ASC`, pagination with limit/offset. Computes `hasTransactions` via `EXISTS` subqueries on `receiving_lines` and `inventory_transactions`.
    - `findProductById` & `findProductBySku`: Case-insensitive SKU lookup (`WHERE upper(sku) = $1`).
    - `createProduct`, `updateProduct`, `deactivateProduct`: Parameterized SQL mutations.
- **Service Layer**:
  - `src/server/services/product.service.ts`:
    - Role enforcement: Supervisors only for write operations (`requireRole(user, ['SUPERVISOR'])`).
    - BR-01: Normalized uppercase SKU trimmed; unique check rejects duplicate with 409 `DUPLICATE_SKU`.
    - FR-03: SKU modification is locked if product has existing lines or transactions, rejecting with 409 `SKU_LOCKED`.
    - FR-04: Product deactivation is idempotent (returns 200 with current state if already inactive).
- **REST Route Handlers**:
  - `app/api/products/route.ts` (`GET /api/products`, `POST /api/products`)
  - `app/api/products/[productId]/route.ts` (`GET /api/products/{id}`, `PATCH /api/products/{id}`)
  - `app/api/products/[productId]/deactivate/route.ts` (`POST /api/products/{id}/deactivate`)
- **Frontend UI Components**:
  - `components/ui/status-badge.tsx`: Pill badges for ACTIVE (green), INACTIVE (gray), and document statuses.
  - `components/ui/sheet.tsx`: Slide-over sheet from the right with backdrop, close button, and Escape key dismissal.
  - `components/ui/toast.tsx`: Toast provider with auto-dismiss after 4 seconds per design tokens.
  - `components/products/product-sheet.tsx`: Create & edit form with SKU disabled when `hasTransactions` is true, and field-level error messages in red text (`role="alert"`).
  - `components/products/product-table.tsx`: Clean minimal table matching design tokens (48px rows, uppercase headers, search input, skeleton loading, pagination, edit/deactivate buttons visible only to Supervisors).
  - `app/(app)/products/page.tsx`: Products page with live data fetching, search, pagination, and toast feedback.
- **Automated Tests**:
  - `tests/unit/product-rules.test.ts` (5 tests): Validates SKU regex format, default unit `pcs`, update refinements, and query transforms.
  - `tests/integration/products.test.ts` (7 tests against real PostgreSQL):
    - Operator cannot create product (403 FORBIDDEN).
    - Supervisor creates product with normalized uppercase SKU (201).
    - BR-01 case-insensitive duplicate SKU rejected with 409 `DUPLICATE_SKU`.
    - Both Operator and Supervisor can list products with search and pagination (200).
    - Supervisor updates product name and base unit (200).
    - FR-03 SKU locked after lines exist: attempting SKU rename returns 409 `SKU_LOCKED`, while name/unit edits succeed.
    - FR-04 deactivation is idempotent and rejects Operator with 403 `FORBIDDEN`.

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/product-rules.test.ts (5 tests) 10ms
 ✓ tests/unit/env.test.ts (3 tests) 11ms
 ✓ tests/unit/health.test.ts (5 tests) 8ms
 ✓ tests/unit/auth-guard.test.ts (5 tests) 13ms
 ✓ tests/integration/health.test.ts (5 tests) 82ms
 ✓ tests/integration/products.test.ts (7 tests) 734ms
 ✓ tests/integration/auth.test.ts (6 tests) 1281ms

 Test Files  7 passed (7)
      Tests  36 passed (36)
   Duration  2.48s
```

`next lint`: 0 warnings, 0 errors.
`next build`: Successfully generated `/products` and dynamic routes (`/api/products`, `/api/products/[productId]`, `/api/products/[productId]/deactivate`).

---

## Phase 5: Receiving Documents and Lines (API, Lifecycle & UI)

### User Prompt / Requirements
- Receiving documents and lines domain:
  - Document header with system-generated sequential number `RD-YYYY-NNNNNN` (BR-15, D-05).
  - Lifecycle state machine: `DRAFT -> OPEN -> PARTIALLY_RECEIVED -> COMPLETED` and cancellation `DRAFT -> CANCELLED`, `OPEN -> CANCELLED` (BR-01, Section 7).
  - Business rules:
    - Empty supplier rejected with 400 `VALIDATION_ERROR` (US-02).
    - Unique reference per supplier (BR-14).
    - Positive expected quantities >= 1 (BR-02).
    - Inactive products rejected with 422 `PRODUCT_INACTIVE` (BR-12, US-03).
    - Duplicate product on same document rejected with 409 `DUPLICATE_PRODUCT_ON_DOCUMENT` (BR-11, US-03).
    - Submission requires at least one line (422 `NO_LINES`, US-04).
    - Role restrictions: DRAFT lines editable by Operator & Supervisor; post-submit line modifications restricted to Supervisor with expectedQty >= receivedQty (FR-09, A-06). Post-submit header modifications restricted to Supervisor notes only (BR-09).
    - Cancellation restricted to Supervisor when document has zero receipts (FR-13, BR-07).
    - Terminal states `COMPLETED` and `CANCELLED` reject all edits (BR-08).
- Endpoints:
  - `GET /api/receiving-documents`, `POST /api/receiving-documents`
  - `GET /api/receiving-documents/{id}`, `PATCH /api/receiving-documents/{id}`
  - `POST /api/receiving-documents/{id}/cancel`
  - `POST /api/receiving-documents/{id}/lines`
  - `PATCH /api/receiving-documents/{id}/lines/{lineId}`, `DELETE /api/receiving-documents/{id}/lines/{lineId}`
  - `POST /api/receiving-documents/{id}/submit`
- Frontend UI:
  - Receiving documents list page with search, status filter, and pagination (`app/(app)/receiving-documents/page.tsx`). Strikethrough document numbers for cancelled documents.
  - New document creation form (`app/(app)/receiving-documents/new/page.tsx`).
  - Document detail page (`app/(app)/receiving-documents/[id]/page.tsx`) with `DocumentHeaderCard`, `LinesTable`, `AddLineDialog`, `EditHeaderDialog`.
- Automated Tests:
  - `tests/unit/lifecycle.test.ts`: pure domain state transition validation and schema tests.
  - `tests/integration/receiving-documents.test.ts`: integration tests against PostgreSQL verifying full lifecycle and business rules.

### What Was Produced
- **Domain & Validation**:
  - `src/types/domain.ts`: Added `ReceivingDocument`, `ReceivingLine`, `Receipt`, `ReceivingDocumentTotals`, `ReceivingDocumentDetail`, `ReceivingDocumentPage`.
  - `src/server/domain/lifecycle.ts`: Pure lifecycle transition validator mapping PRD Section 7 transition matrix.
  - `src/lib/validation/receiving-document.schema.ts`: Zod schemas for create, update, line create, line update, and query parsing with `.trim()` before `.min(1)`.
- **Database & Repositories**:
  - `src/server/db/tx.ts`: Reusable `withTransaction` helper managing PostgreSQL client checkout, `BEGIN`, `COMMIT`, and `ROLLBACK`.
  - `src/server/repositories/document-counter.repository.ts`: Atomic transactional sequential counter generation for `RD-YYYY-NNNNNN` with row locking (`FOR UPDATE`).
  - `src/server/repositories/receiving-document.repository.ts`: List filtering with totals aggregation, detail lookup with lines and receipts, duplicate reference check, and status update.
  - `src/server/repositories/receiving-line.repository.ts`: Product check on document, line counting, line creation, quantity update, and line deletion.
- **Service Layer**:
  - `src/server/services/receiving-document.service.ts`: Complete business logic implementation for creating, listing, updating header/lines, submitting, and cancelling receiving documents with role checking.
- **Route Handlers**:
  - `app/api/receiving-documents/route.ts` (`GET`, `POST`)
  - `app/api/receiving-documents/[documentId]/route.ts` (`GET`, `PATCH`)
  - `app/api/receiving-documents/[documentId]/cancel/route.ts` (`POST`)
  - `app/api/receiving-documents/[documentId]/lines/route.ts` (`POST`)
  - `app/api/receiving-documents/[documentId]/lines/[lineId]/route.ts` (`PATCH`, `DELETE`)
  - `app/api/receiving-documents/[documentId]/submit/route.ts` (`POST`)
- **Frontend UI Components & Pages**:
  - `components/receiving/document-header-card.tsx`: Status badge, RD number (with strikethrough if cancelled), supplier details, reference, dates, totals grid, action buttons (Submit, Edit Header, Cancel).
  - `components/receiving/lines-table.tsx`: Clean tabular view with SKU, name, expected, received, and remaining quantities; quick inline update modal and line deletion.
  - `components/receiving/add-line-dialog.tsx`: Modal selecting active products and specifying expected quantities.
  - `components/receiving/edit-header-dialog.tsx`: Modal for editing supplier/ref/date/notes in DRAFT or notes only in OPEN/PARTIALLY_RECEIVED.
  - `app/(app)/receiving-documents/page.tsx`: List table with search, status filter, and pagination.
  - `app/(app)/receiving-documents/new/page.tsx`: Inbound delivery registration form.
  - `app/(app)/receiving-documents/[id]/page.tsx`: Integrated detail page with interactive lifecycle controls.
- **Automated Tests**:
  - `tests/unit/lifecycle.test.ts` (16 tests): Validates PRD Section 7 transition matrix, terminal states, and input validation schemas.
  - `tests/integration/receiving-documents.test.ts` (10 tests):
    - Empty supplier rejected (400 VALIDATION_ERROR).
    - Sequential RD numbering format `RD-YYYY-NNNNNN` in DRAFT (201).
    - Duplicate reference for same supplier rejected with 409 DUPLICATE_REFERENCE.
    - Adding active product line (201).
    - Duplicate product on document rejected with 409 DUPLICATE_PRODUCT_ON_DOCUMENT.
    - Inactive product rejected with 422 PRODUCT_INACTIVE.
    - Submit without lines rejected with 422 NO_LINES.
    - Submit with lines transitions status to OPEN; enforces post-submit permissions (Operator line/header edits rejected with 403/409; Supervisor line quantity and note edits succeed).
    - Cancellation rules: Operator rejected with 403; Supervisor cancels document with 0 receipts; edits on cancelled document rejected with 409.
    - List filtering by status and search with pagination.

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/product-rules.test.ts (5 tests) 7ms
 ✓ tests/unit/env.test.ts (3 tests) 11ms
 ✓ tests/unit/health.test.ts (5 tests) 10ms
 ✓ tests/unit/lifecycle.test.ts (16 tests) 14ms
 ✓ tests/integration/health.test.ts (5 tests) 70ms
 ✓ tests/unit/auth-guard.test.ts (5 tests) 11ms
 ✓ tests/integration/products.test.ts (7 tests) 1182ms
 ✓ tests/integration/receiving-documents.test.ts (10 tests) 1692ms
 ✓ tests/integration/auth.test.ts (6 tests) 2154ms

 Test Files  9 passed (9)
      Tests  62 passed (62)
   Duration  4.85s
```

`next lint`: 0 warnings, 0 errors.
`next build`: Successfully compiled and generated static and dynamic routes for `/receiving-documents`, `/receiving-documents/new`, and `/receiving-documents/[id]`.

---

## Phase 6: Receipts, Completion, Cancellation, and Inventory API & UI

### User Prompt / Requirements
- Receipts recording:
  - Idempotency key handling (BR-10, US-07).
  - Row locking: lock `receiving_documents` `FOR UPDATE`, then `receiving_lines` `FOR UPDATE` in ascending ID order (Tech Spec 3.2, 9.3 step 8, NFR-02).
  - Over-receipt validation (BR-03, US-05, US-06) returning 422 with structured `details` array.
  - Multi-line receipt batch committed atomically in one database transaction.
  - Automatic inventory update: write `receipts`, insert `inventory_transactions` (`RECEIPT`), increment `received_qty` on line.
  - Automatic status transition: if status was `OPEN`, update to `PARTIALLY_RECEIVED` (PRD Section 7, D-02).
  - Write audit log entry (`receipt.record`).
- Document completion endpoint:
  - Supervisor only (FR-12).
  - Validates that every line is fully received (BR-06, US-08).
  - Sets `completed_at = now()`, `status = COMPLETED`, writes audit log (`document.complete`).
- Inventory listing endpoint:
  - `GET /api/inventory` (FR-16).
  - Lists all products (including 0 on-hand), onHand quantity computed dynamically from transactions, available quantity, and `lastMovementAt`.
- Transactions listing endpoint:
  - `GET /api/transactions` (FR-17).
  - Immutable transaction log, filterable by product, document, date range, with pagination.
- Frontend:
  - Record receipts dialog on document detail screen.
  - Complete document action on header card.
  - Receipt history table on document detail screen.
  - Inventory management page (`/inventory`).
  - Transaction history page (`/transactions`).
- Automated Tests:
  - Unit tests for receipt schema, over-receipt calculation, canonical idempotency hashing.
  - Integration tests against PostgreSQL verifying partial receipt, over-receipt rejection, idempotency replay (200 cached) and key reuse detection (409), stock reflection, completion rules, and terminal states.

### What Was Produced
- **Domain & Validation**:
  - `src/types/domain.ts`: Added `ReceiptBatchResult`, `InventoryItem`, `InventoryPage`, `InventoryTransaction`, `TransactionPage`.
  - `src/lib/validation/receipt.schema.ts`: Zod schema for `ReceiptBatchCreate` (validates `receivedAt` is not in future > 5 min, unique lineIds in batch, quantities >= 1, max 100 items) and `Idempotency-Key` header (8-64 chars).
  - `src/lib/validation/inventory.schema.ts` & `src/lib/validation/transaction.schema.ts`: Query validation schemas.
- **Repositories**:
  - `src/server/repositories/idempotency.repository.ts`: Deterministic canonical JSON serializer, SHA-256 request hashing, and atomic idempotency persistence.
  - `src/server/repositories/receipt.repository.ts`: Atomic execution of batch receipts with deadlock-free row locking order (`receiving_documents` `FOR UPDATE` -> `receiving_lines` `ORDER BY id ASC FOR UPDATE`), batch ID assignment, inventory transaction logging, audit trails, and status update.
  - `src/server/repositories/inventory.repository.ts`: Implemented dynamic on-hand stock calculation query from Tech Spec 3.2.
  - `src/server/repositories/transaction.repository.ts`: Querying immutable inventory transactions with joined product SKU and document number.
- **Service Layer**:
  - `src/server/services/receipt.service.ts`: Role verification, idempotency replay with 200 cache return, key reuse conflict detection (409), and atomic receipt batch execution.
  - `src/server/services/receiving-document.service.ts`: Added `completeDocument` verifying all lines received with ascending line ID locks.
  - `src/server/services/inventory.service.ts` & `src/server/services/transaction.service.ts`: Service methods for inventory and transaction retrieval.
- **Route Handlers**:
  - `POST /api/receiving-documents/[documentId]/receipts`: Validates `Idempotency-Key` and processes receipt batches.
  - `POST /api/receiving-documents/[documentId]/complete`: Marks fully received document as `COMPLETED`.
  - `GET /api/inventory`: Lists products with on-hand and available quantities.
  - `GET /api/transactions`: Lists stock movement history.
- **Frontend UI Components & Pages**:
  - `components/receiving/record-receipt-dialog.tsx`: Operator modal to record receipts with "Receive All Remaining" helper, per-line inputs, and automated UUID idempotency keys.
  - `components/receiving/document-header-card.tsx`: Updated with "Record Receipts" and "Complete Document" action buttons based on status and user role.
  - `app/(app)/receiving-documents/[id]/page.tsx`: Integrated receipt modal, completion handler, and Receipt History audit table.
  - `app/(app)/inventory/page.tsx`: Inventory screen displaying on-hand, available stock, status, and last movement timestamp.
  - `app/(app)/transactions/page.tsx`: Transaction history screen with date range filtering.
- **Automated Tests**:
  - `tests/unit/receipt-rules.test.ts` (7 tests): Validates canonical JSON hashing across key permutations, rejection of future dates, rejection of duplicate batch lineIds, and key length constraints.
  - `tests/integration/receipts.test.ts` (3 extensive tests):
    - Validates Idempotency-Key header requirement.
    - Rejects over-receipt with 422 OVER_RECEIPT with per-line details; rolls back completely.
    - Partial receipt transitions status to PARTIALLY_RECEIVED, increments stock, logs inventory transactions, replays cached response on identical key (200), rejects key reuse on different payload with 409, prevents cancellation of documents with receipts (409), blocks premature completion (422), allows completion when 100% received, and enforces terminal read-only state (409).

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/product-rules.test.ts (5 tests) 15ms
 ✓ tests/unit/env.test.ts (3 tests) 12ms
 ✓ tests/unit/lifecycle.test.ts (16 tests) 13ms
 ✓ tests/unit/health.test.ts (5 tests) 9ms
 ✓ tests/unit/receipt-rules.test.ts (7 tests) 16ms
 ✓ tests/integration/health.test.ts (5 tests) 89ms
 ✓ tests/unit/auth-guard.test.ts (5 tests) 14ms
 ✓ tests/integration/products.test.ts (7 tests) 890ms
 ✓ tests/integration/receiving-documents.test.ts (10 tests) 1042ms
 ✓ tests/integration/receipts.test.ts (3 tests) 971ms
 ✓ tests/integration/auth.test.ts (6 tests) 1438ms

 Test Files  11 passed (11)
      Tests  72 passed (72)
   Duration  2.73s
```

`next lint`: 0 warnings, 0 errors.
`next build`: Successfully generated optimized production pages for `/inventory`, `/transactions`, `/receiving-documents/[id]`, and receipt API endpoints.

---

## Phase 7A: UI Tokens, Shared Shell, Design Spec, and Dashboard

### User Prompt / Requirements
- Design specification document (`docs/design.md`) mapping the tokens and component conventions from PRD and Tech Spec:
  - Tokens: Backgrounds, surfaces, borders, primary/secondary/muted, status pill colors, radii (`rounded-card`, `rounded-input`, `rounded-button`, `rounded-pill`), typography (Inter, monospace for SKUs and RD numbers).
  - Component patterns: Data tables (48px rows, monospace identifiers, alignment), sheets/modals with backdrop blur and escape dismissal, form inputs with inline `role="alert"` errors.
- Shared responsive layout (`app/(app)/layout.tsx`):
  - Fixed desktop sidebar (260px wide) with system brand mark, active route highlighting (`bg-primary text-white font-medium shadow-sm`), role-based navigation (Users link restricted to Supervisor), user profile card with role pill, and logout action.
  - Mobile responsive top navigation bar and off-canvas slide-out drawer with backdrop.
  - Session verification via `/api/auth/me` with automatic redirect to `/login` if unauthenticated.
- Dashboard (`app/(app)/page.tsx`):
  - Replaced root placeholder `app/page.tsx`.
  - 4 live summary metric cards: Open documents, Partially received, Active products, Receipts recorded today.
  - Quick action navigation cards to New Receiving Document, Receiving Documents, Inventory, and Transactions.
  - "Needs Action" inbound receiving table listing documents in `OPEN` or `PARTIALLY_RECEIVED` status with real-time remaining quantities and direct processing action links.
- Verification:
  - Run `npm test`, `npm run lint`, `npm run build`.
  - Conventional commit: `feat(ui): implement design system specification, shared shell, and dashboard`.
  - Present dashboard to user for visual review before Phase 7B.

### What Was Produced
- **Design Specification**:
  - `docs/design.md`: Exhaustive UI specification covering design principles, tokens (colors, status badges, radii, spacing, typography), layout architecture (desktop sidebar, mobile drawer, workspace max-width 1280px), and component interaction patterns.
- **Shared Application Shell**:
  - `app/(app)/layout.tsx`: Responsive navigation shell featuring:
    - Fixed desktop sidebar and mobile off-canvas drawer with backdrop.
    - Active route detection (`usePathname()`) applying high-contrast styling.
    - Role-based navigation filtering: Supervisor-only access for User Management (`/users`).
    - User profile card showing full name, username, semantic role badge (Supervisor / Operator), and logout button triggering `POST /api/auth/logout`.
- **Live Operational Dashboard**:
  - `app/(app)/page.tsx`: Production dashboard featuring:
    - 4 live metric summary cards querying API endpoints (`/receiving-documents?status=OPEN`, `PARTIALLY_RECEIVED`, `/products?active=true`, `/transactions?dateFrom=...`).
    - Quick access cards for rapid navigation.
    - "Needs Action" priority inbound table displaying active receiving documents, expected vs. received quantities, remaining balance, and one-click processing CTA.
- **Automated Tests & Quality Checks**:
  - `npm test`: 72 tests passed across 11 test suites.
  - `npm run lint`: 0 warnings, 0 errors.
  - `npm run build`: Successfully generated production routes for `/`, `/login`, `/products`, `/receiving-documents`, `/receiving-documents/new`, `/receiving-documents/[id]`, `/inventory`, `/transactions`.

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/product-rules.test.ts (5 tests) 10ms
 ✓ tests/unit/env.test.ts (3 tests) 11ms
 ✓ tests/unit/lifecycle.test.ts (16 tests) 17ms
 ✓ tests/unit/health.test.ts (5 tests) 10ms
 ✓ tests/unit/receipt-rules.test.ts (7 tests) 15ms
 ✓ tests/integration/health.test.ts (5 tests) 116ms
 ✓ tests/unit/auth-guard.test.ts (5 tests) 16ms
 ✓ tests/integration/products.test.ts (7 tests) 859ms
 ✓ tests/integration/receiving-documents.test.ts (10 tests) 1002ms
 ✓ tests/integration/receipts.test.ts (3 tests) 957ms
 ✓ tests/integration/auth.test.ts (6 tests) 1435ms

 Test Files  11 passed (11)
      Tests  72 passed (72)
   Duration  2.45s
```

`next lint`: 0 warnings, 0 errors.
`next build`: Successfully compiled and optimized all static and dynamic routes.

---

## Phase 7B: Supervisor User Management (API & UI)

### User Prompt / Requirements
- API:
  - List users (`GET /api/users`): Supervisor only (403 for Operators). Paginated with optional search by username or full name. Exposes `SafeUser` (`id`, `username`, `fullName`, `role`, `isActive`, `createdAt`) with zero secret leakage.
  - Create user (`POST /api/users`): Supervisor only. Validates username pattern `^[a-z0-9._-]+$`, length 3-50, full name 1-120 chars, role enum, password >= 8 chars. Rejects duplicates with 409 `DUPLICATE_USERNAME`. Writes audit log (`user.create`).
  - Update user (`PATCH /api/users/{userId}`): Supervisor only. Allows updating `fullName`, `role`, and `isActive`.
  - Last active supervisor protection rule (Tech Spec 16.3, D-08): Attempting to deactivate (`isActive: false`) or demote (`role: 'OPERATOR'`) the last active supervisor returns 409 `LAST_SUPERVISOR_ACTION_FORBIDDEN`. A supervisor may deactivate or demote their own account when another active supervisor exists. Deactivating a user immediately invalidates their active sessions. Writes audit log (`user.update`).
- Frontend UI:
  - `app/(app)/users/page.tsx`: Supervisor-only user management screen (FR-19). Renders access restricted alert card if accessed by an Operator.
  - Search toolbar, table with 48px rows, username in monospace, role badges, active status pills, created dates.
  - Quick toggle button for Deactivate / Activate with confirmation.
  - `components/users/user-sheet.tsx`: Slide-over panel for user creation and editing with field-level `role="alert"` errors and global conflict alerts.
- Automated Tests:
  - `tests/unit/user-rules.test.ts`: Validates input schemas, character constraints, password minimums, and partial updates.
  - `tests/integration/users.test.ts`: Integration tests against real PostgreSQL verifying unauthenticated 401, Operator 403 on all user endpoints, Supervisor user listing, 201 user creation, 409 `DUPLICATE_USERNAME` rejection, 200 update, and enforcement of 409 `LAST_SUPERVISOR_ACTION_FORBIDDEN`.

### What Was Produced
- **Domain & Validation**:
  - `src/types/domain.ts`: Added `SafeUser` and `UserPage`.
  - `src/lib/validation/user.schema.ts`: Zod schemas for `userCreateSchema`, `userUpdateSchema`, and `userQuerySchema`.
- **Database & Repositories**:
  - `src/server/repositories/user.repository.ts`: Added `listUsers`, `createUser`, `updateUser`, and `countActiveSupervisors` using parameterized SQL.
- **Service Layer**:
  - `src/server/services/user.service.ts`: Implemented `listUsers`, `createUser`, and `updateUser` with role enforcement, duplicate username validation, last active supervisor protection, session revocation on deactivation, and audit logging (`user.create`, `user.update`).
- **REST Route Handlers**:
  - `app/api/users/route.ts` (`GET /api/users`, `POST /api/users`)
  - `app/api/users/[userId]/route.ts` (`PATCH /api/users/[userId]`)
- **Frontend UI Components & Pages**:
  - `components/users/user-sheet.tsx`: Slide-over sheet for creating and updating users with role selection, initial password generation, and active toggle.
  - `app/(app)/users/page.tsx`: Complete user management screen with role restriction guard, search, user table, pagination, and status toggles.
- **Automated Tests**:
  - `tests/unit/user-rules.test.ts` (6 tests): Validates creation regex, minimum password length, role enum, and update refine.
  - `tests/integration/users.test.ts` (7 tests): Complete PostgreSQL integration testing covering 401, 403 on Operator, 200 list, 201 create, 409 duplicate, 200 update, and 409 last supervisor protection.

### Test Output
```
> warehouse-receiving-system@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Refangga Lintar/Documents/TCL

 ✓ tests/unit/env.test.ts (3 tests) 11ms
 ✓ tests/unit/user-rules.test.ts (6 tests) 12ms
 ✓ tests/unit/lifecycle.test.ts (16 tests) 17ms
 ✓ tests/unit/receipt-rules.test.ts (7 tests) 15ms
 ✓ tests/unit/auth-guard.test.ts (5 tests) 13ms
 ✓ tests/integration/health.test.ts (5 tests) 116ms
 ✓ tests/unit/product-rules.test.ts (5 tests) 10ms
 ✓ tests/unit/health.test.ts (5 tests) 9ms
 ✓ tests/integration/products.test.ts (7 tests) 975ms
 ✓ tests/integration/receiving-documents.test.ts (10 tests) 1161ms
 ✓ tests/integration/receipts.test.ts (3 tests) 1097ms
 ✓ tests/integration/auth.test.ts (6 tests) 1593ms
 ✓ tests/integration/users.test.ts (7 tests) 1617ms

 Test Files  13 passed (13)
      Tests  85 passed (85)
   Duration  2.92s
```

`next lint`: 0 warnings, 0 errors.
`next build`: Successfully generated production route `/users` and dynamic API handlers `/api/users`, `/api/users/[userId]`.

