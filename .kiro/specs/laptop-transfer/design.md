# Design Document — Laptop Transfer

## Overview

Admins can reassign a laptop from one student to another through a dedicated transfer API endpoint and a confirmation modal in the Admin Dashboard. Every transfer resets the laptop's verification status to `PENDING` and writes an immutable audit record to a new `LaptopTransferLog` table.

---

## Architecture

```
Admin UI (React)
  └─ TransferLaptopModal
       ├─ Student search (existing /students endpoint)
       └─ POST /api/laptops/:id/transfer
            └─ transferLaptop controller
                 ├─ UPDATE Laptop (ownerId, verificationStatus reset)
                 └─ INSERT LaptopTransferLog
```

The feature is entirely additive: one new DB table, one new controller function, one new route, and one new React modal component.

---

## Components and Interfaces

### Backend

| Component | File | Responsibility |
|---|---|---|
| `transferLaptop` | `backend/src/controllers/laptop.controller.js` | Validates input, executes transfer in a transaction, returns updated laptop |
| `GET /laptops/:id/transfer-logs` | `laptop.routes.js` | Returns transfer history for a laptop |
| `POST /laptops/:id/transfer` | `laptop.routes.js` | Executes the transfer |
| DB migration | `prisma/migrations/…` | Creates `LaptopTransferLog` table |

**Transfer API — POST `/api/laptops/:id/transfer`**

Request body:
```json
{ "targetStudentId": "ETS1234/15" }
```

Success response `200`:
```json
{
  "message": "Laptop transferred successfully",
  "laptop": { "id": "…", "owner_id": "…", "verification_status": "PENDING" }
}
```

Error responses:
- `404` — laptop not found
- `400` — target student has no activated User account
- `403` — caller is not ADMIN

**Transfer History API — GET `/api/laptops/:id/transfer-logs`**

Success response `200`:
```json
[
  {
    "id": "…",
    "laptop_id": "…",
    "from_user_id": "…",
    "from_owner_name": "Abebe Kebede",
    "from_student_id": "ETS1234/15",
    "to_user_id": "…",
    "to_owner_name": "Tigist Alemu",
    "to_student_id": "ETS5678/16",
    "transferred_by_id": "…",
    "transferred_by_name": "Admin Name",
    "transferred_at": "2026-05-13T10:00:00Z"
  }
]
```

### Frontend

| Component | File | Responsibility |
|---|---|---|
| `TransferLaptopModal` | `frontend/src/pages/TransferLaptopModal.jsx` | Confirmation modal with student search and transfer execution |
| `StudentLaptopsPanel` | `frontend/src/pages/StudentLaptopsPanel.jsx` | Add "Transfer" button per laptop; show transfer history |

---

## Data Models

### New table: `LaptopTransferLog`

```sql
CREATE TABLE "LaptopTransferLog" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "laptopId"         TEXT NOT NULL REFERENCES "Laptop"("id") ON DELETE CASCADE,
  "fromUserId"       TEXT NOT NULL REFERENCES "User"("id"),
  "toUserId"         TEXT NOT NULL REFERENCES "User"("id"),
  "transferredById"  TEXT NOT NULL REFERENCES "User"("id"),
  "transferredAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Prisma schema addition

```prisma
model LaptopTransferLog {
  id              String   @id @default(uuid())
  laptopId        String
  laptop          Laptop   @relation(fields: [laptopId], references: [id], onDelete: Cascade)
  fromUserId      String
  fromUser        User     @relation("TransferFrom", fields: [fromUserId], references: [id])
  toUserId        String
  toUser          User     @relation("TransferTo", fields: [toUserId], references: [id])
  transferredById String
  transferredBy   User     @relation("TransferredBy", fields: [transferredById], references: [id])
  transferredAt   DateTime @default(now())

  @@map("laptop_transfer_logs")
}
```

The `Laptop` and `User` models gain back-relation fields:
- `Laptop.transferLogs  LaptopTransferLog[]`
- `User.transfersFrom   LaptopTransferLog[] @relation("TransferFrom")`
- `User.transfersTo     LaptopTransferLog[] @relation("TransferTo")`
- `User.transfersBy     LaptopTransferLog[] @relation("TransferredBy")`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Transfer changes ownership
*For any* laptop and any two distinct activated student users, after a successful transfer from student A to student B, the laptop's `ownerId` MUST equal student B's User ID and MUST NOT equal student A's User ID.
**Validates: Requirements 1.1**

Property 2: Transfer resets verification
*For any* laptop (regardless of its current `verificationStatus`), after a successful transfer, the laptop's `verificationStatus` MUST be `PENDING`, `verifiedAt` MUST be null, and `verifiedById` MUST be null.
**Validates: Requirements 1.2**

Property 3: Transfer creates an audit log entry
*For any* successful transfer, the `LaptopTransferLog` table MUST contain exactly one new entry recording the correct `laptopId`, `fromUserId`, `toUserId`, and `transferredById`.
**Validates: Requirements 1.3**

Property 4: Transfer to non-existent student is rejected
*For any* laptop and any string that does not correspond to an activated User account's `studentId`, the transfer endpoint MUST return a 400 error and the laptop's `ownerId` MUST remain unchanged.
**Validates: Requirements 1.5**

Property 5: Transfer history is ordered descending
*For any* laptop with multiple transfer log entries, the GET transfer-logs endpoint MUST return entries ordered by `transferredAt` descending (most recent first).
**Validates: Requirements 3.1**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| Laptop ID not found | 404 | `"Laptop not found"` |
| Target student ID has no User account | 400 | `"No activated user account found for student <id>"` |
| Caller is not ADMIN | 403 | `"Access denied: your role is \"<role>\""` (existing middleware) |
| DB error during transfer | 500 | `"Server error"` |
| Transfer to current owner | 400 | `"Laptop is already owned by this student"` |

All errors are returned as `{ "message": "…" }` JSON, consistent with the rest of the API.

---

## Testing Strategy

### Property-Based Testing (fast-check + Vitest)

The project already uses **fast-check** with **Vitest**. All property tests live in `backend/src/tests/`.

A new file `backend/src/tests/laptop-transfer.property.test.js` will implement the five correctness properties above. Each test runs a minimum of **100 iterations**.

Each property-based test is tagged with:
```
**Feature: laptop-transfer, Property N: <property text>**
**Validates: Requirements X.Y**
```

Because the transfer logic is pure SQL (no ORM at runtime), tests will exercise the controller functions directly against a test database, or use in-memory stubs that mirror the SQL semantics.

### Unit Tests

Unit tests cover:
- Input validation: missing `targetStudentId`, laptop not found, student not found, transfer to self/current owner.
- The transfer log shape returned by the history endpoint.

Unit tests are co-located in the same `backend/src/tests/` directory.

### Frontend Tests

The `TransferLaptopModal` component will have a Vitest + jsdom unit test verifying:
- The modal renders current owner info.
- Submitting with no student selected shows a validation error.
- A successful API response closes the modal and calls the refresh callback.
- An API error is displayed inline without closing the modal.
