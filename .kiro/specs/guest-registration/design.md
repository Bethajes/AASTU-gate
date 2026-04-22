# Design Document — Guest Registration

## Overview

The Guest Registration feature extends the existing Guard Scanner page to allow guards to register visiting guests and track their device entry/exit. Guests are not system users — they have no account, no institutional email, and no photo requirement. A guard fills out a simple form, the system generates an 8-digit Guest Code, and from that point the guest pass flows through the same entry/exit gate logic as student laptops.

The feature touches three layers:
- A new `GuestPass` database table
- New backend API routes under `/api/guests`
- An inline guest registration panel added to the existing `GuardScanner.jsx` page

---

## Architecture

```
GuardScanner.jsx (frontend)
  ├── Tab: Scan Laptop (existing)
  ├── Tab: Register Guest (new)
  │     └── GuestRegistrationForm component
  └── Recent Scans log (unified — laptops + guests)

Backend Express API
  ├── POST   /api/guests/register       → create GuestPass
  ├── GET    /api/guests/lookup?code=   → find GuestPass by code
  ├── POST   /api/guests/entry/:id      → log guest entry
  ├── POST   /api/guests/exit/:id       → log guest exit
  └── (existing /api/gate/* unchanged)

Database (PostgreSQL via raw pool)
  └── GuestPass table (new)
```

The existing `/api/gate/lookup` endpoint will be extended to also search the `GuestPass` table so the guard's single code-input field works for both laptops and guest passes.

---

## Components and Interfaces

### Frontend

**`GuardScanner.jsx` (modified)**
- Add a two-tab layout: "Scan" (existing) and "Register Guest" (new).
- The scan tab's lookup logic calls the unified lookup endpoint; if the result has `type: 'guest'` it renders guest details (no photo section).
- Entry/exit submission routes to `/api/guests/entry/:id` or `/api/gate/entry/:id` based on record type.

**`GuestRegistrationForm` (new inline component or section)**
- Fields: Full Name, Phone Number, Purpose of Visit, Device Brand, Device Model, Device Serial Number.
- No photo upload field.
- On success: shows the generated Guest Code prominently and resets the form.

### Backend

**`guest.controller.js`** — new file with handlers:
- `registerGuest` — validates fields, generates 8-digit code, inserts GuestPass row.
- `lookupGuest` — finds GuestPass by code.
- `guestEntry` — validates status/campus state, updates `isInCampus`, inserts GateLog.
- `guestExit` — same as above for exit.

**`guest.routes.js`** — new file, all routes protected with `allowRoles('GUARD', 'ADMIN')`.

**`gate.controller.js` (modified)**
- `lookupLaptop` extended to also query `GuestPass` and return a unified result with a `type` field (`'laptop'` or `'guest'`).
- `getLogs` extended to include guest pass events (JOIN with GuestPass).

---

## Data Models

### New table: `GuestPass`

