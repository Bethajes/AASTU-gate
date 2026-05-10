# Implementation Plan

- [ ] 1. Database migration — add reset columns and audit table
  - Add `resetRequested`, `resetApproved`, `resetApprovedBy`, `resetApprovalExpiry`, `resetRequestedAt` columns to the `"User"` table via raw SQL
  - Create the `"PasswordResetLog"` table with columns: `id`, `userId`, `action`, `performedBy`, `reason`, `createdAt`
  - Update `backend/prisma/schema.prisma` to reflect the new columns and table (keeps schema in sync)
  - _Requirements: 1.1, 1.2, 2.2, 2.3, 2.4, 3.3–3.6, 4.1–4.4_

- [ ] 2. Backend — auth controller new endpoints
- [ ] 2.1 Implement `requestReset` controller function
  - Accept `{ email }`, find user, set `resetRequested=true`, `resetApproved=false`, `resetRequestedAt=NOW()`
  - Insert a `REQUESTED` row into `PasswordResetLog`
  - Return 200 with gate-visit message; 404 if email not found
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_

- [ ]* 2.2 Write property test for requestReset (Property 1)
  - **Property 1: Request reset sets correct flags**
  - **Validates: Requirements 1.1, 1.2**

- [ ] 2.3 Implement `approveReset` controller function
  - Accept `{ studentId }`, find user, verify `resetRequested=true`
  - Set `resetApproved=true`, `resetApprovedBy=req.user.id`, `resetApprovalExpiry=NOW()+10min`
  - Insert an `APPROVED` row into `PasswordResetLog`
  - Return 400 if no pending request; 404 if student not found
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 4.2, 5.4_

- [ ]* 2.4 Write property test for approveReset authorization (Property 2)
  - **Property 2: Non-guard cannot approve**
  - **Validates: Requirements 2.5**

- [ ]* 2.5 Write property test for approveReset field correctness (Property 3)
  - **Property 3: Approval sets correct fields**
  - **Validates: Requirements 2.2, 2.3, 2.4, 5.4**

- [ ] 2.6 Implement `resetPassword` controller function
  - Accept `{ email, newPassword }`, find user, validate `resetApproved=true` and `resetApprovalExpiry > NOW()`
  - Hash password with bcrypt (10 rounds), update `password`, clear all four reset fields
  - Insert a `COMPLETED` or `REJECTED` row into `PasswordResetLog`
  - Return 403 if not approved or expired; 404 if email not found
  - _Requirements: 3.1–3.9, 4.3, 4.4, 5.1, 5.2_

- [ ]* 2.7 Write property test for resetPassword rejection cases (Properties 4 & 5)
  - **Property 4: Reset without approval is rejected**
  - **Property 5: Reset after expiry is rejected**
  - **Validates: Requirements 3.7, 3.8, 5.2**

- [ ]* 2.8 Write property test for resetPassword success (Properties 6 & 7)
  - **Property 6: Successful reset clears all reset fields**
  - **Property 7: Password is hashed after reset**
  - **Validates: Requirements 3.1–3.6**

- [ ]* 2.9 Write property test for audit logging (Property 8)
  - **Property 8: Every reset action produces an audit log entry**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 2.10 Implement `getResetRequests` controller function
  - Query users where `resetRequested=true` AND `resetApproved=false`
  - Return `id`, `name`, `studentId`, `email`, `resetRequestedAt`
  - _Requirements: 2.1_

- [ ] 3. Backend — wire up routes
  - Add the four new routes to `backend/src/routes/auth.routes.js`
  - Apply `protect` + `allowRoles('GUARD', 'ADMIN')` middleware to `approve-reset` and `reset-requests`
  - Remove the old `POST /forgot-password` route
  - _Requirements: 2.5_

- [ ] 4. Checkpoint — ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Frontend — rework ForgotPassword page
  - Replace the current multi-field form with a single email input
  - On submit call `POST /api/auth/request-reset`
  - On success display: "Your request has been submitted. Please go to the gate for physical verification by a guard."
  - On error display the API error message
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 5.1 Write unit test for ForgotPassword component
  - Renders email field; shows gate message on success; shows error on failure
  - _Requirements: 6.1–6.4_

- [ ] 6. Frontend — rework ResetPassword page
  - Remove the OTP/code field; keep email, new password, confirm password fields
  - On submit call `POST /api/auth/reset-password`
  - On success redirect to `/login`
  - On error display the API error message (e.g. "Approval expired")
  - _Requirements: 8.1–8.5_

- [ ]* 6.1 Write unit test for ResetPassword component
  - Renders password fields; redirects on success; shows error on failure
  - _Requirements: 8.1–8.5_

- [ ] 7. Frontend — add Password Resets tab to GuardDashboard
  - Add a new "🔑 Password Resets" tab alongside existing tabs
  - On tab open, fetch `GET /api/auth/reset-requests`
  - Render a list showing student name, student ID, email, and request time
  - Each row has an "Approve Reset" button that calls `POST /api/auth/approve-reset` with `{ studentId }`
  - On success remove the row and show a success message; on error show an error message
  - _Requirements: 7.1–7.5_

- [ ]* 7.1 Write unit test for GuardDashboard password reset tab
  - Renders pending list; approve button triggers API call and updates UI
  - _Requirements: 7.1–7.5_

- [ ] 8. Final Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
