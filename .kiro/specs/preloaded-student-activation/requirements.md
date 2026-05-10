# Requirements Document

## Introduction

This feature replaces the existing open self-registration flow for students with a controlled, admin-preloaded activation system. Instead of students creating accounts freely, an administrator preloads all student records into a dedicated `Student` table. Students activate their accounts by entering both their username and student ID (which must match the same preloaded record), confirming their identity via displayed profile info, and setting a password along with their email. The existing `User` table is updated to link activated accounts back to the preloaded student record. Students log in using their username and password after activation. Email is collected during activation and used only for password reset. All other roles (GUARD, ADMIN) and existing system functionality remain unchanged.

## Glossary

- **Student**: A person whose record has been preloaded into the `Student` table by an administrator.
- **Student ID**: A unique institutional identifier assigned to each student (e.g., `ETS0001/15`).
- **Username**: A unique short identifier assigned to each student by the admin (e.g., `john.doe`), used for login and activation lookup.
- **Activation**: The process by which a student verifies their identity using both username and student ID, then sets an email and password to create a linked `User` account for the first time.
- **User**: A record in the `User` table representing an authenticated account linked to a student, guard, or admin.
- **Admin**: A privileged user with role `ADMIN` who manages student data and system configuration.
- **Activation System**: The backend and frontend components that handle the student lookup, identity confirmation, and password-setting flow.
- **isActivated**: A boolean field on the `Student` record indicating whether the student has completed account activation.
- **JWT**: JSON Web Token used for stateless authentication after login.
- **Bcrypt**: A password hashing algorithm used to securely store passwords.

---

## Requirements

### Requirement 1

**User Story:** As an admin, I want to preload student records into the system, so that only known students can activate accounts.

#### Acceptance Criteria

1. THE Activation System SHALL maintain a `Student` table with fields: `id` (student ID, unique), `username` (unique), `name`, `email` (nullable), `photo`, `department`, and `isActivated` (boolean, default `false`).
2. WHEN an admin creates a student record, THE Activation System SHALL store the record with `isActivated` set to `false` and `email` set to `null`.
3. IF a student record with the same student ID already exists, THEN THE Activation System SHALL reject the creation and return a conflict error.
4. IF a student record with the same username already exists, THEN THE Activation System SHALL reject the creation and return a conflict error.
5. THE Activation System SHALL NOT expose a public endpoint for creating student records without admin authentication.

---

### Requirement 2

**User Story:** As a student, I want to look up my preloaded record using both my username and student ID, so that I can confirm my identity before setting a password.

#### Acceptance Criteria

1. WHEN a student submits both a `username` and `student_id` to `POST /api/auth/activate`, THE Activation System SHALL verify that both values match the same record in the `Student` table and return the matching student's `name`, `photo`, `department`, and `username`.
2. IF the submitted `username` and `student_id` do not both match the same record in the `Student` table, THEN THE Activation System SHALL return a 404 error with a descriptive message.
3. IF the student record has `isActivated` set to `true`, THEN THE Activation System SHALL return a 409 error indicating the account is already activated.
4. THE Activation System SHALL NOT return the student's password, email, or any sensitive credential in the activation lookup response.
5. THE Activation System SHALL validate that both `username` and `student_id` fields are present and non-empty on the activation lookup request, returning a 400 error if either is missing.

---

### Requirement 3

**User Story:** As a student, I want to set my email and password after confirming my identity, so that I can create a secure account and enable future password recovery.

#### Acceptance Criteria

