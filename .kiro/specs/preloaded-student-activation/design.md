# Design Document: Preloaded Student Activation

## Overview

This feature replaces the open self-registration flow for students with a controlled, admin-preloaded activation system. An administrator inserts student records (including a unique `username`) into the `Student` table. Students activate their accounts through a three-step frontend flow: enter username + student ID → confirm identity → set email and password. The backend exposes two endpoints (`/activate` and `/set-password`) and updates the login endpoint to support username-based authentication. Email is collected during activation and used exclusively for password reset. The existing email/password login path for GUARD and ADMIN roles is preserved unchanged.

The system is built on the existing PERN stack (PostgreSQL via raw `pg` pool, Express.js, React + Vite). No new frameworks are introduced.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend (React)                  │
│                                                          │
│  /activate  ──►  Step 1: Enter username + student ID    │
│                  Step 2: Confirm identity (name/photo)   │
│                  Step 3: Set email + password            │
│                                                          │
│  /login     ──►  Username + Password    (updated)        │
│                  Email + Password       (unchanged)      │
│                                                          │
│  /forgot-password  ──►  Email → code → new password     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / JSON
┌────────────────────────▼────────────────────────────────┐
│                    Backend (Express.js)                  │
│                                                          │
│  POST /api/auth/activate        (updated — dual fields)  │
│  POST /api/auth/set-password    (updated — adds email)   │
│  POST /api/auth/login           (updated — username path)│
│  POST /api/auth/forgot-password (updated — student path) │
│  POST /api/auth/reset-password  (new)                    │
│  POST /api/auth/register        (kept for GUARD/ADMIN)   │
│                                                          │
│  auth.controller.js  ──►  authUtils.js                  │
└────────────────────────┬────────────────────────────────┘
                         │ pg pool (raw SQL)
┌────────────────────────▼────────────────────────────────┐
│                    PostgreSQL                            │
│                                                          │
│  Student table  (updated: + username, email nullable)    │
│  User table     (unchanged)                              │
└─────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### Backend

#### `auth.controller.js` — updated exports

```js
// Lookup student by username + student_id (both must match same record)
// Returns: { name, photo, department, username }
// Does NOT return email or password
export const activateStudent = async (req, res) => { ... }

// Create User account; saves email on Student; sets isActivated = true
// Body: { username, student_id, email, password }
export const setPassword = async (req, res) => { ... }
```

The `login` export is updated to support a username path:
- If `username` is present in the body → look up `Student` by `username`, verify `isActivated = true`, look up linked `User`, compare bcrypt hash
- If `email` is present → existing email/password path (unchanged for GUARD/ADMIN)

The `forgotPassword` export is updated to look up students by their saved email on the `Student` table (not just `User`).

A new `resetPassword` export handles code verification and password update.

#### `auth.routes.js` — additions

```js
router.post('/activate', rateLimiter, activateStudent)
router.post('/set-password', setPassword)
router.post('/reset-password', resetPassword)
```

#### Rate limiting

The `/activate` endpoint is protected by an Express rate limiter (e.g., `express-rate-limit`): 10 requests per 15-minute window per IP, returning HTTP 429 on breach.

#### Admin student management

`student.controller.js` and `student.routes.js` handle admin CRUD for the `Student` table. The `createStudent` handler now accepts and stores `username`.

```
POST   /api/students          — create student record (requires username)
GET    /api/students          — list all students
GET    /api/students/:id      — get single student
PUT    /api/students/:id      — update student record
DELETE /api/students/:id      — delete student record
```

### Frontend

#### Updated page: `Activate.jsx`

Three-step wizard using local component state:

```
step 1: <IdentityLookupForm>   → username + student_id inputs
                                → calls POST /api/auth/activate
step 2: <IdentityConfirm>      → displays name/photo, "Confirm & Set Password" button
step 3: <SetCredentialsForm>   → email + password + confirm-password inputs
                                → calls POST /api/auth/set-password → login → redirect
```

