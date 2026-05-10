# Design Document: Admin Student Management

## Overview

This feature adds a **Students** tab to the existing Admin Dashboard. The admin can:
- View all preloaded student records in a searchable, paginated table
- Add a single student via a modal form
- Delete a student with a confirmation prompt
- Bulk-upload students from a CSV or Excel (.xlsx) file with a client-side preview before committing

All data operations call the existing authenticated `/api/students` backend endpoints. No new backend routes are needed. The frontend parses CSV/Excel files using the `papaparse` (CSV) and `xlsx` (Excel) libraries.

---

## Architecture

```
AdminDashboard.jsx
  └── StudentsTab (new component)
        ├── Student table (paginated, searchable)
        ├── AddStudentModal (form for single record)
        ├── DeleteConfirmModal (confirmation prompt)
        └── BulkUploadModal
              ├── File input (.csv / .xlsx)
              ├── Preview table (parsed rows)
              └── Import summary (success / failure counts)

API calls (all authenticated via existing axios instance):
  GET    /api/students          → load table
  POST   /api/students          → add single / bulk rows
  DELETE /api/students/:id      → delete record
```

---

## Components and Interfaces

### `StudentsTab`

Top-level component rendered when the "Students" tab is active in `AdminDashboard`.

State:
- `students[]` — fetched list
- `loading`, `error` — fetch state
- `search` — filter string
- `page` — current page
- `showAddModal` — boolean
- `showUploadModal` — boolean
- `deleteTarget` — student id to confirm deletion, or null

Props: none (reads auth token via existing axios interceptor)

### `AddStudentModal`

Form fields: `id`, `username`, `name`, `department`, `photo` (optional).

- Client-side validation: all required fields non-empty before submit
- On submit: `POST /api/students`
- On 409: show "Student ID or username already exists"
- On success: close modal, call `onSuccess()` to refresh list

### `DeleteConfirmModal`

Simple confirmation dialog. On confirm: `DELETE /api/students/:id`. On success: remove from local list.

### `BulkUploadModal`

Steps:
1. File picker (`.csv`, `.xlsx` only)
2. Parse file client-side → show preview table (first 10 rows + total count)
3. Confirm → fire `POST /api/students` for each valid row sequentially
4. Show summary: `{ succeeded: N, failed: M, errors: [...] }`

Parser interface:
```js
// Returns array of { id, username, name, department, photo? }
// Skips rows missing any required field; adds them to skipped[]
parseFile(file) → Promise<{ rows: StudentRow[], skipped: number[] }>
```

Libraries:
- `papaparse` — CSV parsing (already common in React projects, lightweight)
- `xlsx` (SheetJS) — Excel parsing

---

## Data Models

No new data models. Uses the existing `Student` shape:

```ts
interface Student {
  id: string          // student ID e.g. "ETS0001/15"
  username: string
  name: string
  department: string
  photo?: string
  email?: string      // null until activation
  isActivated: boolean
}
```

CSV/Excel expected header row (case-insensitive matching):
```
id, username, name, department, photo
```
`photo` is optional — missing column or empty cell is treated as null.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

Property 1: Student table displays all required fields
*For any* list of student records returned by the API, the rendered table should contain each student's `id`, `username`, `name`, `department`, and `isActivated` value.
**Validates: Requirements 1.2**

---

Property 2: Search filter is correct and complete
*For any* list of students and any non-empty search string, the filtered result should contain exactly those students where at least one of `id`, `username`, `name`, or `department` contains the search string (case-insensitive), and no students that do not match.
**Validates: Requirements 1.3**

---

Property 3: Add form rejects missing required fields
*For any* form submission where one or more of `id`, `username`, `name`, or `department` is absent or empty, the component should not call the API and should display a validation error.
**Validates: Requirements 2.3**

---

Property 4: Delete removes the correct record
*For any* student list and any student in that list, confirming deletion of that student should result in a list that no longer contains that student's `id`, and all other students remain unchanged.
**Validates: Requirements 3.2**

---

Property 5: File parser maps header columns to correct fields
*For any* CSV or Excel file with a valid header row (in any column order), the parser should return row objects where each field value matches the cell under the corresponding header column.
**Validates: Requirements 4.4**

---

Property 6: File parser skips rows with missing required fields
*For any* file containing rows where one or more required fields (`id`, `username`, `name`, `department`) are empty or absent, the parser should exclude those rows from the valid output and count them as skipped.
**Validates: Requirements 4.5**

---

Property 7: Bulk import fires one request per valid row
*For any* set of N valid parsed rows, the bulk import should call `POST /api/students` exactly N times, and the success/failure summary counts should sum to N.
**Validates: Requirements 4.3**

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `GET /api/students` fails | Show error banner with retry button |
| `POST /api/students` returns 409 | Show "Student ID or username already exists" inline |
| `POST /api/students` returns other error | Show generic error message |
| `DELETE /api/students/:id` fails | Show error toast; keep record in list |
| Invalid file type selected | Show "Only .csv and .xlsx files are supported" |
| CSV/Excel parse error | Show "Could not parse file. Check the format and try again." |
| Bulk import partial failure | Show summary: "X added, Y failed" with list of failed IDs |

---

## Testing Strategy

### Property-Based Testing (fast-check)

Frontend tests use `vitest` + `@testing-library/react` + `fast-check`. Property tests live alongside the component in `frontend/src/pages/`.

Each correctness property maps to one property-based test annotated with:
```js
// **Feature: admin-student-management, Property N: <property text>**
```

Key generators:
- `fc.record({ id: fc.string(), username: fc.string(), name: fc.string(), department: fc.string(), isActivated: fc.boolean() })` for arbitrary student objects
- `fc.array(studentArb)` for arbitrary student lists
- `fc.string()` for arbitrary search queries
- `fc.record(...)` with some fields set to `fc.constant('')` for invalid form inputs

### Unit Tests

- `StudentsTab`: renders table, empty state, error state, search filtering
- `AddStudentModal`: form validation, success flow, 409 error display
- `DeleteConfirmModal`: confirmation prompt, success removal, failure handling
- `BulkUploadModal`: file type rejection, preview display, import summary
- `parseFile` utility: CSV parsing, Excel parsing, header mapping, skipped rows
