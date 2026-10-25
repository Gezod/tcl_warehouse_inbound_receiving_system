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
