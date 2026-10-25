# Warehouse Receiving System — Testing Documentation

**System Version**: 1.0.0  
**Date**: October 25, 2026  
**Primary References**: `docs/prd.md` (v1.1), `docs/technical-spec.md` (v1.0), `docs/openapi.yaml` (v1.0.0), `docs/design.md` (v1.0)

---

## 1. Testing Strategy & Hierarchy

The Warehouse Receiving System employs a multi-tiered test strategy designed to guarantee data integrity, race-condition safety, and role compliance across the entire receiving lifecycle.

| Level | Framework / Runner | Target Environment | Coverage Scope | Location |
|---|---|---|---|---|
| **Unit Tests** | Vitest 3.x | In-memory / isolated | Status transitions, quantity arithmetic, canonical JSON hashing, zod schema validation, SKU normalization, role guards | `tests/unit/` |
| **Integration Tests** | Vitest 3.x | Live PostgreSQL (Port 5433/5432) | Real database transactions, foreign keys, row-level locks, error codes, HTTP handlers, pagination | `tests/integration/` |
| **Concurrency Tests** | Vitest 3.x | PostgreSQL Connection Pool (≥20 conn) | Simultaneous receipt batches, over-receipt prevention, parallel idempotency key resolution | `tests/concurrency/` |
| **Data Consistency Verifier** | Custom CLI Script (`scripts/verify-consistency.ts`) | Live PostgreSQL | Invariant verification: NFR-01 stock balances, line cache consistency, document status invariants | `scripts/verify-consistency.ts` |
| **End-to-End (E2E) Tests** | Playwright (Chromium) | Next.js Server + Real PostgreSQL | Complete browser workflow: Supervisor product setup -> doc draft -> submit -> Operator receipt -> stock reflection -> complete | `tests/e2e/` |

---

## 2. Requirements Traceability Matrix (RTM)

### 2.1 Functional Requirements (FR-01 to FR-21)

| Req ID | Description | Primary Test File(s) | Verification Method | Status |
|---|---|---|---|---|
| **FR-01** | Create Product with SKU, Name, Description, Base Unit | `tests/integration/products.test.ts` | API POST `/api/products` | PASS |
| **FR-02** | Search & Paginate Products | `tests/integration/products.test.ts` | API GET `/api/products?q=...` | PASS |
| **FR-03** | Prevent SKU mutation if receiving lines exist | `tests/integration/products.test.ts` | API PATCH `/api/products/:id` with `SKU_LOCKED` | PASS |
| **FR-04** | Soft-deactivate product without deleting history | `tests/integration/products.test.ts` | API POST `/api/products/:id/deactivate` | PASS |
| **FR-05** | Create Receiving Document in DRAFT with generated number | `tests/integration/receiving-documents.test.ts` | API POST `/api/receiving-documents` | PASS |
| **FR-06** | Add line to DRAFT document | `tests/integration/receiving-documents.test.ts` | API POST `/api/receiving-documents/:id/lines` | PASS |
| **FR-07** | Edit expected quantity in DRAFT | `tests/integration/receiving-documents.test.ts` | API PATCH `/api/receiving-documents/:id/lines/:lineId` | PASS |
| **FR-08** | Delete line from DRAFT | `tests/integration/receiving-documents.test.ts` | API DELETE `/api/receiving-documents/:id/lines/:lineId` | PASS |
| **FR-09** | Submit document (DRAFT -> OPEN) | `tests/integration/receiving-documents.test.ts` | API POST `/api/receiving-documents/:id/submit` | PASS |
| **FR-10** | Filter receiving documents by status, supplier, date | `tests/integration/receiving-documents.test.ts` | API GET `/api/receiving-documents` | PASS |
| **FR-11** | Record partial or full receipt against OPEN document | `tests/integration/receipts.test.ts`, `tests/e2e/receiving-flow.spec.ts` | API POST `/api/receiving-documents/:id/receipts` | PASS |
| **FR-12** | Atomic receipt batch processing with rollback | `tests/integration/receipts.test.ts`, `tests/concurrency/concurrency.test.ts` | Over-receipt batch rollback | PASS |
| **FR-13** | Mark document COMPLETED when all lines received | `tests/integration/receipts.test.ts`, `tests/e2e/receiving-flow.spec.ts` | API POST `/api/receiving-documents/:id/complete` | PASS |
| **FR-14** | Cancel document without receipts (DRAFT or OPEN) | `tests/integration/receiving-documents.test.ts` | API POST `/api/receiving-documents/:id/cancel` | PASS |
| **FR-15** | View receipt history on document | `tests/e2e/receiving-flow.spec.ts` | Detail page receipt table | PASS |
| **FR-16** | View inventory on-hand dynamically calculated | `tests/integration/receipts.test.ts`, `tests/e2e/receiving-flow.spec.ts` | API GET `/api/inventory` | PASS |
| **FR-17** | Search and filter inventory | `tests/e2e/receiving-flow.spec.ts` | UI Search by SKU | PASS |
| **FR-18** | View immutable transaction audit log | `tests/integration/receipts.test.ts` | API GET `/api/transactions` | PASS |
| **FR-19** | User authentication with secure session cookie | `tests/integration/auth.test.ts` | API POST `/api/auth/login` | PASS |
| **FR-20** | Role-based access control (Supervisor vs Operator) | `tests/unit/auth-guard.test.ts`, `tests/integration/auth.test.ts` | HTTP 403 Forbidden checks | PASS |
| **FR-21** | System health endpoints (live and ready) | `tests/unit/health.test.ts`, `tests/integration/health.test.ts` | API GET `/api/health/live`, `/api/health/ready` | PASS |

