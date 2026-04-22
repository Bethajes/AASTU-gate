# Requirements Document

## Introduction

This feature adds a Guest Registration system to the AASTU campus gate management application. Unlike students who register their own laptops, guests are registered by guards directly from the Guard Scanner page. Guests do not have institutional emails or student IDs, and their items do not require photo uploads. Guards can register a guest, assign them a temporary pass code, and log their entry/exit through the same gate interface. The system must track guest visits and allow guards to manage guest records.

## Glossary

- **Guest**: A non-student, non-staff visitor to the AASTU campus who carries a laptop or device that must be tracked at the gate.
- **Guard**: A campus security officer with the GUARD role who operates the gate scanner and registers guests.
- **Guest Pass**: A temporary record created by a guard that represents a guest's registered device for a single visit or a defined period.
- **Guest Code**: An 8-digit numeric code generated for a guest pass, used to log entry and exit at the gate.
- **Guard Scanner Page**: The existing frontend page (`/guard`) where guards scan laptop codes and manage gate activity.
- **GateLog**: The existing database record of entry/exit scan events.
- **Verification Status**: The state of a laptop or guest pass — one of PENDING, VERIFIED, or BLOCKED.
- **Campus Status**: Whether a device is currently recorded as inside or outside campus (`isInCampus`).

## Requirements

### Requirement 1

**User Story:** As a guard, I want to register a guest's device from the Guard Scanner page, so that I can track the guest's entry and exit without requiring the guest to have an account.

#### Acceptance Criteria

1. WHEN a guard submits the guest registration form, THE System SHALL create a new GuestPass record containing the guest's full name, phone number, purpose of visit, device brand, device model, and device serial number.
2. WHEN a guard submits the guest registration form with any required field left empty, THE System SHALL reject the submission and display a validation error message identifying the missing field.
3. WHEN a new GuestPass is created, THE System SHALL generate a unique 8-digit numeric Guest Code and associate it with the GuestPass record.
4. WHEN a new GuestPass is created, THE System SHALL set the GuestPass verification status to VERIFIED and campus status to false (outside campus) by default.
5. WHEN a guard submits the guest registration form, THE System SHALL NOT require a photo upload.

### Requirement 2

**User Story:** As a guard, I want to look up a guest pass by its 8-digit code, so that I can verify the guest's identity and log their entry or exit.

#### Acceptance Criteria

1. WHEN a guard enters an 8-digit code in the scanner input, THE System SHALL query both the Laptop table and the GuestPass table and return the matching record.
2. WHEN a guest pass is found by code lookup, THE System SHALL display the guest's full name, phone number, purpose of visit, device brand, device model, device serial number, verification status, and campus status.
3. WHEN no record is found for the entered code in either the Laptop or GuestPass table, THE System SHALL display an error message indicating no record was found.
4. WHEN a guest pass record is displayed, THE System SHALL NOT display a photo section.

### Requirement 3

**User Story:** As a guard, I want to log a guest's entry and exit using the guest code, so that campus movement of guests is tracked the same way as students.

#### Acceptance Criteria

1. WHEN a guard confirms entry for a guest pass with VERIFIED status and campus status false, THE System SHALL update the GuestPass campus status to true and insert a GateLog record with scan type IN.
2. WHEN a guard confirms exit for a guest pass with VERIFIED status and campus status true, THE System SHALL update the GuestPass campus status to false and insert a GateLog record with scan type OUT.
3. WHEN a guard attempts entry or exit for a guest pass with BLOCKED status, THE System SHALL reject the action and display a blocked error message.
4. WHEN a guard attempts entry for a guest pass that is already recorded as inside campus, THE System SHALL reject the action and display an appropriate error message.
5. WHEN a guard attempts exit for a guest pass that is already recorded as outside campus, THE System SHALL reject the action and display an appropriate error message.

### Requirement 4

**User Story:** As a guard, I want to see guest registrations in the recent scans log, so that I have a unified view of all gate activity.

#### Acceptance Criteria

1. WHEN the Guard Scanner page loads, THE System SHALL include guest pass entry and exit events in the recent scans log alongside laptop events.
2. WHEN a guest pass event is displayed in the recent scans log, THE System SHALL show the guest's name, device brand, device serial number, scan type, and timestamp.
3. WHEN displaying a guest pass event in the log, THE System SHALL visually distinguish it from student laptop events using a guest indicator label.

### Requirement 5

**User Story:** As a guard, I want to access the guest registration form from the Guard Scanner page without navigating away, so that the workflow remains efficient.

#### Acceptance Criteria

1. WHEN a guard is on the Guard Scanner page, THE System SHALL display a clearly labeled button or tab to open the guest registration form.
2. WHEN a guard opens the guest registration form, THE System SHALL display it inline on the same page without a full page navigation.
3. WHEN a guard successfully registers a guest, THE System SHALL display a success message with the generated Guest Code and reset the form for the next entry.
