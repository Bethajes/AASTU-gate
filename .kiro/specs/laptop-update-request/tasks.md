# Implementation Plan — Laptop Update Request

- [ ] 1. Add database migration for laptop_update_requests table
  - Write raw SQL migration file creating the `UpdateRequestStatus` enum and `laptop_update_requests` table with FK constraints to `Laptop` and `User`
  - Update `backend/prisma/schema.prisma` to add the `LaptopUpdateRequest` model and back-relations on `Laptop` and `User`
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 2. Implement the update request controller
- [ ] 2.1 Implement `createUpdateRequest` handler
  - Validate that at least one of `newBrand`, `newSerialNumber`, or photo is provided
  - Verify the target laptop belongs to the requesting student (403 if not)
  - Check for an existing PENDING request for the same laptop (409 if found)
  - Insert a new row into `laptop_update_requests` with status PENDING
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3_

- [ ]* 2.2 Write property test for Property 1: Request creation invariants
  - **Property 1: Request creation invariants**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [ ]* 2.3 Write property test for Property 2: Ownership enforcement
  - **Property 2: Ownership enforcement**
  - **Validates: Requirements 1.5**

- [ ]* 2.4 Write property test for Property 4: Duplicate PENDING request prevention
  - **Property 4: Duplicate PENDING request prevention**
  - **Validates: Requirements 2.3**

- [ ] 2.5 Implement `listUpdateRequests` handler (Reviewer)
  - JOIN `laptop_update_requests` with `Laptop` and `User` to return current laptop data, proposed new data, and student info
  - Return all requests ordered by `requestedAt` descending
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]* 2.6 Write property test for Property 5: Reviewer list contains full comparison data
  - **Property 5: Reviewer list contains full comparison data**
  - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 2.7 Implement `approveUpdateRequest` handler
  - Fetch the request; return 404 if not found, 409 if status is not PENDING
  - Update the `Laptop` row with non-null new values from the request
  - Set `Laptop.verificationStatus` to PENDING
  - Set request status to APPROVED, `reviewedAt` to NOW(), `reviewedById` to reviewer's ID
  - _Requirements: 4.1, 4.2, 4.3, 6.1_

- [ ]* 2.8 Write property test for Property 6: Approval updates laptop and resets verification status
  - **Property 6: Approval updates laptop and resets verification status**
  - **Validates: Requirements 4.1, 4.2, 4.3, 6.1**

- [ ]* 2.9 Write property test for Property 7: Non-PENDING requests reject approve/reject with 409
  - **Property 7: Non-PENDING requests reject approve/reject with 409**
  - **Validates: Requirements 4.4, 5.3**

- [ ] 2.10 Implement `rejectUpdateRequest` handler
  - Fetch the request; return 404 if not found, 409 if status is not PENDING
  - Set request status to REJECTED, `reviewedAt` to NOW(), `reviewedById` to reviewer's ID
  - Leave the `Laptop` row unchanged
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 2.11 Write property test for Property 8: Rejection leaves laptop unchanged
  - **Property 8: Rejection leaves laptop unchanged**
  - **Validates: Requirements 5.1, 5.2**

- [ ] 3. Implement `listMyUpdateRequests` handler (Student)
  - Return all `LaptopUpdateRequest` rows for the authenticated student's laptops
  - Include status, new values, and `requestedAt`, ordered by `requestedAt` descending
  - _Requirements: 2.1, 2.2_

- [ ]* 3.1 Write property test for Property 3: Student list completeness and ordering
  - **Property 3: Student list completeness and ordering**
  - **Validates: Requirements 2.1, 2.2**

- [ ] 4. Wire up routes and RBAC middleware
  - Add 5 routes to `backend/src/routes/laptop.routes.js`:
    - `POST /update-request` → `protect`, `allowRoles('STUDENT')`, `upload.single('photo')`, `createUpdateRequest`
    - `GET /update-request/my` → `protect`, `allowRoles('STUDENT')`, `listMyUpdateRequests`
    - `GET /update-request` → `protect`, `allowRoles('ADMIN', 'GUARD')`, `listUpdateRequests`
    - `PUT /update-request/:id/approve` → `protect`, `allowRoles('ADMIN', 'GUARD')`, `approveUpdateRequest`
    - `PUT /update-request/:id/reject` → `protect`, `allowRoles('ADMIN', 'GUARD')`, `rejectUpdateRequest`
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 4.1 Write property test for Property 9: RBAC enforcement
  - **Property 9: RBAC enforcement**
  - **Validates: Requirements 7.1, 7.2**

- [ ] 5. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Build the Student update request UI
- [ ] 6.1 Create `LaptopUpdateForm` component
  - Form with optional fields: new brand, new serial number, photo upload, reason
  - Submit calls `POST /api/laptops/update-request` with `multipart/form-data`
  - Show validation error if no fields are filled
  - _Requirements: 1.1, 1.4_

- [ ] 6.2 Integrate `LaptopUpdateForm` into `StudentDashboard`
  - Add a "Request Update" button per laptop card that toggles the form
  - Show current pending request status badge if a PENDING request exists (fetched from `GET /api/laptops/update-request/my`)
  - Disable the "Request Update" button while a PENDING request exists
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 7. Build the Reviewer update requests dashboard
- [ ] 7.1 Create `UpdateRequestsDashboard` page
  - Fetch all requests from `GET /api/laptops/update-request`
  - Display each request as a card with: student name/ID, old vs. new data side-by-side, old and new images side-by-side, status badge, Approve and Reject buttons
  - Approve button calls `PUT /api/laptops/update-request/:id/approve`
  - Reject button calls `PUT /api/laptops/update-request/:id/reject`
  - Optimistically update the card status after action
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2_

- [ ] 7.2 Add route and navigation link for `UpdateRequestsDashboard`
  - Add `/update-requests` route in `frontend/src/App.jsx` protected for ADMIN and GUARD roles
  - Add a navigation link in `AdminDashboard` tabs or `Navbar` for ADMIN/GUARD users
  - _Requirements: 7.1, 7.2_

- [ ] 8. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.
