# Warehouse Receiving System (TCL)

A high-reliability, concurrency-safe Warehouse Inbound Receiving System built with Next.js 14 (App Router), TypeScript, PostgreSQL, node-postgres (`pg`) parameterized SQL, Tailwind CSS, Vitest, Playwright, and Docker Compose.

---

## 1. System Overview

The **Warehouse Receiving System** governs the end-to-end inbound physical logistics workflow: registering shipments, receiving physical goods, preventing over-receipts, maintaining an immutable audit ledger, computing real-time inventory balances, and enforcing strict role boundaries.

### Core Capabilities

- **Product Catalogue**: Case-insensitive unique SKUs, base unit configuration, automatic SKU locking after transactions exist, and idempotent soft-deactivation.
- **Sequential Inbound Documents**: Generated document numbers (`RD-YYYY-NNNNNN`), unique PO references per supplier, multi-line product scheduling, and draft editing.
- **Strict Lifecycle State Machine**: Controlled transitions (`DRAFT -> OPEN -> PARTIALLY_RECEIVED -> COMPLETED` and `CANCELLED`), preventing cancellation once receipts exist, and requiring 100% receipt before supervisor completion.
- **Atomic Receipt Batching & Idempotency**:
  - Hierarchical row-level locks (`SELECT ... FOR UPDATE` on document, then lines ascending by ID) preventing race conditions and deadlocks.
  - Client-supplied `Idempotency-Key` (UUID) with SHA-256 canonical payload hashing and 24-hour replay caching.
  - Zero over-receipt guarantee (`received_qty <= expected_qty`) enforced at both service layer and PostgreSQL table `CHECK` constraints.
- **Dynamically Calculated Inventory**: On-hand stock is strictly derived from immutable `RECEIPT` transactions, satisfying zero data drift (NFR-01).
- **Role-Based Access Control (RBAC)**:
  - **Operator**: Receives goods against open documents, creates/edits draft documents and draft lines, views inventory and transaction logs.
  - **Supervisor**: Creates products, manages users, modifies open documents, cancels documents with 0 receipts, and marks documents completed.
- **Supervisor User Management**: Built-in protection preventing deactivation or demotion of the last active supervisor (Tech Spec 16.3).
- **System Observability & Health**: Unauthenticated `/api/health/live` (process alive) and `/api/health/ready` (database connected and migrations up to date).

---

## 2. Technology Stack

- **Framework**: Next.js 14 (App Router, Server Route Handlers, React Server/Client Components)
- **Language**: TypeScript 5.7+ (Strict Mode)
- **Database**: PostgreSQL 16 accessed via `node-postgres` (`pg`) with 100% parameterized SQL queries (no ORM)
- **Authentication**: HTTP-Only Secure Cookies, Session Tokens (8h TTL), bcryptjs password hashing (cost factor 12)
- **Styling & UI**: Tailwind CSS, custom design tokens (`docs/design.md`), Lucide React icons, Inter typography
- **Automated Testing**: Vitest 3.x (Unit, Integration, Concurrency), Playwright (End-to-End Chromium), Custom SQL Invariant Verifier
- **Deployment & Orchestration**: Multi-stage `Dockerfile`, Docker Compose

---

## 3. Architecture & Specifications

The implementation strictly conforms to the system specifications:
- [docs/prd.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/prd.md) — Product Requirements Document (v1.1)
- [docs/technical-spec.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/technical-spec.md) — Technical Specification & Invariants (v1.0)
- [docs/openapi.yaml](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/openapi.yaml) — OpenAPI 3.0.3 Contract
- [docs/erd.mmd](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/erd.mmd) — Entity Relationship Diagram (Mermaid)
- [docs/design.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/design.md) — UI Tokens, Layout Architecture & Shell Spec
- [docs/testing.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/testing.md) — Comprehensive Test Strategy, RTM & Concurrency Evidence

---

## 4. Quickstart Guide

### Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **Docker & Docker Compose**: Docker Desktop or Docker Engine v24+
- **npm**: `v10.x`+

---

### Option A: Complete Docker Compose Deployment (Recommended for Production / Evaluation)

This starts PostgreSQL, runs migrations automatically, builds the production Next.js container, and runs initial database seeds.

