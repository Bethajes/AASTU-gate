# Implementation Plan

- [x] 1. Update Prisma schema and run migration
  - Add `isVerified Boolean @default(false)`, `verificationCode String?`, `verificationCodeExpiry DateTime?` to the `User` model in `backend/prisma/schema.prisma`
  - Run `npx prisma migrate dev --name add_email_verification` to apply the migration
  - _Requirements: 2.3, 2.5_

- [-] 2. Create auth utility functions
  - [x] 2.1 Implement `isInstitutionalEmail(email)` in `backend/src/lib/authUtils.js`
    - Validate against regex `/^[a-zA-Z]+\.[a-zA-Z]+@aastustudent\.edu\.et$/`
    - Export `generateOTP()` returning a random 6-digit numeric string
    - Export `generateOTPExpiry()` returning `new Date(Date.now() + 10 * 60 * 1000)`
    - _Requirements: 1.1, 2.1, 2.2_
  - [ ] 2.2 Write property tests for auth utility functions
    - **Property 1: Institutional email validation rejects non-conforming addresses**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: OTP is always a 6-digit numeric string**
    - **Validates: Requirements 2.1**
    - **Property 3: OTP expiry is always in the future at time of generation**
    - **Validates: Requirements 2.2**

- [x] 3. Create email service
  - [x] 3.1 Implement `backend/src/lib/email.service.js`
    - Install nodemailer: `npm install nodemailer` in backend
    - Create `sendVerificationEmail(to, code)` using `EMAIL_USER` and `EMAIL_PASS` env vars
    - Subject: "Verify your AASTU account", body: "Your verification code is: {code}"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [-] 4. Update register controller
  - [x] 4.1 Add email domain validation to `register` in `backend/src/controllers/auth.controller.js`
    - Call `isInstitutionalEmail(email)` before proceeding; return 400 with "Only AASTU institutional emails are allowed" if invalid
    - Generate OTP and expiry using `generateOTP()` and `generateOTPExpiry()`
    - Store `isVerified: false`, `verificationCode`, `verificationCodeExpiry` on user insert
    - Call `sendVerificationEmail` after user creation
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ] 4.2 Write unit tests for updated register
    - Test rejection of non-institutional email
    - Test successful registration stores isVerified=false and a code
    - _Requirements: 1.2, 2.5_

- [-] 5. Add verifyEmail and resendCode controllers
  - [x] 5.1 Implement `verifyEmail(req, res)` in `auth.controller.js`
    - Accept `{ email, code }` in request body
    - Find user by email; return 404 if not found
    - Check code match and expiry; return 400 on mismatch or expiry
    - On success: set `isVerified=true`, clear `verificationCode` and `verificationCodeExpiry`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [ ] 5.2 Write property tests for verifyEmail logic
    - **Property 5: Expired codes are rejected**
    - **Validates: Requirements 3.3, 3.6**
    - **Property 6: Verified users have cleared OTP fields**
    - **Validates: Requirements 3.4, 3.5**
  - [x] 5.3 Implement `resendCode(req, res)` in `auth.controller.js`
    - Accept `{ email }` in request body
    - Find user by email; return 404 if not found
    - Generate new OTP and expiry, update DB, send email
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [-] 6. Update login controller
  - [x] 6.1 Add `isVerified` check to `login` in `auth.controller.js`
    - After credential validation, check `user.isVerified`; return 403 with "Please verify your email first" if false
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 6.2 Write property test for login guard
    - **Property 7: Unverified users cannot obtain a JWT**
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. Update auth routes
  - Add `POST /api/auth/verify-email` and `POST /api/auth/resend-code` routes to `backend/src/routes/auth.routes.js`
  - Import and wire `verifyEmail` and `resendCode` from the controller
  - _Requirements: 3.1, 5.1_

- [ ] 8. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update frontend Register page
  - [x] 9.1 Update `frontend/src/pages/Register.jsx`
    - On successful registration response, navigate to `/verify-email` passing `{ state: { email } }` instead of `/login`
    - Update email placeholder to `firstname.fathername@aastustudent.edu.et`
    - _Requirements: 6.1_

- [x] 10. Create VerifyEmail page
  - [x] 10.1 Create `frontend/src/pages/VerifyEmail.jsx`
    - Read `email` from React Router location state
    - Render a 6-digit code input field, a Submit button, and a Resend Code button
    - On submit: call `POST /api/auth/verify-email`; show success message and navigate to `/login` on success; show error message on failure
    - On resend: call `POST /api/auth/resend-code`; show confirmation message
    - Match existing card/style conventions from `Register.jsx`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Update App.jsx routing
  - Import `VerifyEmail` and add `<Route path="/verify-email" element={<VerifyEmail />} />` to `frontend/src/App.jsx`
  - _Requirements: 6.1_

- [ ] 12. Final Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
