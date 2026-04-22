# Requirements Document

## Introduction

This document specifies the requirements for the Laptop Update Request feature in the AASTU Laptop Gate Management System. Currently, students can register laptops but cannot modify laptop data directly. This feature introduces a controlled update flow where students submit change requests that must be reviewed and approved by an Admin or Guard before any laptop record is modified. Upon approval, the laptop's verification status is reset to PENDING, requiring re-verification at the gate.

## Glossary

- **LaptopUpdateRequest**: A record representing a student's request to change one or more fields of a registered laptop (brand, serial number, or photo).
- **Laptop**: An existing registered laptop record in the system, owned by a Student.
- **Student**: A user with the STUDENT role who owns one or more registered laptops.
- **Reviewer**: A user with the ADMIN or GUARD role who has authority to approve or reject update requests.
- **Verification Status**: The current gate-clearance state of a laptop: PENDING, VERIFIED, or BLOCKED.
- **PENDING (request)**: The initial status of a LaptopUpdateRequest after submission, awaiting review.
- **APPROVED**: The status of a LaptopUpdateRequest after a Reviewer accepts the changes.
- **REJECTED**: The status of a LaptopUpdateRequest after a Reviewer declines the changes.
- **Re-verification**: The process by which a Guard physically inspects a laptop at the gate and marks it VERIFIED after its data has been updated.
- **Review Dashboard**: The frontend page available to Reviewers for viewing and acting on pending update requests.

---

## Requirements

### Requirement 1

**User Story:** As a Student, I want to submit a request to update my laptop's brand, serial number, or photo, so that I can keep my laptop record accurate without directly editing it.

#### Acceptance Criteria

1. WHEN a Student submits an update request with at least one of new brand, new serial number, or new photo, THE LaptopUpdateRequest System SHALL create a new LaptopUpdateRequest record with status PENDING and leave the existing Laptop record unchanged.
2. WHEN a Student submits an update request, THE LaptopUpdateRequest System SHALL associate the request with the Student's user ID and the target laptop's ID.
3. WHEN a Student submits an update request, THE LaptopUpdateRequest System SHALL record the submission timestamp in the requested_at field.
4. WHERE a reason field is provided, THE LaptopUpdateRequest System SHALL store the reason text alongside the request.
5. IF a Student submits an update request for a laptop that does not belong to that Student, THEN THE LaptopUpdateRequest System SHALL reject the request with a 403 Forbidden response.

---

### Requirement 2

**User Story:** As a Student, I want to see the current status of my submitted update requests, so that I know whether my changes have been approved or rejected.

#### Acceptance Criteria

1. WHEN a Student requests their update request list, THE LaptopUpdateRequest System SHALL return all LaptopUpdateRequests associated with that Student's laptops, ordered by requested_at descending.
2. WHEN returning a LaptopUpdateRequest to a Student, THE LaptopUpdateRequest System SHALL include the request status (PENDING, APPROVED, or REJECTED), the submitted new values, and the requested_at timestamp.
3. WHILE a LaptopUpdateRequest has status PENDING, THE LaptopUpdateRequest System SHALL prevent the Student from submitting another update request for the same laptop.

---

### Requirement 3

**User Story:** As a Reviewer (Admin or Guard), I want to view all pending laptop update requests with a side-by-side comparison of old and new data, so that I can make an informed approval or rejection decision.

#### Acceptance Criteria

1. WHEN a Reviewer requests the list of update requests, THE LaptopUpdateRequest System SHALL return all LaptopUpdateRequests including the current laptop data and the proposed new data.
2. WHEN returning update request details to a Reviewer, THE LaptopUpdateRequest System SHALL include the current laptop brand, serial number, and photo URL alongside the new brand, new serial number, and new photo URL.
3. WHEN a Reviewer requests the list of update requests, THE LaptopUpdateRequest System SHALL include the owning Student's name and student ID in each record.

---

### Requirement 4

