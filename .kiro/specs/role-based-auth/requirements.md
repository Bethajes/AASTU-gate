# Requirements Document

## Introduction

The Laptop Gate Management System currently allows any user to self-register with any role (STUDENT, GUARD, ADMIN), which is a security vulnerability. This feature enforces a secure role assignment model where only students may self-register via the public API. GUARD and ADMIN accounts must be provisioned manually through a Prisma seed script. The frontend registration form must be restricted to student-only fields, and all protected routes must enforce role-based access control.

## Glossary

- **System**: The Laptop Gate Management System backend (Express.js) and frontend (React).
- **Register Endpoint**: The HTTP POST `/api/auth/register` route that creates new user accounts.
- **Login Endpoint**: The HTTP POST `/api/auth/login` route that authenticates all users.
- **Role**: A string enum value assigned to a user: `STUDENT`, `GUARD`, or `ADMIN`.
- **JWT**: JSON Web Token — a signed token issued on login containing the user's `id` and `role`.
- **Seed Script**: A Prisma-based Node.js script that pre-populates the database with GUARD and ADMIN accounts.
- **Auth Middleware**: Express middleware (`protect`) that validates the JWT on protected routes.
- **Role Guard Middleware**: Express middleware (`allowRoles`) that restricts route access by role.
- **Student Dashboard**: The frontend route `/student`, accessible only to users with role `STUDENT`.
- **Guard Dashboard**: The frontend route `/guard`, accessible only to users with role `GUARD`.
- **Admin Dashboard**: The frontend route `/admin`, accessible only to users with role `ADMIN`.

---

## Requirements

### Requirement 1

**User Story:** As a student, I want to register an account using only my name, email, and password, so that I can access the laptop management system without being able to assign myself a privileged role.

#### Acceptance Criteria

1. WHEN a registration request is received, THE System SHALL accept only `name`, `email`, and `password` fields and SHALL always assign the role `STUDENT` to the created user.
2. WHEN a registration request body contains a `role` field, THE System SHALL reject the request with HTTP status 403 and the message `"Role assignment is not allowed"`.
3. WHEN a registration request is missing `name`, `email`, or `password`, THE System SHALL reject the request with HTTP status 400 and a descriptive validation message.
4. WHEN a valid registration request is processed, THE System SHALL store the user with `role = STUDENT` regardless of any other fields present in the request body.
5. WHEN a registration request contains a duplicate email, THE System SHALL reject the request with HTTP status 409 and the message `"Email already in use"`.

---

### Requirement 2

**User Story:** As a system administrator, I want GUARD and ADMIN accounts to be created only through a controlled seed script, so that privileged roles cannot be self-assigned through the public API.

#### Acceptance Criteria

1. THE System SHALL provide a Prisma seed script that creates at least 3 GUARD accounts (GATE1, GATE2, GATE3) and 1 ADMIN account with bcrypt-hashed passwords.
2. WHEN the seed script is executed, THE System SHALL hash all passwords using bcrypt with a minimum cost factor of 10 before storing them.
3. THE System SHALL NOT expose any API endpoint that accepts `GUARD` or `ADMIN` as a role value during user creation.
4. WHEN the seed script is executed on a database that already contains a user with the same email, THE System SHALL skip that record using an upsert strategy to avoid duplicate key errors.

---

### Requirement 3

**User Story:** As any user (student, guard, or admin), I want to log in through a single shared login endpoint, so that I can authenticate and receive a role-appropriate JWT.

#### Acceptance Criteria

1. WHEN a login request is received with valid credentials, THE System SHALL return a JWT containing the user's `id` and `role`.
2. WHEN a login request is received with an invalid email or password, THE System SHALL return HTTP status 401 with the message `"Invalid credentials"`.
3. WHEN a login request is missing `email` or `password`, THE System SHALL return HTTP status 400 with a descriptive validation message.
4. WHEN a GUARD user logs in successfully, THE System SHALL include the user's `gate_id` in the JWT payload if a gate assignment exists.

---

### Requirement 4

**User Story:** As a developer, I want the frontend registration form to collect only student-relevant fields, so that users cannot attempt to select or submit a role during registration.

#### Acceptance Criteria

1. THE System SHALL render the registration form with only `name`, `email`, `password`, and `studentId` fields — no role selector.
2. WHEN the registration form is submitted, THE System SHALL send only `name`, `email`, `password`, and `studentId` in the request body — the `role` field SHALL NOT be included.
3. WHEN registration succeeds, THE System SHALL redirect the user to the login page.

---

### Requirement 5

**User Story:** As a system administrator, I want all protected routes to enforce role-based access control, so that users can only access dashboards and actions appropriate to their role.

#### Acceptance Criteria

1. WHILE a user's JWT contains `role = STUDENT`, THE System SHALL permit access only to student-scoped routes and SHALL deny access to guard or admin routes with HTTP status 403.
2. WHILE a user's JWT contains `role = GUARD`, THE System SHALL permit access only to guard-scoped routes and SHALL deny access to student or admin routes with HTTP status 403.
3. WHILE a user's JWT contains `role = ADMIN`, THE System SHALL permit access only to admin-scoped routes and SHALL deny access to student or guard routes with HTTP status 403.
4. WHEN a request to a protected route is received without a valid JWT, THE System SHALL return HTTP status 401 with the message `"No token provided"` or `"Invalid token"`.
5. WHEN a user logs in, THE System SHALL redirect the frontend to the dashboard that corresponds to the user's role (`/student`, `/guard`, or `/admin`).