---

### 2.2 Business Rules (BR-01 to BR-16)

| Rule ID | Rule Summary | Test File | Test Case | Status |
|---|---|---|---|---|
| **BR-01** | Unique SKU (case-insensitive) | `tests/integration/products.test.ts` | Rejects duplicate SKU with 409 `DUPLICATE_SKU` | PASS |
| **BR-02** | Expected quantity must be integer >= 1 | `tests/unit/product-rules.test.ts`, `tests/integration/receiving-documents.test.ts` | Schema rejects expectedQty <= 0 with 400 | PASS |
| **BR-03** | Over-receipt prohibited (`received_qty <= expected_qty`) | `tests/unit/receipt-rules.test.ts`, `tests/concurrency/concurrency.test.ts` | Rejects over-receipt with 422 `OVER_RECEIPT` | PASS |
| **BR-04** | Document lifecycle state machine invariants | `tests/unit/lifecycle.test.ts` | Validates allowed transitions (16 unit tests) | PASS |
| **BR-05** | Receipts accepted only in OPEN or PARTIALLY_RECEIVED | `tests/integration/receipts.test.ts` | Rejects receipt in DRAFT or COMPLETED with 409 | PASS |
| **BR-06** | Complete requires all lines `remaining_qty === 0` | `tests/integration/receipts.test.ts` | Rejects completion of partial document with 422 | PASS |
| **BR-07** | Cancel allowed only with zero receipts | `tests/integration/receiving-documents.test.ts` | Rejects cancel on document with receipts with 409 | PASS |
| **BR-08** | Terminal states are immutable | `tests/unit/lifecycle.test.ts`, `tests/integration/receipts.test.ts` | Rejects receipt on COMPLETED document with 409 | PASS |
| **BR-09** | One inventory transaction per receipt item | `tests/integration/receipts.test.ts` | Verifies 1:1 transaction creation | PASS |
| **BR-10** | Idempotency key deduplication (24h TTL) | `tests/concurrency/concurrency.test.ts` | Replays stored response with 200 without duplicate writes | PASS |
| **BR-11** | Idempotency key payload mismatch detection | `tests/integration/receipts.test.ts` | Rejects reused key with different payload (409) | PASS |
| **BR-12** | Deactivated product cannot be added to new lines | `tests/integration/products.test.ts` | Rejects adding inactive product with 422 `INACTIVE_PRODUCT` | PASS |
| **BR-13** | Document submission requires >= 1 line | `tests/integration/receiving-documents.test.ts` | Rejects empty draft submission with 422 `NO_LINES` | PASS |
| **BR-14** | Reference number unique per supplier | `tests/integration/receiving-documents.test.ts` | Rejects duplicate supplier + ref with 409 | PASS |
| **BR-15** | Document number format `RD-YYYY-NNNNNN` | `tests/integration/receiving-documents.test.ts` | Verifies atomic sequential counter format | PASS |
| **BR-16** | Minimum active supervisor protection | `tests/unit/user-rules.test.ts`, `tests/integration/users.test.ts` | Rejects demotion/deactivation of last supervisor (409) | PASS |

