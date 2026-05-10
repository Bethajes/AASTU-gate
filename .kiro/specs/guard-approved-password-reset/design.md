# Design Document: Guard-Approved Password Reset

## Overview

The guard-approved password reset system replaces the existing insecure `forgotPassword` endpoint (which allows direct password reset without any verification) with a three-step flow:

1. Student requests a reset (sets a flag on their account)
2. Guard physically verifies the student and approves the request (sets approval + expiry)
3. Student submits a new password within the approval window

This design integrates into the existing PERN stack (PostgreSQL via raw `pg` pool, Express.js, React) without introducing new dependencies beyond what is already present.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                               │
│                                                                 │
│  ForgotPassword.jsx  ──POST /api/auth/request-reset──►         │
│  ResetPassword.jsx   ──POST /api/auth/reset-password──►        │
│  GuardDashboard.jsx  ──GET  /api/auth/reset-requests──►        │
│                      ──POST /api/auth/approve-reset──►         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Express.js)                                           │
│                                                                 │
│  auth.routes.js                                                 │
│    POST /request-reset   → requestReset()                       │
│    POST /approve-reset   → approveReset()  [GUARD/ADMIN only]  │
│    POST /reset-password  → resetPassword()                      │
│    GET  /reset-requests  → getResetRequests() [GUARD/ADMIN]    │
│                                                                 │
│  auth.controller.js  →  PostgreSQL ("User" table)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                     │
│  "User" table + 4 new columns                                   │
│  "PasswordResetLog" table (audit)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### Backend

#### `auth.controller.js` — new exports

| Function | Method | Route | Auth |
|---|---|---|---|
| `requestReset` | POST | `/api/auth/request-reset` | Public |
| `approveReset` | POST | `/api/auth/approve-reset` | GUARD / ADMIN |
| `resetPassword` | POST | `/api/auth/reset-password` | Public |
| `getResetRequests` | GET | `/api/auth/reset-requests` | GUARD / ADMIN |

**requestReset(req, res)**
- Input: `{ email }`
- Finds user by email; returns 404 if not found
- Sets `resetRequested = true`, `resetApproved = false`
- Logs the event to `PasswordResetLog`
- Returns 200 with message to visit the gate

