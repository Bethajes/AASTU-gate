# Implementation Plan

- [ ] 1. Harden the register endpoint in the backend
  - In `backend/src/controllers/auth.controller.js`, remove `role` from destructuring
  - Add check: `if (req.body.role) return res.status(403).json({ message: 'Role assignment is not allowed' })`
  - Hardcode `role = 'STUDENT'` in both the Prisma-style and fallback INSERT paths
  - Add duplicate-email error handling: catch unique constraint violation and return 409 with `"Email already in use"`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 1.1 Write property test: register always produces STUDENT role
  - **Property 1: Register always produces STUDENT role**
  - Use `fast-check` to generate arbitrary `{ name, email, password }` payloads and assert returned user has `role === 'STUDENT'`
  - Tag: `**Feature: role-based-auth, Property 1: Register always produces STUDENT role**`
  - **Validates: Requirements 1.1, 1.4**

- [ ] 1.2 Write property test: role field in request body is always rejected
  - **Property 2: Role field in request body is always rejected**
  - Use `fast-check` to generate arbitrary payloads containing a `role` field (any string value) and assert 403 is returned
  - Tag: `**Feature: role-based-auth, Property 2: Role field in request body is always rejected**`
  - **Validates: Requirements 1.2**

- [ ] 1.3 Write property test: missing required fields always return 400
  - **Property 3: Missing required fields are always rejected**
  - Use `fast-check` to generate payloads with one or more of `name`/`email`/`password` omitted and assert 400 is returned
  - Tag: `**Feature: role-based-auth, Property 3: Missing required fields are always rejected**`
  - **Validates: Requirements 1.3**

- [ ] 1.4 Write property test: duplicate email always returns 409
  - **Property 6: Duplicate email registration is always rejected**
  - Register a user, then attempt to register again with the same email and assert 409
  - Tag: `**Feature: role-based-auth, Property 6: Duplicate email registration is always rejected**`
  - **Validates: Requirements 1.5**

- [ ] 2. Update the login endpoint to include gate_id in JWT
  - In `backend/src/controllers/auth.controller.js`, update the `login` function
  - When the authenticated user has `role === 'GUARD'`, include `gate_id` (derived from user record) in the JWT payload
  - _Requirements: 3.1, 3.4_

- [ ] 2.1 Write property test: wrong credentials always return 401
  - **Property 4: Login with wrong credentials always returns 401**
  - Use `fast-check` to generate arbitrary email/password pairs that do not match any seeded user and assert 401
  - Tag: `**Feature: role-based-auth, Property 4: Login with wrong credentials always returns 401**`
  - **Validates: Requirements 3.2**

- [ ] 3. Create the Prisma seed script for GUARD and ADMIN accounts
  - Create `backend/prisma/seed.js`
  - Use `bcrypt.hash` with cost factor 10 to hash passwords
  - Use `prisma.user.upsert` (match on email) to create 3 GUARD accounts (`guard.gate1@aastu.edu`, `guard.gate2@aastu.edu`, `guard.gate3@aastu.edu`) and 1 ADMIN account (`admin@aastu.edu`)
  - Add `"prisma": { "seed": "node prisma/seed.js" }` to `backend/package.json`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update the frontend registration form
  - In `frontend/src/pages/Register.jsx`, remove `role` from the initial state object
  - Remove the `<select>` role field and its label from the JSX
  - Remove the conditional `studentId` block — always render the Student ID field
  - Ensure the `handleSubmit` function sends only `{ name, email, password, studentId }` (no `role`)
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5.1 Write property test: role-based route access is enforced for all roles
  - **Property 5: Role-based route access is enforced for all roles**
  - Use `fast-check` to generate role strings not in a route's whitelist and assert `allowRoles` middleware returns 403; generate roles that ARE in the whitelist and assert they pass
  - Tag: `**Feature: role-based-auth, Property 5: Role-based route access is enforced for all roles**`
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 6. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.
