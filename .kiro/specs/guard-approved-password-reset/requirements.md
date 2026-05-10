# Requirements Document

## Introduction

This document specifies the requirements for a secure password reset system for the Laptop Gate Management System. The system enables students to reset their passwords through physical verification by security guards at the gate, eliminating the need for OTP or email-based verification. This approach leverages the existing physical security infrastructure while maintaining strong authentication security.

## Glossary

- **System**: The Laptop Gate Management System password reset subsystem
- **Student**: A registered user with student role who may need to reset their password
- **Guard**: A user with guard or admin role authorized to approve password reset requests
- **Reset Request**: A student-initiated request to reset their password
- **Reset Approval**: Guard authorization allowing a student to reset their password
- **Approval Window**: The time period during which an approved reset request remains valid (10-15 minutes)
- **Physical Verification**: In-person identity verification performed by a guard at the gate

## Requirements

### Requirement 1

**User Story:** As a student, I want to request a password reset, so that I can regain access to my account when I forget my password.

#### Acceptance Criteria

1. WHEN a student submits a password reset request with their email, THE System SHALL mark the user account with resetRequested as true
2. WHEN a password reset request is created, THE System SHALL set resetApproved to false
3. WHEN a password reset request is submitted, THE System SHALL return a message instructing the student to visit the gate for approval
4. IF a student submits a reset request with an email that does not exist, THEN THE System SHALL return an error message
5. WHEN a student has an active reset request, THE System SHALL allow submission of additional reset requests without error

### Requirement 2

**User Story:** As a guard, I want to approve password reset requests after physical verification, so that I can help students regain access to their accounts securely.

#### Acceptance Criteria

1. WHEN a guard accesses the password reset approval interface, THE System SHALL display all pending reset requests
2. WHEN a guard approves a reset request, THE System SHALL set resetApproved to true for that user account
3. WHEN a guard approves a reset request, THE System SHALL record the guard identifier in resetApprovedBy
4. WHEN a guard approves a reset request, THE System SHALL set resetApprovalExpiry to current time plus 10 minutes
5. IF a non-guard user attempts to approve a reset request, THEN THE System SHALL reject the request with an authorization error
6. WHEN a guard approves a reset request, THE System SHALL return a success confirmation

### Requirement 3

**User Story:** As a student, I want to reset my password after guard approval, so that I can set a new password and access my account.

#### Acceptance Criteria

1. WHEN a student submits a new password with valid approval, THE System SHALL hash the password using bcrypt
2. WHEN a student submits a new password with valid approval, THE System SHALL update the user password field
3. WHEN a password reset is completed, THE System SHALL set resetRequested to false
4. WHEN a password reset is completed, THE System SHALL set resetApproved to false
5. WHEN a password reset is completed, THE System SHALL clear the resetApprovedBy field
6. WHEN a password reset is completed, THE System SHALL clear the resetApprovalExpiry field
7. IF a student attempts to reset password without approval, THEN THE System SHALL reject the request
8. IF a student attempts to reset password after the approval expiry time, THEN THE System SHALL reject the request
9. WHEN a password reset is rejected due to expiry, THE System SHALL return an error message indicating the approval has expired

### Requirement 4

**User Story:** As a system administrator, I want all password reset activities logged, so that I can audit security events and investigate issues.

#### Acceptance Criteria

1. WHEN a reset request is created, THE System SHALL log the student email and timestamp
2. WHEN a reset approval is granted, THE System SHALL log the student identifier, guard identifier, and timestamp
3. WHEN a password reset is completed, THE System SHALL log the student identifier and timestamp
4. WHEN a password reset is rejected, THE System SHALL log the student identifier, rejection reason, and timestamp

### Requirement 5

**User Story:** As a security architect, I want the reset approval to expire after a short time window, so that the system maintains security even if a student does not immediately complete the reset.

#### Acceptance Criteria

1. WHEN checking reset approval validity, THE System SHALL compare current time against resetApprovalExpiry
2. WHEN current time exceeds resetApprovalExpiry, THE System SHALL treat the approval as invalid
3. WHEN an approval expires, THE System SHALL require a new guard approval for password reset
4. THE System SHALL set approval expiry to 10 minutes from approval time

### Requirement 6

**User Story:** As a student, I want a clear frontend interface to request password reset, so that I can easily initiate the process.

#### Acceptance Criteria

1. WHEN a student navigates to the forgot password page, THE System SHALL display an email input field
2. WHEN a student submits the forgot password form, THE System SHALL send the request to the backend API
3. WHEN the reset request is successful, THE System SHALL display a message instructing the student to visit the gate
4. WHEN the reset request fails, THE System SHALL display an appropriate error message

### Requirement 7

**User Story:** As a guard, I want a dashboard section showing pending password reset requests, so that I can efficiently process student requests.

#### Acceptance Criteria

1. WHEN a guard views the dashboard, THE System SHALL display a section for password reset requests
2. WHEN displaying reset requests, THE System SHALL show student identifier and request timestamp
3. WHEN a guard clicks approve on a reset request, THE System SHALL send the approval to the backend API
4. WHEN an approval is successful, THE System SHALL update the dashboard to reflect the approval status
5. WHEN an approval fails, THE System SHALL display an error message to the guard

### Requirement 8

**User Story:** As a student, I want to complete my password reset after approval, so that I can set my new password and log in.

#### Acceptance Criteria

1. WHEN a student navigates to the reset password page, THE System SHALL display password and confirm password input fields
2. WHEN a student submits the reset password form, THE System SHALL validate that passwords match
3. WHEN passwords match and approval is valid, THE System SHALL send the new password to the backend API
4. WHEN the password reset is successful, THE System SHALL redirect the student to the login page
5. WHEN the password reset fails, THE System SHALL display an appropriate error message
