# Design Document — Hybrid Gate Verification

## Overview

This design extends the existing AASTU Laptop Gate Management System with a hybrid verification layer. The core addition is a three-state lifecycle (`PENDING` → `VERIFIED` → `BLOCKED`) on every laptop, a redesigned Guard Dashboard that drives the physical verification flow, structured ENTRY/EXIT gate logging, and optional QR camera scanning via the browser's `getUserMedia` API.

The existing Express backend, PostgreSQL database (accessed via raw `pg` pool), React frontend, and JWT auth middleware are all preserved. No existing tables are dropped; only additive migrations are applied.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Guard       │  │  Student     │  │  Admin        │  │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard    │  │
│  │  (upgraded)  │  │  (unchanged) │  │  (unchanged)  │  │
│  └──────┬───────┘  └──────────────┘  └───────────────┘  │
│         │ axios + JWT                                     │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────┐
│                  Express API (Node.js)                   │
│  /api/auth   /api/laptops   /api/gate (extended)        │
│                                                          │
│  Middleware: protect (JWT) → allowRoles (GUARD|ADMIN)   │
└─────────┬───────────────────────────────────────────────┘
          │ pg pool (raw SQL)
┌─────────▼───────────────────────────────────────────────┐
│              PostgreSQL Database                         │
│  "User"  "Laptop" (+ 3 new cols)  "GateLog" (extended) │
└─────────────────────────────────────────────────────────┘
```

The system follows a layered architecture: React pages call the Axios API client, which hits Express routes protected by JWT middleware, which delegate to controllers that execute raw SQL against PostgreSQL.

---

## Components and Interfaces

### Backend

#### New / Modified Files

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `VerificationStatus` enum, new fields on `Laptop`, update `GateLog` |
| `backend/prisma/migrations/…` | New migration SQL |
| `backend/src/controllers/gate.controller.js` | Replace/extend with new handler functions |
| `backend/src/routes/gate.routes.js` | Add new route definitions |

#### Gate Controller — New Endpoints

```
GET  /api/gate/lookup?code=&studentId=   → lookupLaptop
POST /api/gate/verify/:laptopId          → verifyLaptop
POST /api/gate/entry/:laptopId           → logEntry
POST /api/gate/exit/:laptopId            → logExit
POST /api/gate/block/:laptopId           → blockLaptop
GET  /api/gate/logs                      → getLogs (existing, kept)
POST /api/gate/scan                      → scanLaptop (existing, kept for backward compat)
```

### Frontend

#### Modified / New Files

| File | Change |
|---|---|
| `frontend/src/pages/GuardDashboard.jsx` | New page — replaces `GuardScanner.jsx` as the primary guard UI |
| `frontend/src/App.jsx` | Route `/guard` points to `GuardDashboard` |
| `frontend/src/api/gate.js` | New API helper module for gate calls |

`GuardScanner.jsx` is kept as-is for backward compatibility; `GuardDashboard.jsx` is the new primary guard page.

#### GuardDashboard Component Tree

```
GuardDashboard
├── SearchBar          (code input + student ID input + QR toggle)
├── QRScanner          (webcam preview, jsQR decoding — conditional)
├── LaptopCard         (photo, details, status badge)
│   ├── VerifyButton   (visible when PENDING)
│   ├── EntryButton    (visible when VERIFIED)
│   ├── ExitButton     (visible when VERIFIED)
│   ├── BlockButton    (visible when PENDING or VERIFIED)
│   └── BlockedAlert   (visible when BLOCKED)
└── RecentLogs         (last 10 gate log entries)
```

---

## Data Models

### Prisma Schema Changes

```prisma
enum VerificationStatus {
  PENDING
  VERIFIED
  BLOCKED
}

model Laptop {
  // --- existing fields preserved ---
  id                 String             @id @default(uuid())
  serialNumber       String             @unique
  brand              String
  model              String
  qrCode             String?            @unique
  isInCampus         Boolean            @default(false)
  registeredAt       DateTime           @default(now())
  photoUrl           String?
  ownerId            String
  owner              User               @relation(fields: [ownerId], references: [id])
  gateLogs           GateLog[]

  // --- new fields ---
  verificationStatus VerificationStatus @default(PENDING)
  verifiedAt         DateTime?
  verifiedById       String?
  verifiedBy         User?              @relation("LaptopVerifier", fields: [verifiedById], references: [id])
}

model GateLog {
  // --- existing fields preserved ---
  id          String   @id @default(uuid())
  scanType    ScanType              // kept for backward compat
  scannedAt   DateTime @default(now())
  laptopId    String
  laptop      Laptop   @relation(fields: [laptopId], references: [id])
  scannedById String
  scannedBy   User     @relation(fields: [scannedById], references: [id])

  // --- new field ---
  action      String?               // 'ENTRY' | 'EXIT' — nullable for old rows
}
```

### Migration SQL (additive only)

```sql
-- Add VerificationStatus enum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'BLOCKED');

-- Extend Laptop table
ALTER TABLE "Laptop"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verifiedAt"         TIMESTAMPTZ,
  ADD COLUMN "verifiedById"       TEXT REFERENCES "User"("id");