1. **Clone Repository & Prepare Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Launch All Services**:
   ```bash
   docker compose up --build -d
   ```

3. **Seed Default Accounts (Optional if already seeded)**:
   ```bash
   docker compose --profile seed run --rm seed
   ```

4. **Verify System Readiness**:
   ```bash
   curl -f http://localhost:3000/api/health/ready
   ```
   *Expected Response:* `{"status":"ok","database":"up","migrations":"up_to_date"}`

5. **Access Application**:
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Option B: Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm ci
   ```

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

3. **Start PostgreSQL via Docker Compose**:
   ```bash
   docker compose up -d db
   ```

4. **Execute Database Migrations & Seed Initial Accounts**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Next.js Development Server**:
   ```bash
   npm run dev
   ```
   Open **[http://localhost:3000](http://localhost:3000)**.

---

## 5. Default Credentials

The seed script creates two default user accounts with pre-configured roles:

| Role | Username | Password | Permitted Actions |
|---|---|---|---|
| **Supervisor** | `supervisor` | `SupervisorPass123!` | Create/edit products, manage users, modify open document notes/lines, cancel documents with 0 receipts, complete documents. |
| **Operator** | `operator` | `OperatorPass123!` | Create/edit draft receiving documents & lines, record inbound receipts, view products, inventory balances, and transactions. |

---

## 6. Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Starts Next.js development server on port 3000 |
| `npm run build` | Builds optimized production bundle |
| `npm start` | Starts Next.js production server |
| `npm run lint` | Runs Next.js ESLint validation |
| `npm test` | Runs all 90 automated Vitest tests (Unit, Integration, Concurrency) |
| `npm run test:unit` | Runs unit tests (lifecycle state machine, quantity rules, auth guards) |
| `npm run test:integration` | Runs integration tests against PostgreSQL database |
| `npm run test:concurrency` | Runs 20-connection parallel race-condition and idempotency tests |
| `npm run test:e2e` | Runs Playwright Chromium end-to-end browser receiving workflow |
| `npm run verify` | Runs automated SQL invariant consistency checks (NFR-01 stock balances, line cache, lifecycle) |
| `npm run db:migrate` | Applies pending database migrations (`migrations/*.sql`) |
| `npm run db:migrate:down` | Rolls back the latest database migration |
| `npm run db:seed` | Seeds default supervisor and operator accounts |

---

## 7. Automated Testing & Verification

The project includes an exhaustive testing suite providing 100% requirements traceability across all functional requirements (FR-01..21), business rules (BR-01..16), and non-functional requirements (NFR-01..06).

```bash
# 1. Run Unit, Integration, and Concurrency Tests (Vitest)
npm test

# 2. Run Data Invariant Consistency Verifier
npm run verify

# 3. Run Playwright End-to-End Test (Chromium)
npm run test:e2e
```

### Concurrency Guarantees
- **20 Concurrent Requests on 10 Units**: Exactly 10 succeed (`201`), exactly 10 fail with `422 OVER_RECEIPT`, final line quantity is exactly 10, with 10 inventory transactions.
- **10 Identical Idempotency Keys in Parallel**: All return `200/201` cached response, exactly 1 database write occurs.

---

## 8. Clean Clone Automated Validation

To verify that the codebase compiles and passes all checks from a completely clean clone:

- **PowerShell (Windows)**:
  ```powershell
  .\scripts\test-clean-clone.ps1
  ```
- **Bash (Linux/macOS)**:
  ```bash
  chmod +x ./scripts/test-clean-clone.sh
  ./scripts/test-clean-clone.sh
  ```

---

## 9. Known Limitations (v1 Scope)

As defined in `docs/technical-spec.md` Section 15:
1. **Single Warehouse / Bin Location**: All inventory movements are tracked globally without bin-level or aisle tracking.
2. **Serial & Lot Tracking**: Items are tracked by product base unit; serial numbers and lot expiration dates are not tracked.
3. **Login Rate Limiting**: Brute-force rate limiting on `/api/auth/login` is handled at reverse-proxy / firewall tier.
4. **Offline Mode**: The web application requires continuous network connectivity to the PostgreSQL cluster.

---

## 10. License

Private Proprietary Software — All Rights Reserved.