**User Story:** As a Reviewer, I want to approve a laptop update request, so that the student's laptop record is updated and queued for re-verification.

#### Acceptance Criteria

1. WHEN a Reviewer approves a LaptopUpdateRequest with status PENDING, THE LaptopUpdateRequest System SHALL update the Laptop record's brand, serial number, and photo URL with the approved new values for any fields that were provided in the request.
2. WHEN a Reviewer approves a LaptopUpdateRequest, THE LaptopUpdateRequest System SHALL set the Laptop's verificationStatus to PENDING.
3. WHEN a Reviewer approves a LaptopUpdateRequest, THE LaptopUpdateRequest System SHALL set the request status to APPROVED, record the reviewed_at timestamp, and record the reviewer's user ID in reviewed_by.
4. IF a Reviewer attempts to approve a LaptopUpdateRequest that does not have status PENDING, THEN THE LaptopUpdateRequest System SHALL reject the action with a 409 Conflict response.

---

### Requirement 5

**User Story:** As a Reviewer, I want to reject a laptop update request, so that the student's laptop record remains unchanged when the request is invalid.

#### Acceptance Criteria

1. WHEN a Reviewer rejects a LaptopUpdateRequest with status PENDING, THE LaptopUpdateRequest System SHALL set the request status to REJECTED and leave the Laptop record unchanged.
2. WHEN a Reviewer rejects a LaptopUpdateRequest, THE LaptopUpdateRequest System SHALL record the reviewed_at timestamp and the reviewer's user ID in reviewed_by.
3. IF a Reviewer attempts to reject a LaptopUpdateRequest that does not have status PENDING, THEN THE LaptopUpdateRequest System SHALL reject the action with a 409 Conflict response.

---

### Requirement 6

**User Story:** As a Guard, I want the gate verification system to require re-verification for any laptop whose update request was approved, so that physical laptop identity is confirmed before campus entry.

#### Acceptance Criteria

1. WHEN a laptop's update request is approved, THE LaptopUpdateRequest System SHALL set the laptop's verificationStatus to PENDING before the next gate scan is processed.
2. WHILE a laptop's verificationStatus is PENDING, THE Gate System SHALL deny campus entry and prompt the Guard to perform a physical verification.
3. WHEN a Guard marks a PENDING laptop as VERIFIED at the gate, THE Gate System SHALL update the laptop's verificationStatus to VERIFIED and record the verifying Guard's ID and timestamp.

---

### Requirement 7

**User Story:** As a system architect, I want role-based access control enforced on all update request endpoints, so that Students cannot approve or modify requests and Reviewers cannot submit requests on behalf of students.

#### Acceptance Criteria

1. WHEN a Student attempts to call the approve or reject endpoints, THE LaptopUpdateRequest System SHALL return a 403 Forbidden response.
2. WHEN a Reviewer attempts to call the create update request endpoint, THE LaptopUpdateRequest System SHALL return a 403 Forbidden response.
3. WHEN an unauthenticated user calls any update request endpoint, THE LaptopUpdateRequest System SHALL return a 401 Unauthorized response.

---

### Requirement 8

**User Story:** As a developer, I want the LaptopUpdateRequest data to be persisted in a dedicated database table with proper foreign key relationships, so that the system maintains referential integrity.

#### Acceptance Criteria

1. THE LaptopUpdateRequest System SHALL store each update request in a dedicated `laptop_update_requests` table with fields: id, laptop_id, student_id, new_brand, new_serial_number, new_image, reason, status, requested_at, reviewed_at, and reviewed_by.
2. THE LaptopUpdateRequest System SHALL enforce a foreign key constraint from laptop_update_requests.laptop_id to the Laptop table.
3. THE LaptopUpdateRequest System SHALL enforce a foreign key constraint from laptop_update_requests.student_id to the User table.
4. THE LaptopUpdateRequest System SHALL enforce a foreign key constraint from laptop_update_requests.reviewed_by to the User table, allowing NULL when the request has not yet been reviewed.