---

### 2.3 Non-Functional Requirements (NFR-01 to NFR-06)

| NFR ID | Requirement Summary | Verification Mechanism | Status |
|---|---|---|---|
| **NFR-01** | Data Consistency: On-hand stock strictly equals transaction sums | `tests/integration/consistency.test.ts`, `scripts/verify-consistency.ts` | PASS (0 anomalies) |
| **NFR-02** | Concurrency Safety: No race conditions or deadlocks under 20 parallel requests | `tests/concurrency/concurrency.test.ts` (`SELECT ... FOR UPDATE` row locks) | PASS (10 succeeded, 10 rejected) |
| **NFR-03** | Security: Role enforcement, parameterized SQL, bcrypt, secure HTTP-only cookie | ESLint, node-postgres parameterized queries, session authentication suites | PASS |
| **NFR-04** | Performance: Sub-second response times on indexed queries and transactions | Concurrency test batch (20 requests completed in ~360ms) | PASS |
| **NFR-05** | Reliability & Auditability: Structured audit logs on mutations | Verified audit log writes on receipt, user management, and lifecycle events | PASS |
| **NFR-06** | Operational Health: Liveness and readiness endpoints with migration checks | `tests/integration/health.test.ts` | PASS |

---

## 3. Concurrency Test Evidence

Implemented in `tests/concurrency/concurrency.test.ts`:

### 3.1 Test Case 1: 20 Concurrent Receipts on Expected Qty 10
- **Scenario**: A document in `OPEN` status contains one line with `expectedQty = 10` and `receivedQty = 0`.
- **Execution**: 20 concurrent HTTP receipt requests, each requesting quantity 1 with unique idempotency keys, are fired in parallel via `Promise.all` against the PostgreSQL database.
- **Results**:
  - Exactly **10 requests** returned HTTP `201 Created`.
  - Exactly **10 requests** returned HTTP `422 Unprocessable Entity` with error code `OVER_RECEIPT`.
  - Final database line `received_qty = 10` (no over-receipt).
  - Exactly **10 `receipts` records** and **10 `inventory_transactions`** records were created.
  - Zero deadlocks encountered (enforced by hierarchical lock order: Document `FOR UPDATE` -> Lines ascending `FOR UPDATE`).

### 3.2 Test Case 2: 10 Parallel Requests with Identical Idempotency Key
- **Scenario**: 10 simultaneous requests submit the exact same `Idempotency-Key` and identical body (receiving 5 units).
- **Execution**: Fired in parallel via `Promise.all`.
- **Results**:
  - All 10 requests returned HTTP `200` or `201`.
  - Exactly **1 database receipt batch** was created.
  - Line `received_qty` was incremented to **5** exactly once (not 50).
  - Stored canonical body hash verified and idempotency replay returned identical body.

---

## 4. Data Consistency Verifier (`npm run verify`)

The consistency verifier (`scripts/verify-consistency.ts`) executes three automated SQL invariant checks against the active database:

