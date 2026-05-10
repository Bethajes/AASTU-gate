# Requirements Document

## Introduction

This feature refactors the student account activation system to use official AASTU institutional email verification. Instead of accepting any email during password setup, students must prove ownership of an official `@aastustudent.edu.et` email address via a one-time password (OTP) sent through Gmail SMTP before they are allowed to create a password. The existing admin preload system, guard verification, and laptop systems remain unchanged. Manual student self-registration is removed entirely.

## Glossary

- **Activation System**: The multi-step flow through which a preloaded student claims and activates their account.
- **Student**: A person whose record has been preloaded by an admin with `student_id`, `username`, `full_name`, `department`, and `photo`.
- **Student ID**: The official AASTU identifier for a student, formatted as `ETS###/##` (e.g. `ETS023/15`).
- **Institutional Email**: An email address ending with `@aastustudent.edu.et`, issued by AASTU to enrolled students.
- **OTP**: A one-time password — a 6-digit numeric code generated for a single verification session.
- **OTP Expiry**: The point in time after which an OTP is no longer valid; set to 5 minutes from generation.
- **Activation Wizard**: The multi-step frontend UI guiding a student through the activation flow.
- **isActivated**: A boolean flag on the `Student` record indicating whether the student has completed account activation.
- **User Record**: The `User` table row created upon successful activation, holding credentials and role.
- **Nodemailer**: The Node.js library used to send emails via Gmail SMTP.
- **bcrypt**: The password hashing algorithm used to store passwords securely.
- **Rate Limiter**: Middleware that restricts the number of requests from a single IP within a time window.
- **Password Reset**: A flow allowing an already-activated student to regain access using their institutional email OTP.

---

## Requirements

### Requirement 1 — Student ID Lookup

**User Story:** As a student, I want to enter my student ID to begin activation, so that the system can identify me from the preloaded records.

#### Acceptance Criteria

1. WHEN a student submits a student ID, THE Activation System SHALL query the `Student` table for a record matching that ID.
2. WHEN a matching, non-activated student record is found, THE Activation System SHALL return the student's `full_name`, `department`, and `photo` for display.
3. WHEN no matching student record is found, THE Activation System SHALL return a 404 response with a descriptive error message.
4. WHEN the student record has `isActivated = true`, THE Activation System SHALL return a 409 response indicating the account is already activated.
5. WHEN the student ID field is empty or whitespace-only, THE Activation System SHALL return a 400 response without querying the database.

---

### Requirement 2 — Identity Confirmation Display

**User Story:** As a student, I want to see my photo, full name, and department after entering my student ID, so that I can confirm the system has identified me correctly before proceeding.

#### Acceptance Criteria

1. WHEN the student ID lookup succeeds, THE Activation Wizard SHALL display the student's photo, full name, and department on the identity confirmation step.
2. WHEN no photo is available for the student, THE Activation Wizard SHALL display a placeholder with the student's initials.
3. WHEN the student confirms their identity, THE Activation Wizard SHALL advance to the email input step.

---

### Requirement 3 — Institutional Email Validation

**User Story:** As a student, I want to enter my official AASTU email address, so that the system can verify I am a legitimate enrolled student.

#### Acceptance Criteria

1. WHEN a student submits an email address, THE Activation System SHALL validate that the email ends with `@aastustudent.edu.et`.
2. WHEN the submitted email does not end with `@aastustudent.edu.et`, THE Activation System SHALL return a 400 response rejecting the email.
3. WHEN the submitted email is already associated with an existing activated account, THE Activation System SHALL return a 409 response indicating the email is already in use.
4. WHEN the email passes domain validation, THE Activation System SHALL generate a 6-digit numeric OTP and store it with a 5-minute expiry.
5. WHEN the OTP is generated, THE Activation System SHALL send the OTP to the submitted institutional email using Nodemailer with Gmail SMTP.

---

### Requirement 4 — OTP Verification

**User Story:** As a student, I want to enter the OTP sent to my email, so that I can prove ownership of my institutional email address.

#### Acceptance Criteria

1. WHEN a student submits an OTP, THE Activation System SHALL compare it against the stored OTP for that student session.
2. WHEN the submitted OTP matches the stored OTP and has not expired, THE Activation System SHALL mark the email as verified and advance the session to the password creation step.
3. WHEN the submitted OTP does not match the stored OTP, THE Activation System SHALL return a 400 response with an error message.
4. WHEN the submitted OTP has expired (older than 5 minutes), THE Activation System SHALL return a 400 response indicating the code has expired.
5. WHEN a student requests OTP resend, THE Activation System SHALL generate a new 6-digit OTP, reset the 5-minute expiry, and send it to the same institutional email.
6. WHEN OTP verification succeeds, THE Activation System SHALL clear the stored OTP and expiry from the session store.

