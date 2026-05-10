# Implementation Plan

- [x] 1. Database migration — add username to Student, make email nullable
  - Write a new Prisma migration that adds `username TEXT NOT NULL UNIQUE` to the `Student` table
  - Alter `Student.email` to be nullable (drop NOT NULL constraint)
  - Update `backend/prisma/schema.prisma` to add `username String @unique` and change `email` to `email String? @unique`
  - _Requirements: 1.1_

- [x] 2. Backend — update admin student management
- [x] 2.1 Update `createStudent` controller to accept and store `username`
  - Validate `username` is present and non-empty (400 if missing)
  - Insert `username` into the `Student` row
  - Return 409 if `username` already exists (unique constraint)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.2 Write property test for student creation (Property 1 and Property 2)
  - **Property 1: New student records default to not activated with null email**
  - **Property 2: Duplicate student ID or username is rejected on creation**
  - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 3. Backend — update activateStudent endpoint
- [x] 3.1 Update `activateStudent` controller to require both username and student_id
  - Validate both `username` and `student_id` are present and non-empty (400 if either missing)
  - Query `Student` table WHERE `id = $student_id AND username = $username`
  - Return 404 if no matching record found
  - Return 409 if `isActivated = true`
  - Return `{ name, photo, department, username }` — do NOT include email or password
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.3_

- [x] 3.2 Write property tests for activateStudent (Properties 3, 4, 5, 6)
  - **Property 3: Mismatched or unknown username/student_id returns 404 on activate**
  - **Property 4: Already-activated student is rejected on both activation endpoints**
  - **Property 5: Activation lookup returns correct fields and no sensitive data**
  - **Property 6: Missing username or student_id returns 400 on activation endpoints**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 6.3**

- [x] 4. Backend — update setPassword endpoint
- [x] 4.1 Update `setPassword` controller to accept and save email
  - Validate `username`, `student_id`, `email`, and `password` are all present and non-empty (400 if any missing)
  - Return 400 if password length < 6
  - Query `Student` WHERE `id = $student_id AND username = $username`; return 404 if not found, 409 if already activated
  - Hash password with bcrypt (10 rounds)
  - Insert new `User` row with `role = 'STUDENT'`, `studentId`, `name`, `email` from request body
  - Update `Student` SET `isActivated = true`, `email = $email`
  - Return 201 with `{ message, user: { id, name, role } }`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.2, 6.3_

- [x] 4.2 Write property tests for setPassword (Properties 4, 7, 8, 9, 10, 11)
  - **Property 4: Already-activated student is rejected on both activation endpoints**
  - **Property 7: Successful set-password creates a STUDENT User, saves email, and marks student as activated**
  - **Property 8: Password is stored as a bcrypt hash (round-trip)**
  - **Property 9: Passwords shorter than 6 characters are rejected**
  - **Property 10: Duplicate email is rejected on set-password**
  - **Property 11: Missing email returns 400 on set-password**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 6.2**

- [x] 5. Backend — update login to use username path
- [x] 5.1 Update `login` controller to detect `username` in request body
  - If `username` present: look up `Student` by `username`, verify `isActivated = true`, look up linked `User` via `studentId`, compare bcrypt hash, return JWT
  - If `email` present: keep existing email/password path unchanged
  - Return 401 with generic "Invalid credentials" for all failure cases on username path
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.4_

- [x] 5.2 Write property tests for updated login (Properties 12, 13, 14)
  - **Property 12: Username login round-trip**
  - **Property 13: Wrong password at login returns 401**
  - **Property 14: Unactivated student cannot log in via username path**
  - **Validates: Requirements 4.1, 4.3, 4.4, 6.4**

- [x] 6. Backend — add rate limiting to /activate endpoint
  - Install `express-rate-limit` if not already present
  - Create a rate limiter: 10 requests per 15-minute window per IP
  - Apply the limiter to `router.post('/activate', rateLimiter, activateStudent)`
  - Return 429 with `{ message: "Too many attempts, please try again later" }` on breach
  - _Requirements: 6.5_

- [x] 7. Backend — implement password reset flow
- [x] 7.1 Update `forgotPassword` controller for student path
  - Accept `email` in request body
  - Look up `Student` by `email` where `isActivated = true`; return 404 if not found
  - Generate a 6-digit numeric verification code with 15-minute expiry
  - Store code and expiry on the linked `User` record (`verificationCode`, `verificationCodeExpiry`)
  - Send the code to the student's email via the existing email utility
  - _Requirements: 7.1, 7.4_

- [x] 7.2 Implement `resetPassword` controller
  - Accept `email`, `code`, and `newPassword` in request body
  - Look up `Student` by `email`; return 404 if not found
  - Look up linked `User`; verify `verificationCode` matches and `verificationCodeExpiry` is in the future; return 400 if invalid or expired
  - Return 400 if `newPassword` length < 6
  - Hash new password with bcrypt (10 rounds) and update `User.password`
  - Clear `verificationCode` and `verificationCodeExpiry` on the `User` record
  - _Requirements: 7.2, 7.3, 7.5_

- [x] 7.3 Register reset-password route in `auth.routes.js`
  - Add `router.post('/reset-password', resetPassword)`
  - _Requirements: 7.2_

- [x] 7.4 Write property test for password reset round-trip (Property 15)
  - **Property 15: Password reset round-trip**
  - **Validates: Requirements 7.2**

- [x] 8. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend — update Activate.jsx wizard
- [x] 9.1 Update Step 1 to collect both username and student ID
  - Replace single student ID input with two inputs: `username` and `student_id`
  - On submit, send `{ username, student_id }` to `POST /api/auth/activate`
  - Store returned student info (including `username`) in component state
  - _Requirements: 5.1, 5.5_

- [x] 9.2 Update Step 3 to collect email and password
  - Add an `email` input field above the password fields
  - On submit, send `{ username, student_id, email, password }` to `POST /api/auth/set-password`
  - On success, call `POST /api/auth/login` with `{ username, password }` then redirect to `/student`
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 9.3 Write property tests for updated Activate.jsx UI (Properties 16, 17)
  - **Property 16: UI displays student identity after valid username + student ID submission**
  - **Property 17: UI displays error message on backend error response**
  - **Validates: Requirements 5.2, 5.5**

- [x] 10. Frontend — update Login.jsx for username-based student login
  - In student login mode, send `{ username, password }` instead of `{ student_id, password }`
  - Update the input label and placeholder from "Student ID" to "Username"
  - Keep existing email login form and behavior unchanged for GUARD/ADMIN
  - _Requirements: 4.1, 4.5_

- [x] 11. Final Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
