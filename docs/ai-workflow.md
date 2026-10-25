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