-- Extend GateLog table
ALTER TABLE "GateLog"
  ADD COLUMN "action" TEXT;
```

### API Response Shape — Laptop Lookup

```json
{
  "id": "uuid",
  "serial_number": "SN-DELL-001",
  "brand": "Dell",
  "model": "Latitude 5520",
  "qr_code": "48271935",
  "is_in_campus": false,
  "photo_url": "/uploads/laptops/abc.jpg",
  "verification_status": "PENDING",
  "verified_at": null,
  "verified_by_name": null,
  "owner_name": "Abebe Kebede",
  "student_id": "ETS0123/14"
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: New laptop starts PENDING

*For any* newly registered laptop, the verification status returned by the lookup endpoint SHALL equal `PENDING`.

**Validates: Requirements 1.1**

---

### Property 2: Verify transitions PENDING → VERIFIED

*For any* laptop with verification status `PENDING`, after a successful verify request, the verification status SHALL equal `VERIFIED`, `verified_at` SHALL be a non-null timestamp, and `verified_by` SHALL equal the requesting guard's user ID.

**Validates: Requirements 1.2, 4.2**

---

### Property 3: Block sets status to BLOCKED

*For any* laptop (regardless of current status `PENDING` or `VERIFIED`), after a successful block request, the verification status SHALL equal `BLOCKED`.

**Validates: Requirements 1.3**

---

### Property 4: BLOCKED laptop rejects gate actions

*For any* laptop whose verification status is `BLOCKED`, any ENTRY or EXIT request SHALL be rejected with a non-2xx HTTP status code.

**Validates: Requirements 1.5, 7.3**

---

### Property 5: PENDING laptop rejects gate actions

*For any* laptop whose verification status is `PENDING`, any ENTRY or EXIT request SHALL be rejected with a non-2xx HTTP status code.

**Validates: Requirements 7.1**

---

### Property 6: Entry log creates a GateLog record with action ENTRY

*For any* `VERIFIED` laptop, after a successful entry request, a GateLog record SHALL exist with action `ENTRY`, the correct laptop ID, and the guard's user ID.

**Validates: Requirements 5.1**

---

### Property 7: Exit log creates a GateLog record with action EXIT

*For any* `VERIFIED` laptop, after a successful exit request, a GateLog record SHALL exist with action `EXIT`, the correct laptop ID, and the guard's user ID.

**Validates: Requirements 5.2**

---

### Property 8: Entry sets isInCampus = true, Exit sets isInCampus = false

*For any* `VERIFIED` laptop, after a successful entry request `isInCampus` SHALL be `true`; after a subsequent exit request `isInCampus` SHALL be `false`.

**Validates: Requirements 5.3**

---

### Property 9: Verify is idempotent-safe — double verify is rejected

*For any* laptop whose verification status is `VERIFIED`, a second verify request SHALL be rejected with a 400 status code.

**Validates: Requirements 4.4**

---

### Property 10: Role enforcement — non-guard/admin is rejected

*For any* gate endpoint (`/verify`, `/entry`, `/exit`, `/block`), a request authenticated as a `STUDENT` SHALL be rejected with a 403 status code.

**Validates: Requirements 8.6**

---

### Property 11: Lookup by code and lookup by studentId return equivalent records

*For any* registered laptop, looking it up by its 8-digit unique code and looking it up by its owner's student ID SHALL return records with the same laptop ID.

**Validates: Requirements 8.1**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| Laptop not found (lookup) | 404 | `"No laptop found"` |
| Verify a non-PENDING laptop | 400 | `"Laptop is not in PENDING status"` |
| Entry/Exit on BLOCKED laptop | 403 | `"Laptop is blocked"` |
| Entry/Exit on PENDING laptop | 403 | `"Laptop must be verified first"` |
| Duplicate ENTRY (already on campus) | 400 | `"Laptop already inside campus"` |
| Duplicate EXIT (not on campus) | 400 | `"Laptop is not inside campus"` |
| Unauthorized role | 403 | `"Access denied"` |
| Missing/invalid JWT | 401 | `"No token provided"` / `"Invalid token"` |

All error responses follow the existing shape: `{ "message": "..." }`.

---

## Testing Strategy

### Property-Based Testing

The property-based testing library used is **[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript/Node.js). Each correctness property above is implemented as a single `fc.assert(fc.asyncProperty(...))` test running a minimum of **100 iterations**.

Each property-based test is tagged with a comment in this exact format:
```
// Feature: hybrid-gate-verification, Property N: <property text>
```

Tests live in `backend/src/tests/gate.property.test.js` and are run with **Vitest**.

### Unit Tests

Unit tests cover:
- Specific HTTP response shapes for each endpoint
- Edge cases: empty search query, missing fields in request body
- The `lookupLaptop` controller when both `code` and `studentId` are provided simultaneously

Unit tests live in `backend/src/tests/gate.unit.test.js`.

### Frontend Tests

The `GuardDashboard` component is tested with **React Testing Library** + **Vitest** to verify:
- Correct button visibility per verification status
- Error message display on failed lookup
- QR scanner toggle behavior

### Test Execution

```bash
# Backend tests (single run)
cd backend && npx vitest run

# Frontend tests (single run)
cd frontend && npx vitest run
```
