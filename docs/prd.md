# Product Requirements Document: Warehouse Receiving System

| Item | Detail |
|---|---|
| Version | 1.1 (supersedes 1.0) |
| Status | Draft for implementation |
| Date | 25 October 2026 |
| Derived from | Technical Assessment: AI-Driven Fullstack Developer Intern |
| Companion documents | docs/technical-spec.md, docs/openapi.yaml, docs/erd.mmd, docs/design.md (Phase 7A), docs/testing.md |
| Primary audience | Developer (human and AI coding agent), reviewers, warehouse stakeholders |
| Language | English (UI and documentation). See A-10. |

## Change log

| Version | Change |
|---|---|
| 1.1 | Lifecycle corrected: any recorded receipt moves an OPEN document to PARTIALLY_RECEIVED. The transition OPEN to COMPLETED is removed because it could not be reached (D-02). FR-12 now refers to PARTIALLY_RECEIVED. Dashboard requirements added (section 9). Decisions log added (section 15). |
| 1.0 | Initial PRD. |

---

## 1. Problem Statement and Business Objectives

A warehouse currently records incoming inventory in spreadsheets. Receiving staff enter deliveries by hand, quantities are re-typed across files, and there is no reliable way to know how much of an expected delivery has arrived, which documents are still open, or what stock is on hand. This leads to over-receiving, lost deliveries, stock counts that disagree with records, and no audit trail of who received what and when.

The Warehouse Receiving System replaces these spreadsheets with a web application that registers inbound deliveries, records received quantities against expected quantities, keeps inventory up to date automatically, and preserves a complete transaction history.

### Business objectives

| ID | Objective | Measure of success |
|---|---|---|
| BO-01 | Eliminate manual spreadsheet entry for inbound receiving. | All inbound deliveries in v1 are recorded in the system. |
| BO-02 | Prevent over-receiving against expected quantities. | Zero accepted receipts that exceed the remaining expected quantity. |
| BO-03 | Keep stock levels accurate at all times. | On-hand quantity always equals the sum of recorded receipt transactions. |
| BO-04 | Provide traceability for every stock change. | Every change to stock has a transaction record with user, time and source document. |
| BO-05 | Give supervisors visibility into open and completed receiving. | Status of every receiving document is visible on a single list screen. |

## 2. Users and Roles

| Role | Who | Responsibilities |
|---|---|---|
| Warehouse Operator | Floor staff who physically receive goods at the dock. | Look up products, create receiving documents, add expected lines, record actual received quantities, view stock and history. |
| Warehouse Supervisor | Shift lead or manager responsible for the warehouse. | Everything an Operator can do, plus manage the product catalogue, cancel receiving documents, complete documents, edit documents after submission, and manage user accounts. |

Both roles are internal users. There is no customer or supplier access in v1. Each user has exactly one role.

## 3. Scope

### In scope (v1)

- Product catalogue: create, list, search, edit and deactivate products identified by SKU.
- Inbound receiving documents: create, list, view detail, add and edit expected lines, submit, complete and cancel.
- Receipt recording: partial and full receipts per line, recorded as individual transactions.
- Automatic inventory updates from recorded receipts.
- Inventory listing (on-hand quantity per product) and inventory transaction history.
- Username and password login with two roles (Operator, Supervisor) enforced by the backend.
- Validation and error handling for all invalid operations, enforced server-side.
- Health and readiness endpoints, containerised deployment, database migrations.

### Out of scope (v1)

- Outbound shipments, picking, packing, sales orders and any stock reduction other than cancellation of an unreceived document.
- Multiple warehouses, bins, zones or storage locations.
- Lot, batch, serial number and expiry date tracking.
- Units of measure other than a single base unit per product; decimal quantities.
- Supplier master data (supplier is free text on the document in v1).
- Purchase orders, purchasing workflow and supplier invoicing.
- Barcode or QR scanning, label printing, mobile-native apps.
- Stock adjustments, cycle counts and reversal of posted receipts.
- Email or push notifications, reporting exports, dashboards beyond the four summary figures in section 9, and analytics.
- Single sign-on, multi-factor authentication and self-service registration.
- Public deployment (optional and only if requested by the hiring team).
- Any module that appears in a reference design but is not listed here, such as tasks, boards, team collaboration, notifications, or motivational content.

## 4. Glossary