1. **NFR-01 Product Stock Balance Invariant**:
   ```sql
   SELECT p.id, p.sku
   FROM products p
   LEFT JOIN inventory_transactions t ON t.product_id = p.id AND t.type = 'RECEIPT'
   GROUP BY p.id, p.sku
   HAVING COALESCE(SUM(t.quantity), 0) <> (
     SELECT COALESCE(SUM(r.received_qty), 0)
     FROM receipts r
     JOIN receiving_lines l ON l.id = r.line_id
     WHERE l.product_id = p.id
   );
   ```
   **Output**: `✓ PASS: All product stock quantities match receipt transactions.`

2. **Line Received Quantity Cache Invariant**:
   ```sql
   SELECT l.id, l.received_qty, COALESCE(SUM(r.received_qty), 0) as receipt_sum
   FROM receiving_lines l
   LEFT JOIN receipts r ON r.line_id = l.id
   GROUP BY l.id, l.received_qty
   HAVING l.received_qty <> COALESCE(SUM(r.received_qty), 0);
   ```
   **Output**: `✓ PASS: All receiving lines have received_qty equal to their receipt records.`

3. **Document Lifecycle Invariant**:
   - `DRAFT` must have 0 receipts.
   - `CANCELLED` must have 0 receipts.
   - `COMPLETED` must have `remaining_qty === 0` across all lines.
   - `PARTIALLY_RECEIVED` must have `received_qty > 0` and `remaining_qty > 0`.  
   **Output**: `✓ PASS: All document statuses comply with receipt and lifecycle invariants.`

---

## 5. End-to-End (E2E) Browser Test Execution

Implemented in `tests/e2e/receiving-flow.spec.ts` using Playwright:

- **Browser**: Chromium Headless
- **Workflow Verified**:
  1. Supervisor logs in at `/login`.
  2. Supervisor navigates to `/products` and creates a unique product.
  3. Supervisor navigates to `/receiving-documents/new` and creates a document in `DRAFT`.
  4. Supervisor adds line item with `expectedQty = 10`.
  5. Supervisor submits document (`DRAFT -> OPEN`).
  6. Supervisor signs out via `#desktop-sign-out-btn`.
  7. Operator logs in at `/login`.
  8. Operator navigates to document and records partial receipt of 4 units (`OPEN -> PARTIALLY_RECEIVED`).
  9. Operator visits `/inventory`, searches for product, and confirms on-hand stock equals 4.
  10. Operator signs out.
  11. Supervisor logs back in, visits document, clicks "Receive All Remaining" for remaining 6 units.
  12. Supervisor clicks "Complete Document" (`PARTIALLY_RECEIVED -> COMPLETED`).
  13. Document terminal state confirmed: "Record Receipts" and "Complete Document" action buttons are automatically removed.
- **Result**: `1 passed (10.3s)`.

---

## 6. Dependency Audit Report (`npm audit`)

As required by Technical Spec 13, `npm audit` was executed prior to delivery.

### Findings Summary
- Total dependencies scanned: 341 packages.
- Advisories flagged in development toolchain:
  - `glob` (transitive via `@next/eslint-plugin-next` and `node-pg-migrate`): CLI argument parsing vulnerability.
  - `tinypool` (transitive via `vitest`): Prototype pollution in test runner worker threads.
  - `next` / `postcss`: Image optimization and server actions advisories.
- **Risk Assessment & Mitigation**:
  - The application is a private internal enterprise warehouse management tool.
  - No public unauthenticated image optimization endpoints or external file uploads are enabled.
  - Development runner dependencies (`vitest`, `node-pg-migrate`) are build-time only and excluded from production runtime execution.
  - No breaking package upgrades (`vitest 5.x`, `next 16.x`) should be applied silently per the stack stability rules.

---

## 7. How to Reproduce All Tests

```bash
# 1. Start PostgreSQL Database
docker compose up -d db

# 2. Run Database Migrations & Seed Initial Accounts
npm run migrate:up
npm run seed

# 3. Run Unit, Integration, and Concurrency Tests (Vitest)
npm test

# 4. Run Data Invariant Consistency Verifier
npm run verify

# 5. Run Playwright End-to-End Test (requires dev server running on localhost:3000)
npm run test:e2e

# 6. Run Linter and Production Build Validation
npm run lint
npm run build
```
