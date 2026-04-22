# Requirements Document

## Introduction

This document describes the upgrade of the existing AASTU Laptop Gate Management System into a secure, real-world hybrid gate verification system. The existing system allows students to register laptops and guards to scan QR codes for entry/exit. The upgrade adds a formal verification lifecycle (PENDING → VERIFIED → BLOCKED), a dedicated guard dashboard, structured entry/exit logging, and optional QR camera scanning. The system must extend — not replace — the existing PERN stack codebase.

## Glossary

- **System**: The AASTU Laptop Gate Management System backend and frontend.
- **Student**: A registered user with role `STUDENT` who owns one or more laptops.
- **Guard**: A registered user with role `GUARD` who operates the gate PC.
- **Admin**: A registered user with role `ADMIN` who manages the system.
- **Laptop**: A device registered by a Student, identified by a unique 8-digit code and optional QR code.
- **Verification Status**: A lifecycle state assigned to each Laptop: `PENDING`, `VERIFIED`, or `BLOCKED`.
- **Physical Verification**: The act of a Guard visually confirming that the physical laptop matches the registered record (photo, serial number, brand).
- **Gate Log**: A timestamped record of an ENTRY or EXIT event for a specific Laptop, created by a Guard.
- **QR Code**: An image encoding the 8-digit unique code, scannable by a webcam.
- **Unique Code**: An 8-digit numeric string uniquely identifying a Laptop.
- **Guard Dashboard**: A React page accessible only to users with role `GUARD`, used to search, verify, and log laptop movements.
- **Verification Flow**: The sequence of steps a Guard follows to perform a first-time Physical Verification of a Laptop.
- **Block**: An administrative or guard action that sets a Laptop's Verification Status to `BLOCKED`, preventing entry.

---

## Requirements

### Requirement 1 — Verification Status Lifecycle

**User Story:** As a Guard or Admin, I want each laptop to carry a verification status, so that I can distinguish newly registered laptops from physically verified ones and blocked ones.

#### Acceptance Criteria

1. WHEN a Student registers a new Laptop, THE System SHALL assign the Laptop a Verification Status of `PENDING`.
2. WHEN a Guard completes a Physical Verification of a Laptop, THE System SHALL update the Laptop's Verification Status to `VERIFIED`, record the timestamp as `verified_at`, and record the Guard's user ID as `verified_by`.
3. WHEN a Guard or Admin blocks a Laptop, THE System SHALL update the Laptop's Verification Status to `BLOCKED`.
4. WHILE a Laptop's Verification Status is `VERIFIED`, THE System SHALL allow the Guard to log ENTRY or EXIT events without requiring re-verification.
5. IF a Guard attempts to log an ENTRY or EXIT for a Laptop whose Verification Status is `BLOCKED`, THEN THE System SHALL reject the action and return an error response indicating the Laptop is blocked.

---

### Requirement 2 — Database Schema Extension

**User Story:** As a developer, I want the database schema extended with verification fields and a gate log table, so that the system can persist verification state and entry/exit history.

#### Acceptance Criteria

1. THE System SHALL add a `verification_status` column to the `Laptop` table with an enumerated type accepting values `PENDING`, `VERIFIED`, and `BLOCKED`, defaulting to `PENDING`.
2. THE System SHALL add a `verified_at` nullable timestamp column to the `Laptop` table.
3. THE System SHALL add a `verified_by` nullable foreign key column to the `Laptop` table referencing the `User` table.
4. THE System SHALL retain all existing `Laptop` columns and relationships without modification.
5. THE System SHALL retain the existing `GateLog` table structure and extend it with an `action` column accepting values `ENTRY` or `EXIT` to replace the existing `ScanType` enum usage, maintaining backward compatibility.

---

### Requirement 3 — Guard Dashboard UI

**User Story:** As a Guard, I want a dedicated dashboard on the gate PC, so that I can quickly search for a laptop, view its details, and take the appropriate action.

#### Acceptance Criteria

1. WHEN a Guard navigates to the Guard Dashboard, THE System SHALL display a search interface accepting an 8-digit Unique Code or a Student ID.
2. WHEN a Guard submits a valid search query, THE System SHALL display the matching Laptop's owner name, Student ID, laptop photo, brand, model, serial number, and current Verification Status.
3. WHEN the retrieved Laptop's Verification Status is `PENDING`, THE System SHALL display an active "Verify Laptop" button and disable the "Allow Entry" and "Allow Exit" buttons.
4. WHEN the retrieved Laptop's Verification Status is `VERIFIED`, THE System SHALL display active "Allow Entry" and "Allow Exit" buttons and hide the "Verify Laptop" button.
5. WHEN the retrieved Laptop's Verification Status is `BLOCKED`, THE System SHALL display a prominent alert indicating the Laptop is blocked and disable all action buttons.
6. IF a Guard searches for a code or Student ID that does not match any registered Laptop, THEN THE System SHALL display an error message indicating no laptop was found.

---

### Requirement 4 — First-Time Physical Verification Flow

**User Story:** As a Guard, I want to perform a first-time physical verification of a laptop, so that I can confirm the physical device matches the registered record before allowing campus entry.

