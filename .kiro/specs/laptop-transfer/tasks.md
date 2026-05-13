# Implementation Plan

- [x] 1. Add database migration and update Prisma schema
  - Create a new migration SQL file that adds the `laptop_transfer_logs` table with columns: `id`, `laptopId` (FK → Laptop), `fromUserId` (FK → User), `toUserId` (FK → User), `transferredById` (FK → User), `transferredAt`
  - Add the `LaptopTransferLog` model to `backend/prisma/schema.prisma` with the four relations
  - Add back-relation fields to the `Laptop` and `User` models in the schema
  - _Requirements: 1.3_

- [-] 2. Implement the transfer controller functions
  - [x] 2.1 Implement `transferLaptop` in `backend/src/controllers/laptop.controller.js`
    - Validate that the laptop exists (404 if not)
    - Validate that `targetStudentId` resolves to an activated User account (400 if not)
    - Reject transfer to the current owner (400)
    - Execute UPDATE on `Laptop` (set `ownerId`, reset `verificationStatus` to `PENDING`, null out `verifiedAt` and `verifiedById`) and INSERT into `LaptopTransferLog` in a single SQL transaction
    - Return the updated laptop fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implement `getLaptopTransferLogs` in `backend/src/controllers/laptop.controller.js`
    - Query `LaptopTransferLog` joined with `User` (fromUser, toUser, transferredBy) for the given laptop ID
    - Return entries ordered by `transferredAt` DESC
    - _Requirements: 3.1, 3.2_

  - [x] 2.3 Write property test: Transfer changes ownership and resets verification
    - **Feature: laptop-transfer, Property 1: Transfer changes ownership AND resets verification**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 2.4 Write property test: Transfer creates a correct audit log entry
    - **Feature: laptop-transfer, Property 2: Transfer creates a correct audit log entry**
    - **Validates: Requirements 1.3**

  - [x] 2.5 Write property test: Transfer to non-existent student is rejected
    - **Feature: laptop-transfer, Property 3: Transfer to non-existent student is rejected**
    - **Validates: Requirements 1.5**

- [x] 3. Register the new routes
  - Add `POST /laptops/:id/transfer` (ADMIN only) → `transferLaptop` to `backend/src/routes/laptop.routes.js`
  - Add `GET /laptops/:id/transfer-logs` (ADMIN only) → `getLaptopTransferLogs` to `backend/src/routes/laptop.routes.js`
  - _Requirements: 1.1, 3.1_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Build the `TransferLaptopModal` React component
  - [x] 5.1 Create `frontend/src/pages/TransferLaptopModal.jsx`
    - Accept props: `laptop` (current laptop object), `onClose`, `onSuccess`
    - Display laptop brand/model/serial and current owner name + student ID
    - Include a text input for searching students (filter by name or student ID against the existing students list fetched from the API)
    - Show a filtered dropdown/list of matching students
    - On confirm, call `POST /api/laptops/:id/transfer` with the selected student's ID
    - Display success message and call `onSuccess` on completion
    - Display API error inline without closing the modal
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Write property test: Student search filter returns only matching results
    - **Feature: laptop-transfer, Property 5: Student search filter returns only matching results**
    - **Validates: Requirements 2.2**

- [x] 6. Wire `TransferLaptopModal` into `StudentLaptopsPanel`
  - Add a "Transfer" button to each laptop card in `frontend/src/pages/StudentLaptopsPanel.jsx`
  - Manage `transferLaptopId` state; render `TransferLaptopModal` when set
  - On `onSuccess`, close the modal and call `fetchLaptops()` to refresh the list
  - _Requirements: 2.1, 2.3_

- [x] 7. Add transfer history display to `StudentLaptopsPanel`
  - Add a "History" toggle button per laptop card
  - When toggled, fetch `GET /api/laptops/:id/transfer-logs` and render the log entries (previous owner, new owner, admin, timestamp)
  - Show "No transfer history" when the list is empty
  - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.1 Write property test: Transfer history is ordered descending with correct fields
    - **Feature: laptop-transfer, Property 4: Transfer history is ordered descending with correct fields**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 8. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
