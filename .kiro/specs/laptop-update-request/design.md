# Design Document — Laptop Update Request

## Overview

The Laptop Update Request feature adds a controlled change-management layer on top of the existing AASTU Laptop Gate Management System. Students cannot directly edit their laptop records. Instead, they submit a `LaptopUpdateRequest` that captures proposed changes (brand, serial number, photo). A Reviewer (ADMIN or GUARD) inspects the old vs. new data side-by-side and either approves or rejects the request. On approval, the laptop record is updated and its `verificationStatus` is reset to `PENDING`, forcing re-verification at the gate before the laptop can re-enter campus.

The feature integrates cleanly into the existing PERN stack (PostgreSQL + Express + React + Node.js), reusing the existing `protect`/`allowRoles` middleware, `multer` upload middleware, raw `pg` pool queries, and the established React inline-style component pattern.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend                                                  │
│  ┌──────────────────────┐   ┌──────────────────────────────┐   │
│  │ LaptopUpdateForm.jsx │   │ UpdateRequestsDashboard.jsx  │   │
│  │  (Student side)      │   │  (Admin / Guard side)        │   │
│  └──────────┬───────────┘   └──────────────┬───────────────┘   │
│             │  POST /api/laptops/update-request                  │
│             │  GET  /api/laptops/update-request                  │
│             │  PUT  /api/laptops/update-request/:id/approve      │
│             │  PUT  /api/laptops/update-request/:id/reject       │
└─────────────┼──────────────────────────────┼────────────────────┘
              │                              │
┌─────────────▼──────────────────────────────▼────────────────────┐
│  Express Backend                                                  │
│  laptop.routes.js  ──►  updateRequest.controller.js             │
│  auth.middleware.js (protect + allowRoles)                       │
│  upload.js (multer, reused as-is)                                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│  PostgreSQL                                                       │
│  "Laptop"  ◄──── "laptop_update_requests" ────► "User"          │
└─────────────────────────────────────────────────────────────────┘
```

The new controller (`updateRequest.controller.js`) is mounted on the existing `/api/laptops` router, keeping the route namespace consistent. No new top-level route prefix is needed.

---

## Components and Interfaces

### Backend

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Add `LaptopUpdateRequest` model |
| `backend/prisma/migrations/…` | Migration SQL for new table |
| `backend/src/controllers/updateRequest.controller.js` | 4 handlers: create, list, approve, reject |
| `backend/src/routes/laptop.routes.js` | Mount 4 new routes |

#### Controller API surface

```js
// POST /api/laptops/update-request
// Auth: STUDENT only
createUpdateRequest(req, res)
// req.body: { newBrand?, newSerialNumber?, reason? }
// req.file: optional image (multer)
// req.user.id: student id

// GET /api/laptops/update-request
// Auth: ADMIN | GUARD
listUpdateRequests(req, res)
// returns array of requests with current laptop data joined

// PUT /api/laptops/update-request/:id/approve
// Auth: ADMIN | GUARD
approveUpdateRequest(req, res)
// Updates Laptop record, resets verificationStatus = PENDING

// PUT /api/laptops/update-request/:id/reject
// Auth: ADMIN | GUARD
rejectUpdateRequest(req, res)
// Sets request status = REJECTED, laptop unchanged
```

### Frontend

| File | Purpose |
|---|---|
| `frontend/src/pages/StudentDashboard.jsx` | Add "Request Update" button + inline form per laptop |
| `frontend/src/components/LaptopUpdateForm.jsx` | Controlled form component for the update request |
| `frontend/src/pages/UpdateRequestsDashboard.jsx` | New page for Admin/Guard review |
| `frontend/src/App.jsx` | Add route `/update-requests` for Reviewers |

---

## Data Models

### Prisma Schema Addition

```prisma
enum UpdateRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model LaptopUpdateRequest {
  id             String              @id @default(uuid())
  laptopId       String
  laptop         Laptop              @relation(fields: [laptopId], references: [id])
  studentId      String
  student        User                @relation("StudentUpdateRequests", fields: [studentId], references: [id])
  newBrand       String?
  newSerialNumber String?
  newImage       String?
  reason         String?
  status         UpdateRequestStatus @default(PENDING)
  requestedAt    DateTime            @default(now())
  reviewedAt     DateTime?
  reviewedById   String?
  reviewedBy     User?               @relation("ReviewerUpdateRequests", fields: [reviewedById], references: [id])
}
```

The `Laptop` and `User` models gain back-relation fields:
```prisma
// In Laptop model:
updateRequests LaptopUpdateRequest[]