#### Updated: `Login.jsx`

The student login tab sends `{ username, password }` instead of `{ student_id, password }`.

#### Updated: `App.jsx`

No structural change needed — `/activate` route already exists.

---

## Data Models

### Updated table: `Student`

```sql
ALTER TABLE "Student"
  ADD COLUMN "username" TEXT NOT NULL UNIQUE,
  ALTER COLUMN "email" DROP NOT NULL;   -- email is nullable until activation
```

Full schema after migration:

```sql
CREATE TABLE "Student" (
  "id"          TEXT PRIMARY KEY,          -- student ID e.g. "ETS0001/15"
  "username"    TEXT NOT NULL UNIQUE,      -- admin-assigned login handle
  "name"        TEXT NOT NULL,
  "email"       TEXT UNIQUE,               -- nullable; set during activation
  "photo"       TEXT,
  "department"  TEXT NOT NULL,
  "isActivated" BOOLEAN NOT NULL DEFAULT false
);
```

### Updated Prisma model

```prisma
model Student {
  id          String  @id
  username    String  @unique
  name        String
  email       String? @unique          // nullable until activation
  photo       String?
  department  String
  isActivated Boolean @default(false)
  user        User?
}
```

### `User` table

No schema changes. The `User.email` is populated from the student-provided email at activation time (same as before). The `User.name` is populated from `Student.name`.

### Migration

A new Prisma migration will:
1. Add `username TEXT NOT NULL UNIQUE` to the `Student` table.
2. Make `Student.email` nullable (drop NOT NULL constraint).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

Property 1: New student records default to not activated with null email
*For any* student record created via the admin endpoint, the `isActivated` field should be `false` and the `email` field should be `null`.
**Validates: Requirements 1.2**

---

Property 2: Duplicate student ID or username is rejected on creation
*For any* two student creation requests that share either the same `id` or the same `username`, the second request should return HTTP 409.
**Validates: Requirements 1.3, 1.4**

---

Property 3: Mismatched or unknown username/student_id returns 404 on activate
*For any* pair of (`username`, `student_id`) values where either does not exist in the `Student` table or the two values do not belong to the same record, calling `POST /api/auth/activate` should return HTTP 404.
**Validates: Requirements 2.2, 3.6**

---

Property 4: Already-activated student is rejected on both activation endpoints
*For any* student record where `isActivated = true`, calling `POST /api/auth/activate` should return HTTP 409, and calling `POST /api/auth/set-password` should also return HTTP 409.
**Validates: Requirements 2.3, 3.5, 6.2**

---

Property 5: Activation lookup returns correct fields and no sensitive data
*For any* valid (non-activated) student, calling `POST /api/auth/activate` with the correct `username` and `student_id` should return a response body containing `name`, `photo`, `department`, and `username`, and must NOT contain any field named `password` or `email`.
**Validates: Requirements 2.1, 2.4**

---

Property 6: Missing username or student_id returns 400 on activation endpoints
*For any* request to `POST /api/auth/activate` or `POST /api/auth/set-password` where `username` or `student_id` is absent or an empty string, the system should return HTTP 400.
**Validates: Requirements 2.5, 6.3**

---

Property 7: Successful set-password creates a STUDENT User, saves email, and marks student as activated
*For any* valid student record with `isActivated = false`, a valid email, and a password of 6 or more characters, calling `POST /api/auth/set-password` should result in: a new `User` record with `role = "STUDENT"` and `studentId` matching the student; `Student.isActivated = true`; and `Student.email` equal to the submitted email.
**Validates: Requirements 3.1, 3.3**

---

Property 8: Password is stored as a bcrypt hash (round-trip)
*For any* plaintext password submitted to `POST /api/auth/set-password`, the value stored in `User.password` should satisfy `bcrypt.compare(plaintext, stored) === true`, and the stored value should NOT equal the plaintext string.
**Validates: Requirements 3.2**