| Term | Definition |
|---|---|
| SKU | Stock Keeping Unit. The unique business code that identifies a product. |
| Receiving document (RD) | A record of an expected inbound delivery, containing a header and one or more lines. |
| Line (RD line) | One product and its expected quantity on a receiving document. |
| Expected quantity | The quantity of a product the document says should arrive. |
| Received quantity | The sum of all receipts recorded against a line. |
| Remaining quantity | Expected quantity minus received quantity for a line. Never negative. |
| Receipt | One recorded event in which a quantity of a line is physically received. |
| On-hand quantity | Current stock of a product in the warehouse, derived from transactions. |
| Transaction | An immutable stock movement record. In v1 the only type is RECEIPT. |

## 5. Functional Requirements

Priority: **M** = must have for v1, **S** = should have, **C** = could have if time allows.

| ID | Requirement | Pri. |
|---|---|---|
| FR-01 | The system shall allow a Supervisor to create a product with SKU, name, base unit (default "pcs") and an active flag. | M |
| FR-02 | The system shall list products with pagination and search by SKU or name. Both roles can view products. | M |
| FR-03 | The system shall allow a Supervisor to edit product name and unit. SKU may be edited only while the product has no transactions and no receiving lines. | M |
| FR-04 | The system shall allow a Supervisor to deactivate a product. Deactivated products cannot be added to new receiving lines but remain visible in history. | M |
| FR-05 | The system shall allow an Operator or Supervisor to create a receiving document with supplier name (required), reference number (optional), expected arrival date (optional) and notes (optional). The document starts in DRAFT. | M |
| FR-06 | The system shall allow adding lines to a DRAFT document: product (active only) and expected quantity (positive integer). A product may appear only once per document. | M |
| FR-07 | The system shall allow editing and removing lines of a DRAFT document. | M |
| FR-08 | The system shall allow submitting a DRAFT document with at least one line, moving it to OPEN. After submission, Operators can no longer change expected quantities or lines. | M |
| FR-09 | The system shall allow a Supervisor to change the expected quantity of a line on an OPEN or PARTIALLY_RECEIVED document. Decreases are allowed only down to the current received quantity. | S |
| FR-10 | The system shall allow recording receipts against lines of an OPEN or PARTIALLY_RECEIVED document. One submission may include receipts for several lines and is processed atomically. | M |
| FR-11 | The system shall accept a receipt only if the received quantity is a positive integer no greater than the remaining quantity of that line. | M |
| FR-12 | The system shall allow a Supervisor to mark a PARTIALLY_RECEIVED document COMPLETED, but only when every line is fully received. | M |
| FR-13 | The system shall allow a Supervisor to cancel a document that has no recorded receipts. Cancelled documents are read-only. | M |
| FR-14 | The system shall list receiving documents with filters for status, supplier and date range, and search by document number or reference. | M |
| FR-15 | The system shall show a receiving document detail page with header, lines (expected, received, remaining) and receipt history per line. | M |
| FR-16 | The system shall show inventory: for each product, SKU, name, on-hand quantity and date of last movement. Products with zero stock are shown. | M |
| FR-17 | The system shall show the transaction history, filterable by product, document, date range and transaction type, with pagination. | M |
| FR-18 | The system shall provide login and logout with username and password, and enforce role permissions on every endpoint. | M |
| FR-19 | The system shall provide a Supervisor-only user management screen to create users, assign a role and deactivate users. | S |
| FR-20 | The system shall expose a health endpoint (liveness) and a readiness endpoint that checks database connectivity and pending migrations. | M |
| FR-21 | The system shall record an audit trail for every create, update, status change and receipt, including user, timestamp and before/after values where applicable. | S |

## 6. Business Rules and Validation

These rules are enforced by the backend. Frontend validation is a usability aid only and must never be the sole control.

| ID | Business rule | Enforced by |
|---|---|---|
| BR-01 | SKU is required, trimmed, stored in upper case, between 1 and 32 characters, and unique across all products including inactive ones. | API validation and unique constraint |
| BR-02 | Expected quantity and received quantity are integers. Expected quantity must be at least 1. | API validation and CHECK constraint |
| BR-03 | Received quantity for a line must be at least 1 and must not exceed the remaining quantity at the moment of commit. | Transaction with row lock on the document and lines, plus CHECK constraint |
| BR-04 | Received quantity on a line is never negative and never greater than expected quantity. | CHECK constraint |
| BR-05 | A receipt may be recorded only when the document status is OPEN or PARTIALLY_RECEIVED. | Service layer state check |
| BR-06 | A document may be COMPLETED only when every line has received quantity equal to expected quantity. | Service layer state check |
| BR-07 | A document with at least one recorded receipt cannot be CANCELLED. | Service layer state check |
| BR-08 | COMPLETED and CANCELLED are terminal. No changes to their lines or receipts are allowed. | Service layer state check |
| BR-09 | Each receipt creates exactly one RECEIPT transaction and updates on-hand quantity in the same database transaction. Either both succeed or neither does. | Database transaction |
| BR-10 | Every receipt request carries a client-generated idempotency key. A repeated request with the same key returns the original result and creates no new transaction or stock change. | Idempotency table, written in the same database transaction |
| BR-11 | A product may appear only once per receiving document. | Unique constraint (document_id, product_id) |
| BR-12 | Deactivated products cannot be added to new lines. Existing lines keep their product. | Service layer validation |
| BR-13 | Transactions and receipts are append-only. They cannot be edited or deleted through the application. | No update or delete endpoints; database trigger |
| BR-14 | Supplier name is required and at most 150 characters. Reference number is at most 60 characters and unique per supplier when provided. | API validation and unique index |
| BR-15 | Document numbers are generated by the system in the format RD-YYYY-NNNNNN, sequential per year, and are never reused. | Counter row per year, incremented in the creating transaction |
| BR-16 | Timestamps are stored in UTC. All user actions are attributed to the authenticated user. | Server-side logic |