// In User model:
studentUpdateRequests  LaptopUpdateRequest[] @relation("StudentUpdateRequests")
reviewedRequests       LaptopUpdateRequest[] @relation("ReviewerUpdateRequests")
```

### Migration SQL (raw, for the existing raw-pg pattern)

```sql
CREATE TYPE "UpdateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "laptop_update_requests" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "laptopId"        UUID NOT NULL REFERENCES "Laptop"(id),
  "studentId"       UUID NOT NULL REFERENCES "User"(id),
  "newBrand"        TEXT,
  "newSerialNumber" TEXT,
  "newImage"        TEXT,
  "reason"          TEXT,
  "status"          "UpdateRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reviewedAt"      TIMESTAMPTZ,
  "reviewedById"    UUID REFERENCES "User"(id)
);
```

> Note: The codebase uses raw `pg` queries (not Prisma client) for all DB access. The Prisma schema is updated for documentation and migration generation, but runtime queries use `pool.query(...)`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Request creation invariants

*For any* Student, owned Laptop, and non-empty set of proposed changes (new brand, new serial number, new photo, optional reason), submitting a create-update-request call must: (a) create a new `LaptopUpdateRequest` row with status `PENDING`, (b) associate the row with the correct `studentId` and `laptopId`, (c) set `requestedAt` to a non-null timestamp, and (d) leave the original `Laptop` row completely unchanged.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

---

### Property 2: Ownership enforcement

*For any* Student and any Laptop not owned by that Student, calling the create-update-request endpoint must return a 403 Forbidden response and must not create any new `LaptopUpdateRequest` row.

**Validates: Requirements 1.5**

---

### Property 3: Student list completeness and ordering

*For any* Student who has submitted N update requests, the student list endpoint must return exactly N requests, each containing the request status, submitted new values, and `requestedAt` timestamp, ordered by `requestedAt` descending.

**Validates: Requirements 2.1, 2.2**

---

### Property 4: Duplicate PENDING request prevention

*For any* Laptop that already has a `LaptopUpdateRequest` with status `PENDING`, a second create-update-request call by the same Student for the same laptop must be rejected with a non-2xx response, and the total number of requests for that laptop must remain unchanged.

**Validates: Requirements 2.3**

---

### Property 5: Reviewer list contains full comparison data

*For any* set of `LaptopUpdateRequest` records, the reviewer list endpoint must return each record containing: the current laptop brand, serial number, and photo URL; the proposed new brand, new serial number, and new image; and the owning Student's name and student ID.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 6: Approval updates laptop and resets verification status

*For any* `LaptopUpdateRequest` with status `PENDING`, calling the approve endpoint must: (a) update the `Laptop` row's brand, serial number, and/or photo URL with the non-null new values from the request, (b) set the `Laptop`'s `verificationStatus` to `PENDING`, (c) set the request's status to `APPROVED`, (d) set `reviewedAt` to a non-null timestamp, and (e) set `reviewedById` to the approving Reviewer's user ID.

**Validates: Requirements 4.1, 4.2, 4.3, 6.1**

---

### Property 7: Non-PENDING requests reject approve/reject with 409

*For any* `LaptopUpdateRequest` whose status is `APPROVED` or `REJECTED`, calling either the approve or the reject endpoint must return a 409 Conflict response and must not modify the `Laptop` row or the request record.

**Validates: Requirements 4.4, 5.3**

---

### Property 8: Rejection leaves laptop unchanged

*For any* `LaptopUpdateRequest` with status `PENDING`, calling the reject endpoint must: (a) set the request status to `REJECTED`, (b) set `reviewedAt` to a non-null timestamp, (c) set `reviewedById` to the rejecting Reviewer's user ID, and (d) leave every field of the associated `Laptop` row identical to its pre-rejection state.

**Validates: Requirements 5.1, 5.2**

---

### Property 9: RBAC enforcement

*For any* user with role `STUDENT`, calling the approve or reject endpoints must return 403. *For any* user with role `ADMIN` or `GUARD`, calling the create-update-request endpoint must return 403.

**Validates: Requirements 7.1, 7.2**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| Student submits request for laptop they don't own | 403 | "Forbidden: laptop does not belong to you" |
| Student submits request while one is already PENDING | 409 | "A pending update request already exists for this laptop" |
| No changed fields provided in request body | 400 | "At least one of newBrand, newSerialNumber, or photo must be provided" |
| Approve/reject called on non-PENDING request | 409 | "Request is not in PENDING status" |
| Laptop or request not found | 404 | "Not found" |
| Unauthenticated call | 401 | "No token provided" / "Invalid token" |
| Wrong role | 403 | "Access denied: your role is …" |

All errors follow the existing `{ message: string }` response shape used throughout the codebase.

---

## Testing Strategy

### Property-Based Testing (fast-check + Vitest)

The project already uses **fast-check** for property-based testing and **Vitest** as the test runner (see `backend/package.json` and `backend/src/tests/gate.property.test.js`). All 9 correctness properties above will be implemented as fast-check `asyncProperty` tests following the exact same pattern as the existing gate tests.

Each property-based test must:
- Be tagged with the comment format: `**Feature: laptop-update-request, Property N: <property text>**`
- Run a minimum of **20 iterations** (consistent with existing tests; increase to 50 for critical paths)
- Use the same `makeReqRes` helper pattern to call controllers directly without HTTP overhead
- Clean up all created DB rows in `afterEach` to keep tests isolated

Test file: `backend/src/tests/updateRequest.property.test.js`

### Unit Testing

Unit tests cover specific examples and edge cases not easily expressed as properties:
- Submitting a request with only one changed field (brand only, serial only, photo only)
- Approving a request where only some fields are non-null (partial update)
- Verifying the 404 path when a non-existent request ID is used

Test file: `backend/src/tests/updateRequest.unit.test.js`

### Frontend Testing

The React components are tested manually via the running application. Automated frontend tests are out of scope for this feature.

### Test Isolation

All tests create their own DB rows and delete them in `afterEach`, following the pattern in `gate.property.test.js`. No shared fixtures or mocks are used — tests validate real database behavior.