**approveReset(req, res)**
- Input: `{ studentId }` (the student's `studentId` field)
- Requires `protect` + `allowRoles('GUARD', 'ADMIN')` middleware
- Finds user by `studentId`; returns 404 if not found
- Verifies `resetRequested = true`; returns 400 if no pending request
- Sets `resetApproved = true`, `resetApprovedBy = req.user.id`, `resetApprovalExpiry = NOW() + 10 min`
- Logs the event to `PasswordResetLog`
- Returns 200 with success message

**resetPassword(req, res)**
- Input: `{ email, newPassword }`
- Finds user by email; returns 404 if not found
- Validates `resetApproved = true`; returns 403 if not approved
- Validates `resetApprovalExpiry > NOW()`; returns 403 if expired
- Hashes `newPassword` with bcrypt (salt rounds: 10)
- Updates `password`, clears all four reset fields
- Logs the event to `PasswordResetLog`
- Returns 200 with success message

**getResetRequests(req, res)**
- Requires `protect` + `allowRoles('GUARD', 'ADMIN')` middleware
- Returns all users where `resetRequested = true` and `resetApproved = false`
- Returns: `id`, `name`, `studentId`, `email`, `createdAt` (of the request — use `resetRequestedAt`)

#### `auth.routes.js` — additions

```js
router.get('/reset-requests', protect, allowRoles('GUARD', 'ADMIN'), getResetRequests)
router.post('/request-reset', requestReset)
router.post('/approve-reset', protect, allowRoles('GUARD', 'ADMIN'), approveReset)
router.post('/reset-password', resetPassword)
```

The existing `POST /forgot-password` route is replaced by the new three-step flow. The old route will be removed.

### Frontend

#### `ForgotPassword.jsx` — reworked

- Single email input field
- On submit: `POST /api/auth/request-reset`
- On success: show message "Your request has been submitted. Please go to the gate for physical verification."
- No password fields on this page

#### `ResetPassword.jsx` — reworked

- Fields: email, new password, confirm password
- No OTP/code field
- On submit: `POST /api/auth/reset-password`
- On success: redirect to `/login`
- On failure: show error (e.g. "Approval expired" or "Not approved yet")

#### `GuardDashboard.jsx` — new tab added

- New tab: "🔑 Password Resets"
- Fetches `GET /api/auth/reset-requests` on tab open
- Displays a list of pending requests: student name, student ID, email
- Each row has an "Approve Reset" button
- On approve: `POST /api/auth/approve-reset` with `{ studentId }`
- On success: remove the row from the list and show a success toast

---

## Data Models

### User table — new columns (raw SQL migration)

```sql
ALTER TABLE "User"
  ADD COLUMN "resetRequested"     BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN "resetApproved"      BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN "resetApprovedBy"    TEXT,
  ADD COLUMN "resetApprovalExpiry" TIMESTAMPTZ,
  ADD COLUMN "resetRequestedAt"   TIMESTAMPTZ;
```

> Note: The project uses raw `pg` queries (not Prisma migrations at runtime), so the schema.prisma file will also be updated to keep it in sync, and the migration SQL will be applied directly.

### PasswordResetLog table (audit)

```sql
CREATE TABLE "PasswordResetLog" (
  "id"          TEXT        PRIMARY KEY,
  "userId"      TEXT        NOT NULL REFERENCES "User"("id"),
  "action"      TEXT        NOT NULL,  -- 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
  "performedBy" TEXT,                  -- guard/admin id for APPROVED; null for others
  "reason"      TEXT,                  -- rejection reason if REJECTED
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Request reset sets correct flags
*For any* user account, after calling `requestReset`, the user's `resetRequested` field must be `true` and `resetApproved` must be `false`.
**Validates: Requirements 1.1, 1.2**

Property 2: Non-guard cannot approve
*For any* user with role STUDENT, an attempt to call `approveReset` must be rejected with an authorization error (HTTP 401 or 403).
**Validates: Requirements 2.5**

Property 3: Approval sets correct fields
*For any* user with a pending reset request, after a guard calls `approveReset`, the user's `resetApproved` must be `true`, `resetApprovedBy` must equal the guard's ID, and `resetApprovalExpiry` must be approximately 10 minutes in the future.
**Validates: Requirements 2.2, 2.3, 2.4, 5.4**

Property 4: Reset without approval is rejected
*For any* user whose `resetApproved` is `false`, a call to `resetPassword` must be rejected with a 403 error.
**Validates: Requirements 3.7**

Property 5: Reset after expiry is rejected
*For any* user whose `resetApprovalExpiry` is in the past, a call to `resetPassword` must be rejected with a 403 error.
**Validates: Requirements 3.8, 5.2**

Property 6: Successful reset clears all reset fields
*For any* user with a valid (approved, non-expired) reset, after `resetPassword` completes successfully, all four reset fields (`resetRequested`, `resetApproved`, `resetApprovedBy`, `resetApprovalExpiry`) must be reset to their default values.
**Validates: Requirements 3.3, 3.4, 3.5, 3.6**

Property 7: Password is hashed after reset
*For any* new password string submitted via `resetPassword`, the stored password in the database must not equal the plaintext string, and `bcrypt.compare(plaintext, stored)` must return `true`.
**Validates: Requirements 3.1**

Property 8: Every reset action produces an audit log entry
*For any* call to `requestReset`, `approveReset`, or `resetPassword` (success or rejection), a corresponding row must be inserted into `PasswordResetLog` with the correct `action` value.
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| Email not found on request-reset | 404 | "No account found with that email" |
| Student ID not found on approve-reset | 404 | "No account found with that student ID" |
| No pending request on approve-reset | 400 | "No pending reset request for this user" |
| Not approved on reset-password | 403 | "Password reset has not been approved by a guard" |
| Approval expired on reset-password | 403 | "Reset approval has expired. Please request a new reset." |
| Passwords don't match (frontend) | — | "Passwords do not match" (client-side only) |
| Non-guard calls approve-reset | 403 | "Access denied" (from existing allowRoles middleware) |

---

## Testing Strategy

### Property-Based Testing

The project uses **Vitest** (already configured in `frontend/vite.config.js`) for frontend tests. For backend property-based testing, we will use **fast-check** — a mature PBT library for JavaScript/TypeScript.

- Install: `npm install --save-dev fast-check` in the `backend` directory
- Each property-based test runs a minimum of **100 iterations**
- Each PBT is tagged with the format: `// Feature: guard-approved-password-reset, Property N: <property text>`

**Properties to implement as PBTs (backend):**

| Property | Test description |
|---|---|
| Property 1 | Generate random valid emails; call requestReset; assert flags |
| Property 2 | Generate random STUDENT-role tokens; call approveReset; assert 403 |
| Property 3 | Generate random guard IDs and student accounts; call approveReset; assert fields |
| Property 4 | Generate users with resetApproved=false; call resetPassword; assert 403 |
| Property 5 | Generate users with expired resetApprovalExpiry; call resetPassword; assert 403 |
| Property 6 | Generate valid approved users; call resetPassword; assert all fields cleared |
| Property 7 | Generate random password strings; call resetPassword; assert bcrypt round-trip |
| Property 8 | Call each reset action; assert PasswordResetLog row exists with correct action |

### Unit Tests

- `requestReset`: email not found → 404
- `approveReset`: no pending request → 400
- `resetPassword`: not approved → 403, expired → 403, success → 200
- `getResetRequests`: returns only pending (resetRequested=true, resetApproved=false) users

### Frontend Tests (Vitest + React Testing Library)

- `ForgotPassword`: renders email field, shows gate message on success
- `ResetPassword`: renders password fields, redirects on success, shows error on failure
- `GuardDashboard` password reset tab: renders pending list, approve button triggers API call