1. WHEN a student submits a valid `username`, `student_id`, `email`, and `password` to `POST /api/auth/set-password`, THE Activation System SHALL create a new `User` record with role `STUDENT`, linked to the student via `student_id`.
2. WHEN a `User` record is created during activation, THE Activation System SHALL hash the password using bcrypt before storing it.
3. WHEN a `User` record is successfully created, THE Activation System SHALL set `isActivated` to `true` and save the provided `email` on the corresponding `Student` record.
4. IF the `password` field is fewer than 6 characters, THEN THE Activation System SHALL reject the request and return a 400 error.
5. IF the student ID has already been activated, THEN THE Activation System SHALL reject the set-password request and return a 409 error.
6. IF the student ID does not exist in the `Student` table, THEN THE Activation System SHALL return a 404 error.
7. IF the provided `email` is already associated with another `Student` or `User` record, THEN THE Activation System SHALL reject the request and return a 409 error.
8. IF the `email` field is absent or empty, THEN THE Activation System SHALL reject the request and return a 400 error.

---

### Requirement 4

**User Story:** As a student, I want to log in using my username and password, so that I can access the system after activating my account.

#### Acceptance Criteria

1. WHEN a student submits a `username` and `password` to `POST /api/auth/login`, THE Activation System SHALL authenticate the student by looking up the linked `User` record via the `username` field on the `Student` table.
2. IF the `username` does not correspond to any activated `Student` record, THEN THE Activation System SHALL return a 401 error with a generic invalid credentials message.
3. IF the submitted password does not match the stored bcrypt hash, THEN THE Activation System SHALL return a 401 error with a generic invalid credentials message.
4. WHEN authentication succeeds, THE Activation System SHALL return a signed JWT containing the user's `id` and `role`, along with basic user info.
5. THE Activation System SHALL keep the existing email/password login path functional for GUARD and ADMIN roles.

---

### Requirement 5

**User Story:** As a student, I want a guided multi-step frontend flow, so that I can activate my account and reach my dashboard without confusion.

#### Acceptance Criteria

1. WHEN a student navigates to the activation page, THE Activation System SHALL display a step that prompts for both username and student ID inputs.
2. WHEN a valid username and student ID are submitted in Step 1, THE Activation System SHALL display the student's name and photo for identity confirmation before proceeding.
3. WHEN the student confirms their identity, THE Activation System SHALL display a form prompting for email and password.
4. WHEN the student successfully sets an email and password, THE Activation System SHALL redirect the student to the student dashboard.
5. IF any step returns an error from the backend, THE Activation System SHALL display a human-readable error message on the current step without resetting prior steps.

---

### Requirement 6

**User Story:** As a system administrator, I want the activation system to enforce security rules, so that fake or duplicate accounts cannot be created.

#### Acceptance Criteria

1. THE Activation System SHALL NOT provide any publicly accessible endpoint that allows creating a `User` record with role `STUDENT` outside of the `set-password` activation flow.
2. IF a `set-password` request is made for a student ID that already has a linked `User` record, THEN THE Activation System SHALL reject the request with a 409 conflict error.
3. THE Activation System SHALL validate that both `username` and `student_id` fields are present and non-empty on all activation requests, returning a 400 error if either is missing.
4. WHILE a student record has `isActivated` set to `false`, THE Activation System SHALL prevent that student from logging in via the username login path.
5. THE Activation System SHALL apply rate limiting to the `POST /api/auth/activate` endpoint, returning a 429 error after 10 failed attempts within a 15-minute window from the same IP address.

---

### Requirement 7

**User Story:** As a student, I want to reset my password using my saved email, so that I can regain access if I forget my password.

#### Acceptance Criteria

1. WHEN a student submits their email to `POST /api/auth/forgot-password`, THE Activation System SHALL send a time-limited verification code to that email address.
2. WHEN a student submits a valid verification code and new password to `POST /api/auth/reset-password`, THE Activation System SHALL update the stored password hash and invalidate the verification code.
3. IF the verification code has expired or is invalid, THEN THE Activation System SHALL return a 400 error.
4. IF the `email` submitted to the forgot-password endpoint does not match any activated `Student` record, THEN THE Activation System SHALL return a 404 error.
5. IF the new password is fewer than 6 characters, THEN THE Activation System SHALL reject the reset request and return a 400 error.