## 7. Receiving Document Lifecycle

The table below lists every valid status transition. Any transition not listed is rejected with an error.

| From | To | Trigger | Who | Condition |
|---|---|---|---|---|
| (new) | DRAFT | Create document | Operator, Supervisor | Supplier present |
| DRAFT | OPEN | Submit | Operator, Supervisor | At least one line |
| DRAFT | CANCELLED | Cancel | Supervisor | No receipts (always true in DRAFT) |
| OPEN | PARTIALLY_RECEIVED | First receipt recorded (automatic) | System | Any receipt recorded, whether it covers part or all of the document |
| OPEN | CANCELLED | Cancel | Supervisor | No receipts recorded |
| PARTIALLY_RECEIVED | COMPLETED | Complete | Supervisor | All lines fully received |

Notes:

- A document in which every line is fully received stays in PARTIALLY_RECEIVED until a Supervisor completes it. It is not completed automatically, so the Supervisor can review the result. See assumption A-07 and decision D-02.
- PARTIALLY_RECEIVED never reverts to OPEN. Once a receipt exists, the document cannot be cancelled.

## 8. Authorization Matrix

| Action | Operator | Supervisor |
|---|---|---|
| View products, inventory, documents, history | Yes | Yes |
| Create and edit products; deactivate products | No | Yes |
| Create receiving document; add, edit, remove DRAFT lines | Yes | Yes |
| Submit DRAFT document | Yes | Yes |
| Change expected quantity on an open document | No | Yes |
| Record receipts | Yes | Yes |
| Complete document | No | Yes |
| Cancel document (no receipts) | No | Yes |
| Manage users | No | Yes |

Authorization is enforced in the API. Requests from a role without permission return HTTP 403. Unauthenticated requests return HTTP 401.

## 9. Dashboard Content

The dashboard shows four figures and two short lists. It uses only data the PRD defines.

| Figure | Definition |
|---|---|
| Open documents | Count of receiving documents with status OPEN. |
| Partially received | Count of receiving documents with status PARTIALLY_RECEIVED. |
| Active products | Count of products with is_active = true. |
| Receipts today | Count of RECEIPT transactions created today in APP_TIMEZONE. |

Lists: "Needs action" shows OPEN and PARTIALLY_RECEIVED documents with remaining quantity. "Quick access" links to New receiving document, Receiving documents, Inventory and Transactions.

## 9A. Dashboard Source Note

The dashboard uses existing list endpoints and reads `pagination.total`. No additional endpoint is required.

## 10. User Stories and Acceptance Criteria

### US-01 (Supervisor)

As a Supervisor, I want to add a product with a unique SKU so that receiving can refer to it consistently.

- Acceptance: Given a valid SKU and name, when I save the product, then it appears in the product list as active.
- Acceptance: Given a SKU that already exists in any case variant (for example "ab-1" and "AB-1"), when I save, then I receive a 409 error and no product is created.

### US-02 (Operator)

As an Operator, I want to create a receiving document for a supplier delivery so that I can record what I expect to arrive.

- Acceptance: Given a supplier name, when I create the document, then it is in DRAFT with a generated RD number.
- Acceptance: Given an empty supplier name, when I submit the form, then I see a field-level error and the API returns 422 if the request is sent anyway.

### US-03 (Operator)

As an Operator, I want to add products and expected quantities to a DRAFT document.

- Acceptance: Given an active product and quantity 10, when I add it, then the line shows expected 10 and received 0.
- Acceptance: Given a product already on the document, when I add it again, then the system rejects the duplicate with 409.
- Acceptance: Given a deactivated product, when I try to add it, then the system rejects it with 422.

