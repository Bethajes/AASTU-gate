# Requirements Document

## Introduction

This document specifies the requirements for upgrading the existing authentication system of the Laptop Gate Management System to enforce institutional email restrictions and email verification. The system currently allows any user to register and login without email verification. This upgrade will ensure that only users with valid AASTU institutional email addresses can register, and all users must verify their email address via a one-time password (OTP) before accessing the system.

## Glossary

- **System**: The Laptop Gate Management System authentication module
- **User**: A person attempting to register or login to the system
- **Institutional Email**: An email address following the format firstname.fathername@aastustudent.edu.et
- **OTP**: One-Time Password - a 6-digit numeric verification code
- **Verification Code**: The OTP sent to the user's email for account verification
- **Unverified User**: A user who has registered but not yet verified their email address
- **Verified User**: A user who has successfully verified their email address using the OTP

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to restrict registration to institutional emails only, so that only AASTU students can create accounts.

#### Acceptance Criteria

1. WHEN a user submits a registration request with an email address THEN the System SHALL validate that the email matches the pattern firstname.fathername@aastustudent.edu.et
2. WHEN a user submits a registration request with an email that does not match the pattern firstname.fathername@aastustudent.edu.et THEN the System SHALL reject the registration and return the error message "Only AASTU institutional emails are allowed"
3. WHEN a user submits a registration request with a valid institutional email THEN the System SHALL proceed with account creation

### Requirement 2

**User Story:** As a new user, I want to receive a verification code after registration, so that I can verify my email address and activate my account.

#### Acceptance Criteria

1. WHEN a user successfully registers with a valid institutional email THEN the System SHALL generate a 6-digit numeric verification code
2. WHEN a verification code is generated THEN the System SHALL set the expiry time to 10 minutes from the current time
3. WHEN a verification code is generated THEN the System SHALL store the code and expiry time in the database associated with the user account
4. WHEN a verification code is generated THEN the System SHALL send an email to the user's @aastustudent.edu.et address containing the verification code
5. WHEN a user account is created THEN the System SHALL set the isVerified field to false

### Requirement 3

**User Story:** As a new user, I want to verify my email address using the code sent to me, so that I can activate my account and login.

#### Acceptance Criteria

1. WHEN a user submits a verification request with email and code THEN the System SHALL locate the user account by email address
2. WHEN a user submits a verification request THEN the System SHALL validate that the provided code matches the stored verification code
3. WHEN a user submits a verification request THEN the System SHALL validate that the current time is before the verification code expiry time
4. WHEN a user submits a valid verification request THEN the System SHALL set the isVerified field to true
5. WHEN a user submits a valid verification request THEN the System SHALL clear the verificationCode and verificationCodeExpiry fields
6. WHEN a user submits an invalid or expired verification code THEN the System SHALL reject the request and return an appropriate error message

### Requirement 4

**User Story:** As a system administrator, I want to prevent unverified users from logging in, so that only users with verified email addresses can access the system.

#### Acceptance Criteria

1. WHEN a user attempts to login THEN the System SHALL check if the user's isVerified field is true
2. WHEN a user with isVerified set to false attempts to login THEN the System SHALL reject the login request and return the message "Please verify your email first"
3. WHEN a user with isVerified set to true attempts to login with valid credentials THEN the System SHALL generate a JWT token and allow access

### Requirement 5

**User Story:** As a user, I want to request a new verification code if my original code expires, so that I can complete the verification process without creating a new account.

#### Acceptance Criteria

1. WHEN a user requests to resend the verification code THEN the System SHALL generate a new 6-digit numeric verification code
2. WHEN a new verification code is generated THEN the System SHALL update the verificationCode and verificationCodeExpiry fields in the database
3. WHEN a new verification code is generated THEN the System SHALL send an email to the user's @aastustudent.edu.et address containing the new verification code
4. WHEN a user requests to resend the verification code for a non-existent email THEN the System SHALL return an appropriate error message

### Requirement 6

**User Story:** As a user, I want to see a verification page after registration, so that I can easily enter my verification code and activate my account.

#### Acceptance Criteria

1. WHEN a user successfully registers THEN the System SHALL redirect the user to a verification page
2. WHEN a user is on the verification page THEN the System SHALL display an input field for the 6-digit verification code
3. WHEN a user submits a valid verification code THEN the System SHALL display a success message and allow the user to proceed to login
4. WHEN a user submits an invalid verification code THEN the System SHALL display an error message
5. WHEN a user is on the verification page THEN the System SHALL provide a button to resend the verification code

### Requirement 7

**User Story:** As a system administrator, I want verification codes to be sent via email using a secure email service, so that users receive their codes reliably and securely.

#### Acceptance Criteria

1. WHEN the System sends a verification email THEN the System SHALL use the Nodemailer library to send the email
2. WHEN the System sends a verification email THEN the System SHALL use email credentials stored in environment variables EMAIL_USER and EMAIL_PASS
3. WHEN the System sends a verification email THEN the System SHALL use the subject line "Verify your AASTU account"
4. WHEN the System sends a verification email THEN the System SHALL include the verification code in the email body
5. WHEN the System fails to send a verification email THEN the System SHALL log the error and return an appropriate error message to the user