#### Acceptance Criteria

1. WHEN a Guard clicks "Verify Laptop" on a Laptop with Verification Status `PENDING`, THE System SHALL send a verification request to the backend including the Guard's user ID.
2. WHEN the backend receives a valid verification request for a `PENDING` Laptop, THE System SHALL update the Laptop's Verification Status to `VERIFIED`, set `verified_at` to the current UTC timestamp, and set `verified_by` to the requesting Guard's user ID.
3. WHEN the verification request succeeds, THE System SHALL return the updated Laptop record to the Guard Dashboard and display a success confirmation.
4. IF a verification request is received for a Laptop whose Verification Status is not `PENDING`, THEN THE System SHALL reject the request and return a 400 error response.

---

### Requirement 5 — Entry / Exit Logging

**User Story:** As a Guard, I want to log every laptop entry and exit event, so that there is a complete audit trail of laptop movements through the gate.

#### Acceptance Criteria

1. WHEN a Guard clicks "Allow Entry" for a `VERIFIED` Laptop, THE System SHALL create a Gate Log record with action `ENTRY`, the current UTC timestamp, the Laptop ID, and the Guard's user ID.
2. WHEN a Guard clicks "Allow Exit" for a `VERIFIED` Laptop, THE System SHALL create a Gate Log record with action `EXIT`, the current UTC timestamp, the Laptop ID, and the Guard's user ID.
3. WHEN a Gate Log record is created, THE System SHALL update the Laptop's `isInCampus` field: set to `true` for `ENTRY` and `false` for `EXIT`.
4. THE System SHALL expose an API endpoint that returns Gate Log records including laptop brand, serial number, owner name, action type, timestamp, and guard name, ordered by timestamp descending.
5. IF a Guard attempts to log an `ENTRY` for a Laptop that is already marked as on campus, THEN THE System SHALL reject the request and return a 400 error response.
6. IF a Guard attempts to log an `EXIT` for a Laptop that is not marked as on campus, THEN THE System SHALL reject the request and return a 400 error response.

---

### Requirement 6 — QR Code Camera Scanning

**User Story:** As a Guard, I want to optionally scan a laptop's QR code using the gate PC webcam, so that I can look up a laptop faster without typing the 8-digit code manually.

#### Acceptance Criteria

1. WHERE a webcam is available on the gate PC, THE System SHALL display a "Scan QR" toggle button on the Guard Dashboard.
2. WHEN a Guard activates the QR scanner, THE System SHALL request webcam access and display a live camera preview.
3. WHEN the QR scanner detects a valid QR code in the camera feed, THE System SHALL automatically populate the search field with the decoded 8-digit Unique Code and trigger a laptop lookup.
4. WHEN a Guard deactivates the QR scanner, THE System SHALL stop the webcam stream and hide the camera preview.
5. IF the browser denies webcam access, THEN THE System SHALL display an informational message and fall back to manual code entry.

---

### Requirement 7 — Security Rules Enforcement

**User Story:** As a Guard, I want the system to enforce security rules based on verification status, so that unverified and blocked laptops are handled appropriately at the gate.

#### Acceptance Criteria

1. WHILE a Laptop's Verification Status is `PENDING`, THE System SHALL require the Guard to complete Physical Verification before logging any ENTRY or EXIT event.
2. WHILE a Laptop's Verification Status is `VERIFIED`, THE System SHALL permit the Guard to log ENTRY or EXIT events without additional steps.
3. WHILE a Laptop's Verification Status is `BLOCKED`, THE System SHALL prevent the Guard from logging any ENTRY or EXIT event and display a block alert on the Guard Dashboard.
4. WHEN the backend receives a gate action request, THE System SHALL validate the Laptop's current Verification Status before processing the action, regardless of the frontend state.

---

### Requirement 8 — API Layer for Guard Operations

**User Story:** As a developer, I want a clean set of backend API endpoints for guard operations, so that the Guard Dashboard can perform all required actions reliably.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /api/gate/lookup` endpoint that accepts a query parameter for either an 8-digit Unique Code or a Student ID and returns the matching Laptop with owner details and Verification Status.
2. THE System SHALL expose a `POST /api/gate/verify/:laptopId` endpoint that sets a `PENDING` Laptop to `VERIFIED` and is accessible only to users with role `GUARD` or `ADMIN`.
3. THE System SHALL expose a `POST /api/gate/entry/:laptopId` endpoint that logs an ENTRY event and is accessible only to users with role `GUARD` or `ADMIN`.
4. THE System SHALL expose a `POST /api/gate/exit/:laptopId` endpoint that logs an EXIT event and is accessible only to users with role `GUARD` or `ADMIN`.
5. THE System SHALL expose a `POST /api/gate/block/:laptopId` endpoint that sets a Laptop's Verification Status to `BLOCKED` and is accessible only to users with role `GUARD` or `ADMIN`.
6. WHEN any gate API endpoint receives a request from a user without role `GUARD` or `ADMIN`, THE System SHALL return a 403 Forbidden response.
