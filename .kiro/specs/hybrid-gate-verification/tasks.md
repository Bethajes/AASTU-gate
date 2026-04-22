# Implementation Plan — Hybrid Gate Verification

- [x] 1. Database migration — extend Laptop and GateLog tables
  - Add `VerificationStatus` enum (`PENDING`, `VERIFIED`, `BLOCKED`) to PostgreSQL
  - Add `verificationStatus` (default `PENDING`), `verifiedAt`, `verifiedById` columns to `Laptop` table
  - Add `action` TEXT column to `GateLog` table
  - Update `backend/prisma/schema.prisma` with new enum, new Laptop fields, and new GateLog field
  - Create a new Prisma migration file under `backend/prisma/migrations/`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [-] 2. Backend — gate controller and routes
- [x] 2.1 Implement `lookupLaptop` controller
  - Accept `?code=` or `?studentId=` query param
  - Return laptop with owner details and `verification_status`, `verified_at`, `verified_by_name`
  - Return 404 if not found
  - _Requirements: 8.1, 3.2_

- [ ] 2.2 Write property test for lookup (Property 11)
  - **Property 11: Lookup by code and lookup by studentId return equivalent records**
  - **Validates: Requirements 8.1**

- [x] 2.3 Implement `verifyLaptop` controller
  - Accept `POST /api/gate/verify/:laptopId`
  - Reject with 400 if status is not `PENDING`
  - Set `verificationStatus = VERIFIED`, `verifiedAt = NOW()`, `verifiedById = req.user.id`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 1.2_

- [x] 2.4 Write property tests for verify (Properties 2 and 9)
  - **Property 2: Verify transitions PENDING → VERIFIED**
  - **Validates: Requirements 1.2, 4.2**
  - **Property 9: Verify is idempotent-safe — double verify is rejected**
  - **Validates: Requirements 4.4**

- [x] 2.5 Implement `blockLaptop` controller
  - Accept `POST /api/gate/block/:laptopId`
  - Set `verificationStatus = BLOCKED`
  - _Requirements: 1.3, 8.5_

- [x] 2.6 Write property test for block (Property 3)
  - **Property 3: Block sets status to BLOCKED**
  - **Validates: Requirements 1.3**

- [x] 2.7 Implement `logEntry` controller
  - Accept `POST /api/gate/entry/:laptopId`
  - Reject with 403 if status is `BLOCKED` or `PENDING`
  - Reject with 400 if `isInCampus` is already `true`
  - Insert GateLog with `action = 'ENTRY'`, set `isInCampus = true`
  - _Requirements: 5.1, 5.3, 5.5, 7.1, 7.3, 1.5_

- [x] 2.8 Write property tests for entry (Properties 5, 6, 8)
  - **Property 5: PENDING laptop rejects gate actions**
  - **Validates: Requirements 7.1**
  - **Property 6: Entry log creates a GateLog record with action ENTRY**
  - **Validates: Requirements 5.1**
  - **Property 8: Entry sets isInCampus = true**
  - **Validates: Requirements 5.3**

- [x] 2.9 Implement `logExit` controller
  - Accept `POST /api/gate/exit/:laptopId`
  - Reject with 403 if status is `BLOCKED` or `PENDING`
  - Reject with 400 if `isInCampus` is already `false`
  - Insert GateLog with `action = 'EXIT'`, set `isInCampus = false`
  - _Requirements: 5.2, 5.3, 5.6, 7.1, 7.3_

- [x] 2.10 Write property tests for exit (Properties 4, 7, 8)
  - **Property 4: BLOCKED laptop rejects gate actions**
  - **Validates: Requirements 1.5, 7.3**
  - **Property 7: Exit log creates a GateLog record with action EXIT**
  - **Validates: Requirements 5.2**
  - **Property 8: Exit sets isInCampus = false**
  - **Validates: Requirements 5.3**

- [x] 2.11 Update gate routes file
  - Add routes for `lookup`, `verify/:laptopId`, `entry/:laptopId`, `exit/:laptopId`, `block/:laptopId`
  - Apply `protect` and `allowRoles('GUARD', 'ADMIN')` middleware to all new routes
  - Keep existing `/scan` and `/logs` routes intact
  - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 2.12 Write property test for role enforcement (Property 10)
  - **Property 10: Role enforcement — non-guard/admin is rejected**
  - **Validates: Requirements 8.6**

- [x] 3. Checkpoint — ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend — API helper and Guard Dashboard
- [x] 4.1 Create `frontend/src/api/gate.js` API helper
  - Export functions: `lookupLaptop(query)`, `verifyLaptop(id)`, `logEntry(id)`, `logExit(id)`, `blockLaptop(id)`, `fetchLogs()`
  - All functions use the existing Axios instance from `frontend/src/api/axios.js`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4.2 Build `GuardDashboard` — search and laptop card
  - Create `frontend/src/pages/GuardDashboard.jsx`
  - Implement search bar accepting 8-digit code or student ID
  - On successful lookup, render laptop photo, owner name, student ID, brand, model, serial number, and verification status badge
  - On failed lookup, display error message
  - _Requirements: 3.1, 3.2, 3.6_

- [x] 4.3 Add contextual action buttons based on verification status
  - Show "Verify Laptop" button only when status is `PENDING`
  - Show "Allow Entry" and "Allow Exit" buttons only when status is `VERIFIED`
  - Show "Block Laptop" button when status is `PENDING` or `VERIFIED`
  - Show a prominent blocked alert and disable all buttons when status is `BLOCKED`
  - Wire each button to the corresponding API helper function from 4.1
  - On success, refresh the laptop card with updated data
  - _Requirements: 3.3, 3.4, 3.5, 4.1, 5.1, 5.2, 1.3_

- [x] 4.4 Add recent gate logs panel to GuardDashboard
  - Fetch and display the last 10 gate log entries (brand, serial, action, timestamp, guard name)
  - Refresh logs after each successful action
  - _Requirements: 5.4_

- [x] 4.5 Implement QR camera scanner component
  - Add a "Scan QR" toggle button to the search bar area
  - When activated, request webcam via `getUserMedia` and render a `<video>` preview
  - Use `jsQR` library to decode frames from the video feed
  - When a valid QR code is detected, populate the search field and trigger lookup automatically
  - When deactivated, stop all webcam tracks and hide the preview
  - If `getUserMedia` is denied, display a fallback message and keep manual entry available
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.6 Update `App.jsx` to route `/guard` to `GuardDashboard`
  - Import `GuardDashboard` and replace the `GuardScanner` import on the `/guard` route
  - Keep `GuardScanner` file in place for backward compatibility
  - _Requirements: 3.1_

- [x] 4.7 Write frontend unit tests for GuardDashboard
  - Test that search input renders on mount
  - Test that laptop card shows correct buttons for each verification status (PENDING, VERIFIED, BLOCKED)
  - Test that error message renders when lookup returns 404
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5. Final Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
