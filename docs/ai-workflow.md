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