---

Property 9: Passwords shorter than 6 characters are rejected
*For any* password string with length strictly less than 6, calling `POST /api/auth/set-password` should return HTTP 400.
**Validates: Requirements 3.4**

---

Property 10: Duplicate email is rejected on set-password
*For any* two set-password requests that provide the same email address, the second request should return HTTP 409.
**Validates: Requirements 3.7**

---

Property 11: Missing email returns 400 on set-password
*For any* request to `POST /api/auth/set-password` where `email` is absent or an empty string, the system should return HTTP 400.
**Validates: Requirements 3.8**

---

Property 12: Username login round-trip
*For any* activated student, logging in with the correct `username` and plaintext password via `POST /api/auth/login` should return a JWT that decodes to a payload containing the correct user `id` and `role = "STUDENT"`.
**Validates: Requirements 4.1, 4.4**

---

Property 13: Wrong password at login returns 401
*For any* activated student, submitting an incorrect password to `POST /api/auth/login` should return HTTP 401 with a generic "Invalid credentials" message.
**Validates: Requirements 4.3**

---

Property 14: Unactivated student cannot log in via username path
*For any* student record with `isActivated = false`, attempting to log in via the username path should return HTTP 401.
**Validates: Requirements 6.4**

---

Property 15: Password reset round-trip
*For any* activated student, requesting a password reset with their saved email, submitting the correct verification code, and setting a new password should allow the student to log in with the new password.
**Validates: Requirements 7.2**

---

Property 16: UI displays student identity after valid username + student ID submission
*For any* valid student data returned by the backend in Step 1, the rendered component should display the student's name and photo before proceeding to the password step.
**Validates: Requirements 5.2**

---

Property 17: UI displays error message on backend error response
*For any* error response returned by the backend during any activation step, the rendered component should display a non-empty, human-readable error message on the current step.
**Validates: Requirements 5.5**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| username or student_id missing | 400 | "username and student_id are required" |
| username/student_id mismatch or not found | 404 | "Student not found" |
| Student already activated | 409 | "Account already activated" |
| Email missing on set-password | 400 | "email is required" |
| Duplicate email | 409 | "Email already in use" |
| Password too short | 400 | "Password must be at least 6 characters" |
| Wrong password / unknown username at login | 401 | "Invalid credentials" |
| Duplicate User creation race condition | 409 | "Account already exists" |
| Rate limit exceeded on /activate | 429 | "Too many attempts, please try again later" |
| Invalid or expired reset code | 400 | "Invalid or expired verification code" |
| Email not found on forgot-password | 404 | "No account found with that email" |
| Internal server error | 500 | "Server error" |

All error responses follow the existing pattern: `{ message: "..." }`.

---

## Testing Strategy

### Property-Based Testing (fast-check)

The backend already has `fast-check` and `vitest` installed. Property-based tests live in `backend/src/tests/`.

Each correctness property above maps to one property-based test. Tests use `fc.assert(fc.asyncProperty(...))` with a minimum of 100 runs per property (20 runs for tests involving bcrypt due to cost).

Each test is annotated with:
```js
// **Feature: preloaded-student-activation, Property N: <property text>**
```

Key generators:
- `fc.string()` for arbitrary usernames, student IDs, and passwords
- `fc.emailAddress()` for arbitrary email values
- `fc.record({ id, username, name, email, ... })` for arbitrary student objects

### Unit Tests

Unit tests cover:
- `activateStudent` controller: valid lookup, 404 (mismatch), 409 (already activated), 400 (missing fields)
- `setPassword` controller: success, duplicate email, short password, missing email, missing ID
- `login` controller: username path success, wrong password, unactivated student
- `resetPassword` controller: valid code, expired code, short new password

### Integration Checkpoints

After each major implementation task, run `vitest run` to confirm all tests pass before proceeding.