---

### Requirement 5 — Password Creation

**User Story:** As a student, I want to set a password after verifying my email, so that I can log in to my account.

#### Acceptance Criteria

1. WHEN a student submits a password after successful OTP verification, THE Activation System SHALL validate that the password is at least 6 characters long.
2. WHEN the password is shorter than 6 characters, THE Activation System SHALL return a 400 response.
3. WHEN the password meets the length requirement, THE Activation System SHALL hash the password using bcrypt with 10 salt rounds.
4. WHEN the password is hashed, THE Activation System SHALL create a `User` record with `role = STUDENT`, linking it to the `Student` record via `studentId`.
5. WHEN the `User` record is created, THE Activation System SHALL update the `Student` record setting `isActivated = true` and storing the verified institutional email.
6. WHEN activation completes successfully, THE Activation System SHALL return a 201 response with the created user's `id`, `name`, and `role`.

---

### Requirement 6 — Security Controls

**User Story:** As a system administrator, I want the activation endpoints to be protected against abuse, so that the system remains secure and reliable.

#### Acceptance Criteria

1. WHEN the OTP send endpoint receives more than 5 requests from the same IP within a 15-minute window, THE Activation System SHALL return a 429 response.
2. WHEN an OTP is stored, THE Activation System SHALL store it as a plain string in a server-side session or temporary database record, never in the client.
3. WHEN a student attempts to activate an already-activated account, THE Activation System SHALL reject the request at every step of the flow.
4. WHEN a student submits an OTP, THE Activation System SHALL use a constant-time comparison to prevent timing attacks.

---

### Requirement 7 — Activation Wizard UI

**User Story:** As a student, I want a clear multi-step activation interface, so that I can complete the process without confusion.

#### Acceptance Criteria

1. WHEN the Activation Wizard loads, THE Activation Wizard SHALL display a step indicator showing the current step out of the total steps.
2. WHEN the student is on the email input step, THE Activation Wizard SHALL display an input field with a placeholder showing the expected email format (e.g. `firstname.fathername@aastustudent.edu.et`).
3. WHEN the student is on the OTP step, THE Activation Wizard SHALL display a 6-digit code input field, a Submit button, and a Resend Code button.
4. WHEN the student is on the password creation step, THE Activation Wizard SHALL display a password field and a confirm password field.
5. WHEN the student submits mismatched passwords, THE Activation Wizard SHALL display an inline error without submitting to the server.

---

### Requirement 8 — Remove Manual Registration

**User Story:** As a system administrator, I want manual student self-registration removed, so that only preloaded students with verified institutional emails can create accounts.

#### Acceptance Criteria

1. WHEN a request is made to the student self-registration endpoint, THE Activation System SHALL return a 404 or 410 response indicating the endpoint no longer exists.
2. WHEN the frontend renders the login page, THE Activation Wizard SHALL not display a link or path to manual student registration.
3. WHEN the frontend renders the activation page, THE Activation Wizard SHALL only allow the institutional email OTP flow for account creation.

---

### Requirement 9 — Password Reset via Institutional Email

**User Story:** As an activated student, I want to reset my password using my institutional email OTP, so that I can regain access if I forget my password.

#### Acceptance Criteria

1. WHEN a student submits their institutional email on the forgot-password page, THE Activation System SHALL look up the activated `Student` record by that email.
2. WHEN a matching activated student is found, THE Activation System SHALL generate a 6-digit OTP with a 15-minute expiry and send it to the institutional email.
3. WHEN a student submits a valid, non-expired OTP and a new password of at least 6 characters, THE Activation System SHALL hash the new password and update the `User` record.
4. WHEN the password is updated, THE Activation System SHALL clear the OTP and expiry from the `User` record.
5. WHEN no activated student is found for the submitted email, THE Activation System SHALL return a 404 response.

---

### Requirement 10 — OTP Email Delivery

**User Story:** As a student, I want to receive a clear, well-formatted OTP email, so that I can easily find and enter the verification code.

#### Acceptance Criteria

1. WHEN the Activation System sends an OTP email, THE Activation System SHALL use Nodemailer configured with Gmail SMTP credentials from environment variables `EMAIL_USER` and `EMAIL_PASS`.
2. WHEN the OTP email is sent, THE Activation System SHALL include the 6-digit code prominently in the email body.
3. WHEN the OTP email is sent, THE Activation System SHALL include the OTP expiry duration (5 minutes) in the email body so the student knows the time limit.
4. WHEN the email service fails to deliver, THE Activation System SHALL return a 500 response and log the error without exposing SMTP credentials.
