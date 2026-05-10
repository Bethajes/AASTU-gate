# Implementation Plan

- [x] 1. Install parsing libraries and create parseFile utility
  - Install `papaparse` and `xlsx` in the frontend package
  - Create `frontend/src/utils/parseStudentFile.js` that exports `parseFile(file)`
  - For `.csv` files: use PapaParse to parse with header row; map columns case-insensitively
  - For `.xlsx` files: use SheetJS to read the first sheet; convert to row objects with the same header mapping
  - Return `{ rows: StudentRow[], skipped: number }` where rows missing any required field are excluded and counted as skipped
  - _Requirements: 4.4, 4.5_

- [x] 1.1 Write property tests for parseFile (Properties 5, 6)
  - **Property 5: File parser maps header columns to correct fields**
  - **Property 6: File parser skips rows with missing required fields**
  - **Validates: Requirements 4.4, 4.5**

- [x] 2. Build StudentsTab component
- [x] 2.1 Implement StudentsTab with table, search, and pagination
  - Create `frontend/src/pages/StudentsTab.jsx`
  - On mount: fetch `GET /api/students` and store in state
  - Render a table with columns: Student ID, Username, Name, Department, Status (activated badge)
  - Add a search input that filters rows against `id`, `username`, `name`, `department` (case-insensitive)
  - Paginate results at 20 rows per page using the existing `Pagination` component pattern
  - Show empty state message when list is empty; show error banner with retry when fetch fails
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.2 Write property tests for StudentsTab (Properties 1, 2)
  - **Property 1: Student table displays all required fields**
  - **Property 2: Search filter is correct and complete**
  - **Validates: Requirements 1.2, 1.3**

- [x] 3. Build AddStudentModal
  - Create `AddStudentModal` component (modal overlay) with inputs for `id`, `username`, `name`, `department`, and optional `photo`
  - Validate all required fields are non-empty before calling the API; show inline validation errors if not
  - On submit: `POST /api/students`; on 409 show "Student ID or username already exists"; on success close modal and call `onSuccess()`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.1 Write property test for AddStudentModal (Property 3)
  - **Property 3: Add form rejects missing required fields**
  - **Validates: Requirements 2.3**

- [x] 4. Build DeleteConfirmModal
  - Create `DeleteConfirmModal` component that shows the student name and asks for confirmation
  - On confirm: `DELETE /api/students/:id`; on success remove the record from the local list; on failure show error message and keep the record
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.1 Write property test for DeleteConfirmModal (Property 4)
  - **Property 4: Delete removes the correct record**
  - **Validates: Requirements 3.2**

- [x] 5. Build BulkUploadModal
  - Create `BulkUploadModal` component with a file input restricted to `.csv` and `.xlsx`
  - On file selection: call `parseFile(file)`, show a preview table of up to 10 rows and total count; show skipped row count if any
  - On confirm: iterate valid rows and call `POST /api/students` for each; track success and failure counts
  - After all requests complete: show summary "X added, Y failed" with failed student IDs listed; call `onSuccess()` to refresh the list
  - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 5.1 Write property test for BulkUploadModal (Property 7)
  - **Property 7: Bulk import fires one request per valid row**
  - **Validates: Requirements 4.3**

- [x] 6. Wire StudentsTab into AdminDashboard
  - Add `{ id: 'students', label: '👥 Students' }` to the `TABS` constant in `AdminDashboard.jsx`
  - Import `StudentsTab` and render it when `activeTab === 'students'`
  - Add "Add Student" and "Upload File" buttons to the `StudentsTab` header that open the respective modals
  - _Requirements: 1.1, 2.1, 4.1_

- [x] 7. Final Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