### US-04 (Operator)

As an Operator, I want to submit a document so that the warehouse can start receiving against it.

- Acceptance: Given a DRAFT document with at least one line, when I submit it, then its status becomes OPEN.
- Acceptance: Given a DRAFT document with no lines, when I submit it, then the request is rejected with 422.

### US-05 (Operator)

As an Operator, I want to record a partial receipt so that the stock is updated for what has physically arrived.

- Acceptance: Given a line with expected 10, when I receive 4, then received is 4, remaining is 6, the document is PARTIALLY_RECEIVED, and on-hand increases by 4.
- Acceptance: Given a line with remaining 6, when I try to receive 7, then the request is rejected with 422 and no stock changes.

### US-06 (Operator)

As an Operator, I want to receive several lines in one submission so that a delivery can be recorded in one step.

- Acceptance: Given a submission with receipts for lines A and B, when one line fails validation, then no receipt in the submission is saved.
- Acceptance: Given a valid submission, when it succeeds, then one RECEIPT transaction exists per line receipt.

### US-07 (Operator)

As an Operator, I want the system to ignore a double-click or retried request so that stock is not counted twice.

- Acceptance: Given a receipt request with idempotency key K, when it is sent twice, then the second response is identical to the first and only one transaction exists.
- Acceptance: Given two different operators submitting receipts for the same remaining quantity at the same time, then the total received never exceeds expected.

### US-08 (Supervisor)

As a Supervisor, I want to complete a document only when everything has been received so that open items are not closed by mistake.

- Acceptance: Given a line with remaining quantity above zero, when I complete the document, then the request is rejected with 422 and the status is unchanged.
- Acceptance: Given all lines fully received, when I complete the document, then its status becomes COMPLETED and it becomes read-only.

### US-09 (Supervisor)

As a Supervisor, I want to cancel a document that will not arrive so that it does not stay open.

- Acceptance: Given a document with no receipts, when I cancel it, then its status becomes CANCELLED.
- Acceptance: Given a document with at least one receipt, when I try to cancel it, then the request is rejected with 409.

### US-10 (Operator and Supervisor)

As a warehouse user, I want to see current stock and its history so that I can answer questions about what is in the warehouse.

- Acceptance: Given receipts exist for product X, when I open inventory, then X shows on-hand equal to the sum of its RECEIPT transactions.
- Acceptance: Given a product filter on the transaction history, when I apply it, then only that product's transactions are listed, newest first.

### US-11 (Any user)

As any user, I want to be told clearly why an action failed so that I can correct it.

- Acceptance: Every error response includes a stable error code, a human-readable message and, where relevant, the field name.
- Acceptance: Errors are shown next to the relevant field or as a page-level message in the UI.

## 11. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Data integrity | On-hand quantity must equal the sum of RECEIPT transactions for every product at all times. A check query must be provided in the testing suite. |
| NFR-02 | Concurrency | Concurrent receipts against the same document must be serialised. Oversubscription must be impossible under concurrent load tests. |
| NFR-03 | Performance | For a dataset of 1,000 products, 500 documents and 20,000 transactions, p95 response time for list endpoints is under 500 ms on the reference Docker setup. |
| NFR-04 | Security | Passwords are hashed with bcrypt. Secrets come only from environment variables. No credentials are committed to the repository. |
| NFR-05 | Security | All write endpoints require authentication and role checks. Input is validated server-side. SQL is parameterised. |
| NFR-06 | Reliability | Migrations are idempotent and run from a single command. The readiness check fails while migrations are pending. |
| NFR-07 | Observability | Structured logs include request id, user id, endpoint and outcome. Health and readiness endpoints are available. |
| NFR-08 | Portability | The full stack starts from a clean environment with docker compose up, using only documented environment variables. |
| NFR-09 | Usability | The main workflows (create document, add lines, record receipt) are completed in no more than four screens and without page reloads for common actions. |
| NFR-10 | Accessibility | Forms have labels, errors are announced to assistive technology, and colour is not the only indicator of status. |
| NFR-11 | Auditability | Every stock change is traceable to a document, a line, a user and a timestamp. |
| NFR-12 | Maintainability | Business rules live in the service layer and are covered by automated tests. Specifications are kept in the repository and updated with the code. |

## 12. Assumptions

The brief states that the business requirements are unclear. The following assumptions are made so that implementation can proceed. Each one should be reviewed with stakeholders.

