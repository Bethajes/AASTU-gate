# Requirements Document

## Introduction

This feature adds a Students management tab to the existing Admin Dashboard. The admin can view all preloaded student records, add students one at a time via a form, and bulk-upload many students at once by uploading a CSV file. The admin can also edit and delete existing student records. All operations call the existing authenticated `/api/students` backend endpoints. No new backend endpoints are required.

## Glossary

- **Admin**: A privileged user with role `ADMIN` who manages student data.
- **Student Record**: A row in the `Student` table with fields: `id` (student ID), `username`, `name`, `department`, `photo`, `isActivated`, and `email` (nullable).
- **Students Tab**: A new tab added to the Admin Dashboard for managing student records.
- **Add Student Form**: A modal or inline form for creating a single student record.
- **Bulk Upload**: A file upload interaction that parses a CSV or Excel file and creates multiple student records in bulk.
- **CSV**: Comma-Separated Values file format (`.csv`) used for bulk data import.
- **Excel**: Microsoft Excel spreadsheet format (`.xlsx`) used for bulk data import.
- **Activation Status**: The `isActivated` boolean on a student record indicating whether the student has completed account setup.

---

## Requirements

### Requirement 1

**User Story:** As an admin, I want to view all preloaded student records in a table, so that I can see who has been added to the system and their activation status.

#### Acceptance Criteria

1. WHEN an admin navigates to the Students tab, THE Students Tab SHALL fetch and display all student records from `GET /api/students` in a paginated table.
2. WHEN student records are displayed, THE Students Tab SHALL show each student's `id`, `username`, `name`, `department`, and `isActivated` status.
3. WHEN the admin types in the search input, THE Students Tab SHALL filter the displayed rows to only those matching the query against `id`, `username`, `name`, or `department`.
4. IF the student list is empty, THE Students Tab SHALL display a message indicating no students have been added yet.
5. IF the fetch request fails, THE Students Tab SHALL display an error message with a retry option.

---

### Requirement 2

**User Story:** As an admin, I want to add a single student record via a form, so that I can register individual students into the system.

#### Acceptance Criteria

1. WHEN an admin clicks the "Add Student" button, THE Students Tab SHALL display a form with inputs for `id`, `username`, `name`, `department`, and optionally `photo`.
2. WHEN the admin submits the form with all required fields, THE Students Tab SHALL send a `POST /api/students` request and add the new record to the displayed list on success.
3. IF the form is submitted with any required field (`id`, `username`, `name`, `department`) empty, THE Students Tab SHALL prevent submission and display a validation error.
4. IF the backend returns a 409 conflict error, THE Students Tab SHALL display a message indicating the student ID or username already exists.
5. WHEN a student is successfully added, THE Students Tab SHALL close the form and refresh the student list.

---

### Requirement 3

**User Story:** As an admin, I want to delete a student record, so that I can remove incorrectly added entries.

#### Acceptance Criteria

1. WHEN an admin clicks the delete button on a student row, THE Students Tab SHALL prompt the admin to confirm the deletion before proceeding.
2. WHEN the admin confirms deletion, THE Students Tab SHALL send a `DELETE /api/students/:id` request and remove the record from the displayed list on success.
3. IF the delete request fails, THE Students Tab SHALL display an error message without removing the record from the list.

---

### Requirement 4

**User Story:** As an admin, I want to upload a CSV or Excel file to bulk-create student records, so that I can preload many students at once without entering them one by one.

#### Acceptance Criteria

1. WHEN an admin clicks the "Upload File" button, THE Students Tab SHALL display a file input that accepts `.csv` and `.xlsx` files only.
2. WHEN a valid file is selected, THE Students Tab SHALL parse the file client-side and display a preview of the rows to be imported before submission.
3. WHEN the admin confirms the import, THE Students Tab SHALL send one `POST /api/students` request per parsed row and display a summary of how many records succeeded and how many failed.
4. THE Students Tab SHALL expect the file to have a header row with columns: `id`, `username`, `name`, `department`, and optionally `photo`.
5. IF a file row is missing any required field (`id`, `username`, `name`, `department`), THE Students Tab SHALL skip that row and include it in the failure summary.
6. WHEN the bulk import completes, THE Students Tab SHALL refresh the student list to reflect all newly added records.
