# Requirements Document

## Introduction

This feature allows administrators to transfer ownership of a registered laptop from one student to another. Currently, laptops are permanently tied to the student who registered them. Admins need the ability to reassign a laptop when a student graduates, loses their account, or when a device is legitimately passed to another student. The transfer resets the laptop's verification status and creates an audit trail.

## Glossary

- **Admin**: A system user with the ADMIN role who manages students and laptops.
- **Laptop**: A device registered in the system with a serial number, brand, model, QR code, and an owner.
- **Owner**: The User account (with role STUDENT) currently associated with a given Laptop.
- **Transfer**: The act of changing a Laptop's `ownerId` from one User to another.
- **Verification Status**: A field on Laptop (`PENDING`, `VERIFIED`, `BLOCKED`) indicating whether a guard has physically verified the device.
- **Student ID**: The university-issued identifier (e.g. `ETS1234/15`) stored on the User record as `studentId`.
- **Transfer Log**: An audit record capturing who performed a transfer, which laptop was transferred, the previous owner, the new owner, and the timestamp.

## Requirements

### Requirement 1

**User Story:** As an admin, I want to transfer a laptop from one student to another, so that device ownership stays accurate when laptops change hands.

#### Acceptance Criteria

1. WHEN an admin submits a transfer request with a valid laptop ID and a valid target student ID, THE System SHALL update the laptop's `ownerId` to the target student's User ID.
2. WHEN a transfer is completed, THE System SHALL reset the laptop's `verificationStatus` to `PENDING`, clear `verifiedAt`, and clear `verifiedById`.
3. WHEN a transfer is completed, THE System SHALL create a Transfer Log entry recording the laptop ID, the previous owner's User ID, the new owner's User ID, the admin's User ID, and the timestamp.
4. IF the specified laptop ID does not exist, THEN THE System SHALL return a 404 error with a descriptive message.
5. IF the target student ID does not correspond to an activated User account, THEN THE System SHALL return a 400 error with a descriptive message.

### Requirement 2

**User Story:** As an admin, I want to see a confirmation before a transfer is executed, so that I can avoid accidental reassignments.

#### Acceptance Criteria

1. WHEN an admin selects "Transfer" on a laptop in the admin UI, THE System SHALL display a confirmation modal showing the laptop details, the current owner's name and student ID, and a search field for the target student.
2. WHEN the admin searches for a target student in the transfer modal, THE System SHALL display matching students by name or student ID from the existing student list.
3. WHEN the admin confirms the transfer, THE System SHALL call the transfer API and display a success message upon completion.
4. IF the transfer API returns an error, THEN THE System SHALL display the error message inside the modal without closing it.

### Requirement 3

**User Story:** As an admin, I want to view the transfer history for a laptop, so that I can audit ownership changes over time.

#### Acceptance Criteria

1. WHEN an admin views a laptop's details in the admin UI, THE System SHALL display a list of all Transfer Log entries for that laptop, ordered by timestamp descending.
2. WHEN displaying a Transfer Log entry, THE System SHALL show the previous owner's name and student ID, the new owner's name and student ID, the admin who performed the transfer, and the timestamp.
3. IF a laptop has no transfer history, THEN THE System SHALL display a message indicating no transfers have occurred.