| ID | Assumption | Rationale |
|---|---|---|
| A-01 | Quantities are whole units of a single base unit per product. | Simplest model that meets the brief. Decimal and multi-unit support is deferred. |
| A-02 | Each receiving document has one supplier, entered as free text. | The brief does not mention supplier master data. Keeps v1 small. |
| A-03 | Receipts cannot be reversed in v1. Corrections are handled by a Supervisor through a future adjustment feature. | The brief asks for append-only traceability; reversals add a second flow that is out of scope. |
| A-04 | Over-receiving is not allowed at all. There is no tolerance percentage. | The brief says the system must prevent receiving more than the remaining expected quantity. |
| A-05 | Inventory is a single pool. There are no locations, so available quantity equals on-hand quantity. | No outbound or reservation flow exists in scope. |
| A-06 | Expected quantities can be increased after submission but not reduced below received quantity. | Supports real-world changes to delivery size without breaking records. |
| A-07 | Completion is a manual Supervisor action even when all lines are received. | Gives a review step and avoids silent status changes. |
| A-08 | Two roles are sufficient: Operator and Supervisor. A product catalogue is maintained only by Supervisors. | Matches the two user types named in the brief. |
| A-09 | Users are created by a Supervisor. There is no self-registration. | Internal tool; avoids unnecessary auth features. |
| A-10 | The application is English-only and uses one time zone for display, configured by environment variable. | Keeps localisation out of v1. |
| A-11 | Product SKU is the only product identifier used on documents and in the UI. Product names may be duplicated. | SKU is the unique business key named in the brief. |

## 13. Constraints

- Relational database: PostgreSQL. Schema changes are delivered as versioned migrations.
- REST API with a documented contract (OpenAPI). The frontend consumes only this API.
- Git-based delivery with a meaningful commit history.
- Containerised with Docker and Docker Compose. Configuration via environment variables only.
- Implementation is AI-assisted. Every AI-generated change must be reviewed and covered by tests before it is accepted.
- Target effort is 8 to 12 hours, with a submission window of up to three calendar days. Core workflow correctness takes priority over visual polish and extra features.
- No unnecessary features beyond this PRD.

## 14. Unresolved Questions

These questions do not block v1. Each has a proposed default that the implementation uses until stakeholders confirm otherwise.

| ID | Question | Proposed default for v1 |
|---|---|---|
| Q-01 | Should completion happen automatically when the last line is fully received? | No. Manual Supervisor action (A-07). |
| Q-02 | Is a tolerance allowed for over-delivery (for example 2 percent)? | No tolerance. Reject any over-receipt (A-04). |
| Q-03 | Can a receipt be corrected or voided after posting? | Not in v1. Flag as the first post-v1 feature. |
| Q-04 | Do Operators need to see other users' receipts, or only their own? | All users see all documents and transactions. |
| Q-05 | Should expected quantity be editable by Operators after submission? | No. Supervisor only (FR-09). |
| Q-06 | Is there a need for multiple warehouses or dock locations? | Not in v1 (A-05). |
| Q-07 | Do products need lot numbers or expiry dates for receiving? | Not in v1. |
| Q-08 | What should happen to stock when a product is deactivated? | Stock remains and is still reported in inventory. |
| Q-09 | Should a supplier master list be maintained for consistent naming? | Not in v1. Supplier is free text. |

## 15. Decisions Log

| ID | Decision | Reason |
|---|---|---|
| D-01 | UI language is English. | Follows A-10. The assessment brief is in English. |
| D-02 | Any receipt moves an OPEN document to PARTIALLY_RECEIVED, even when it fills every line. Completion is always a separate Supervisor action. | Version 1.0 allowed OPEN to COMPLETED only when a single receipt covered all lines, which conflicts with the rule that a receipt always starts receiving. One status rule keeps the state machine simple and testable. |
| D-03 | Products are visible to both roles. Only Supervisors can create, edit or deactivate them. | Matches the authorization matrix in section 8. |
| D-04 | The dashboard uses existing list endpoints and reads `pagination.total`. | Avoids adding endpoints beyond the contract. |
| D-05 | Document numbers come from a counter row per year, incremented inside the creating transaction. | Gives sequential numbers without a dynamic PostgreSQL sequence per year. |

## 16. Definition of Done for v1

- All FR items marked M are implemented and reachable through the UI and the API.
- All business rules BR-01 to BR-16 have at least one automated test, including negative cases.
- Concurrency test shows that parallel receipts never exceed expected quantity.
- Duplicate receipt test shows that a retried request does not change stock.
- Inventory consistency check (NFR-01) passes after the full test suite.
- `docker compose up` on a clean machine starts the application, runs migrations, and passes the readiness check.
- The OpenAPI contract, ERD and technical specification match the running implementation.
- Known limitations and unresolved questions are documented in the repository.
