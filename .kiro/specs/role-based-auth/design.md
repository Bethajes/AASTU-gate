# Design Document: Role-Based Authentication

## Overview

This design hardens the authentication layer of the AASTU Laptop Gate Management System. The core change is simple: the public `POST /api/auth/register` endpoint is locked to `STUDENT` creation only. Any attempt to supply a `role` field is rejected with a 403. GUARD and ADMIN accounts are provisioned exclusively through a Prisma seed script. The frontend registration form is stripped of its role selector. Existing login, JWT issuance, and route-level role guards remain structurally unchanged but are reviewed and tightened.

---

## Architecture

The system follows a standard layered Express + React architecture. No new layers are introduced — only targeted modifications to existing components.

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│  Register (student-only form)  │  Login (all roles) │
└────────────────────┬────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────┐
│                  Express Backend                     │
│                                                      │
│  POST /api/auth/register  ──► auth.controller.js     │
│    • Rejects role field (403)                        │
│    • Forces role = STUDENT                           │
│                                                      │
│  POST /api/auth/login     ──► auth.controller.js     │
│    • Unchanged — all roles                           │
│    • JWT: { id, role, gate_id? }                     │
│                                                      │
│  Protected routes ──► auth.middleware.js             │
│    protect()      — validates JWT                    │
│    allowRoles()   — enforces role whitelist          │
└────────────────────┬────────────────────────────────┘
                     │ Prisma / pg
┌────────────────────▼────────────────────────────────┐
│              PostgreSQL (via Prisma)                 │
│  User table: id, name, email, password, role, ...    │
│  Seed script: 3 GUARDs + 1 ADMIN (bcrypt hashed)    │
└─────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### 1. `auth.controller.js` — `register` function

Current behavior: destructures `role` from `req.body` and passes it to the INSERT.

New behavior:
- Destructure only `{ name, email, password, studentId }` from `req.body`
- Check `if (req.body.role)` → return 403
- Hardcode `role = 'STUDENT'` in the INSERT
- Add duplicate-email error handling (catch unique constraint → 409)

### 2. `auth.controller.js` — `login` function

No structural changes. The JWT payload already includes `id` and `role`. We add `gate_id` to the payload when the user is a GUARD (sourced from the User record if a `gateId` field is added to the schema, or derived from the user's name as a fallback).

### 3. `auth.middleware.js`

No changes needed. `protect` and `allowRoles` already work correctly.

### 4. `prisma/seed.js` (new file)

Creates:
- 3 GUARD accounts: `guard.gate1@aastu.edu`, `guard.gate2@aastu.edu`, `guard.gate3@aastu.edu`
- 1 ADMIN account: `admin@aastu.edu`

Uses `prisma.user.upsert` (match on email) so re-running is safe.

### 5. `frontend/src/pages/Register.jsx`

- Remove `role` from state
- Remove the `<select>` role field
- Remove the conditional `studentId` block (always show it)
- Send only `{ name, email, password, studentId }` in the POST body

---

## Data Models

No schema changes are required. The existing Prisma `User` model already has:

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  studentId String?  @unique
  email     String   @unique
  password  String
  role      Role     @default(STUDENT)   // default enforces STUDENT
  createdAt DateTime @default(now())
  ...
}

enum Role {
  STUDENT
  GUARD
  ADMIN
}
```

The `role` column default of `STUDENT` provides a database-level safety net in addition to the controller-level enforcement.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property-based testing library:** `fast-check` (JavaScript) — run via `vitest` with a minimum of 100 iterations per property.

---

Property 1: Register always produces STUDENT role

*For any* valid registration payload (arbitrary name, email, password combinations), the created user's role SHALL always equal `STUDENT`, regardless of what other fields are present in the request body.

**Validates: Requirements 1.1, 1.4**

---

Property 2: Role field in request body is always rejected

*For any* registration request body that contains a `role` field (with any value — `STUDENT`, `GUARD`, `ADMIN`, or arbitrary strings), the register handler SHALL return HTTP 403.

**Validates: Requirements 1.2**

---

Property 3: Missing required fields are always rejected

*For any* registration request body missing one or more of `name`, `email`, or `password`, the register handler SHALL return HTTP 400.

**Validates: Requirements 1.3**

---

Property 4: Login with wrong credentials always returns 401

*For any* email/password pair where the password does not match the stored bcrypt hash, the login handler SHALL return HTTP 401 with `"Invalid credentials"`.

**Validates: Requirements 3.2**

---

Property 5: Role-based route access is enforced for all roles

*For any* protected route with a role whitelist, a request carrying a JWT whose role is NOT in the whitelist SHALL receive HTTP 403, and a request whose role IS in the whitelist SHALL be permitted.

**Validates: Requirements 5.1, 5.2, 5.3**

---

Property 6: Duplicate email registration is always rejected

*For any* email address already present in the database, a subsequent registration attempt with the same email SHALL return HTTP 409.

**Validates: Requirements 1.5**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| `role` field present in register body | 403 | `"Role assignment is not allowed"` |
| Missing name/email/password | 400 | `"Name, email, and password are required"` |
| Duplicate email | 409 | `"Email already in use"` |
| Invalid login credentials | 401 | `"Invalid credentials"` |
| Missing login fields | 400 | `"Email and password are required"` |
| No JWT on protected route | 401 | `"No token provided"` |
| Invalid/expired JWT | 401 | `"Invalid token"` |
| Wrong role for route | 403 | `"Access denied: your role is \"<role>\""` |

---

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and edge cases:

- Register with a valid student payload → 201, role is STUDENT
- Register with `role: "ADMIN"` in body → 403
- Register with `role: "STUDENT"` in body → 403 (role field is never allowed)
- Register with missing password → 400
- Register with duplicate email → 409
- Login with correct credentials → 200, JWT contains correct role
- Login with wrong password → 401
- `allowRoles` middleware: correct role passes, wrong role returns 403

### Property-Based Tests (fast-check, min 100 iterations each)

Each property test is tagged with the format: `**Feature: role-based-auth, Property {N}: {text}**`

- **Property 1** — Generate arbitrary `{ name, email, password }` payloads (no role field). For each, call the register handler and assert the returned user has `role === 'STUDENT'`.
- **Property 2** — Generate arbitrary payloads that include a `role` field (any string value). For each, assert the handler returns 403.
- **Property 3** — Generate payloads with one or more of `name`/`email`/`password` omitted. For each, assert the handler returns 400.
- **Property 4** — Generate arbitrary email/password pairs that do not match any seeded user. For each, assert login returns 401.
- **Property 5** — Generate arbitrary role strings not in a route's whitelist. For each, assert `allowRoles` middleware returns 403. Generate roles that ARE in the whitelist and assert they pass.
- **Property 6** — For any email already registered, assert a second registration attempt returns 409.

Unit tests and property tests are complementary: unit tests catch concrete bugs in specific scenarios, property tests verify the general rules hold across the full input space.