```sql
CREATE TABLE "GuestPass" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "guestName"          TEXT NOT NULL,
  "phone"              TEXT NOT NULL,
  "purpose"            TEXT NOT NULL,
  "deviceBrand"        TEXT NOT NULL,
  "deviceModel"        TEXT NOT NULL,
  "serialNumber"       TEXT NOT NULL,
  "guestCode"          CHAR(8) UNIQUE NOT NULL,
  "isInCampus"         BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
  "registeredById"     UUID NOT NULL REFERENCES "User"("id"),
  "registeredAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Key decisions:
- `verificationStatus` defaults to `VERIFIED` — guards physically see the guest, so no separate verification step is needed.
- No `photoUrl` column.
- `registeredById` links to the guard who created the record.
- `guestCode` is an 8-digit string (same format as laptop `qrCode`) so the scanner input works identically.

### GateLog (existing, unchanged)

Guest entry/exit events are stored in the existing `GateLog` table. Since `GateLog.laptopId` is a foreign key to `Laptop`, guest events will use a nullable `laptopId` and a new nullable `guestPassId` column.

```sql
ALTER TABLE "GateLog" ADD COLUMN "guestPassId" UUID REFERENCES "GuestPass"("id");
ALTER TABLE "GateLog" ALTER COLUMN "laptopId" DROP NOT NULL;
```

This keeps the log unified while allowing either a laptop or a guest pass to be referenced.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


**Property 1: GuestPass creation invariants**
*For any* valid guest registration payload submitted by a guard, the created GuestPass record SHALL contain all submitted fields (guestName, phone, purpose, deviceBrand, deviceModel, serialNumber), have a guestCode that is exactly 8 numeric digits, have verificationStatus equal to VERIFIED, and have isInCampus equal to false.
**Validates: Requirements 1.1, 1.3, 1.4**

**Property 2: Missing required field rejection**
*For any* guest registration payload where at least one required field (guestName, phone, purpose, deviceBrand, deviceModel, serialNumber) is absent or blank, THE System SHALL return a 4xx error response and SHALL NOT create a GuestPass record.
**Validates: Requirements 1.2**

**Property 3: Guest pass lookup round trip**
*For any* GuestPass created in the system, looking it up by its guestCode SHALL return a response containing guestName, phone, purpose, deviceBrand, deviceModel, serialNumber, verificationStatus, and isInCampus, and SHALL NOT contain a photoUrl field.
**Validates: Requirements 2.1, 2.2, 2.4**

**Property 4: Entry then exit round trip restores campus state**
*For any* VERIFIED GuestPass with isInCampus false, logging entry SHALL set isInCampus to true and insert a GateLog with scanType IN; subsequently logging exit SHALL set isInCampus back to false and insert a GateLog with scanType OUT.
**Validates: Requirements 3.1, 3.2**

**Property 5: Blocked guest pass rejects entry and exit**
*For any* GuestPass with verificationStatus BLOCKED, both the entry and exit endpoints SHALL return a 4xx error response and SHALL NOT modify isInCampus or insert a GateLog record.
**Validates: Requirements 3.3**

**Property 6: Guest events appear in gate log with required fields**
*For any* guest entry or exit event, the gate log endpoint SHALL return a record that includes the guest's name, device brand, device serial number, scan type, and timestamp.
**Validates: Requirements 4.1, 4.2**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| Missing required field on registration | 400 | `"<fieldName> is required"` |
| Guest code collision (retry internally) | — | Retry up to 5 times before 500 |
| Guest pass not found by code | 404 | `"No record found"` |
| Entry on already-in-campus pass | 400 | `"Guest is already inside campus"` |
| Exit on already-outside pass | 400 | `"Guest is not inside campus"` |
| Entry/exit on BLOCKED pass | 403 | `"Guest pass is blocked"` |
| Unauthorized role | 403 | `"Access denied: your role is \"...\""` (existing middleware) |

---

## Testing Strategy

### Property-Based Testing

The project uses JavaScript (Node.js backend, React frontend). The property-based testing library is **fast-check** (`npm install --save-dev fast-check`).

Each property test runs a minimum of 100 iterations. Every property test is tagged with a comment in this exact format:
`// Feature: guest-registration, Property <N>: <property text>`

Each correctness property from this document maps to exactly one property-based test:

| Property | Test description |
|---|---|
| P1 | Generate random valid guest payloads, POST to `/api/guests/register`, assert response fields and defaults |
| P2 | Generate valid payloads then randomly blank one required field, assert 4xx and no DB record |
| P3 | Create a guest pass, look it up by code, assert all fields present and no photoUrl |
| P4 | Create a guest pass, call entry, assert isInCampus true + log IN; call exit, assert isInCampus false + log OUT |
| P5 | Create a guest pass, set status to BLOCKED, call entry and exit, assert both return 4xx and no state change |
| P6 | Create a guest pass, log entry, fetch `/api/gate/logs`, assert guest record contains required fields |

### Unit Tests

- `generateGuestCode()` utility: verify output is always 8 digits, numeric only.
- Validation helper: verify each required field triggers an error when missing.
- GateLog query: verify guest events are returned alongside laptop events.

### Integration

All property tests run against a real test database (same PostgreSQL instance, separate test schema or truncated tables). No mocking of the database layer.
