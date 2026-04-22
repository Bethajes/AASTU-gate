# Design Document: Institutional Email Verification

## Overview

This document describes the technical design for upgrading the existing authentication system of the Laptop Gate Management System to enforce institutional email restrictions and OTP-based email verification. The upgrade extends the current Express.js backend and React frontend without rebuilding the existing auth system.

The key additions are:
- Email domain/format validation on registration
- OTP generation and delivery via Nodemailer
- A `POST /api/auth/verify-email` endpoint
- A `POST /api/auth/resend-code` endpoint
- Login guard for unverified users
- A React `/verify-email` page

---

## Architecture

The feature follows the existing layered architecture:

```
Frontend (React)
  └── /verify-email page  ──► POST /api/auth/verify-email
  └── Register.jsx (updated) ──► POST /api/auth/register (updated)

Backend (Express.js)
  └── auth.routes.js (updated)
  └── auth.controller.js (updated)
  └── email.service.js (new)

Database (PostgreSQL via Prisma)
  └── User model (updated with isVerified, verificationCode, verificationCodeExpiry)
```

No new architectural layers are introduced. The email service is a thin utility module used only by the auth controller.

---

## Components and Interfaces

### Backend

#### `email.service.js` (new)
Responsible for sending emails via Nodemailer.

```js
// Exports:
sendVerificationEmail(to: string, code: string): Promise<void>
```

- Reads `EMAIL_USER` and `EMAIL_PASS` from environment variables
- Uses Gmail SMTP (or any SMTP provider) via Nodemailer
- Subject: "Verify your AASTU account"
- Body: "Your verification code is: {code}"

#### `auth.controller.js` (updated)

New/updated exports:
```js
register(req, res)       // updated: adds domain validation, OTP generation, email send
login(req, res)          // updated: blocks unverified users
verifyEmail(req, res)    // new: POST /api/auth/verify-email
resendCode(req, res)     // new: POST /api/auth/resend-code
```

#### `auth.routes.js` (updated)

```js
POST /api/auth/register        // existing, updated
POST /api/auth/login           // existing, updated
POST /api/auth/verify-email    // new
POST /api/auth/resend-code     // new
```

### Frontend

#### `VerifyEmail.jsx` (new page)
- Route: `/verify-email`
- Receives `email` via React Router location state (passed from Register on success)
- Renders a 6-digit code input, submit button, and resend button
- On success: shows success message and navigates to `/login`

#### `Register.jsx` (updated)
- On successful registration: `navigate('/verify-email', { state: { email } })` instead of navigating to `/login`

#### `App.jsx` (updated)
- Adds `<Route path="/verify-email" element={<VerifyEmail />} />`

---

## Data Models

### Prisma Schema Update

Three fields are added to the `User` model:

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  studentId String?  @unique
  email     String   @unique
  password  String
  role      Role     @default(STUDENT)
  createdAt DateTime @default(now())

  // New fields
  isVerified             Boolean   @default(false)
  verificationCode       String?
  verificationCodeExpiry DateTime?

  laptops          Laptop[]
  scanLogs         GateLog[]
  verifiedLaptops  Laptop[]  @relation("LaptopVerifier")
}
```

A Prisma migration will be generated to apply these changes.

### OTP Generation Logic

```js
const code = Math.floor(100000 + Math.random() * 900000).toString() // 6-digit string
const expiry = new Date(Date.now() + 10 * 60 * 1000)               // 10 minutes from now
```

### Email Validation Regex

The institutional email must match:
```
/^[a-zA-Z]+\.[a-zA-Z]+@aastustudent\.edu\.et$/
```

- Local part: `firstname.fathername` — two alphabetic segments separated by a single dot
- Domain: `aastustudent.edu.et` (exact match)

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Institutional email validation rejects non-conforming addresses

*For any* string that does not match the pattern `firstname.fathername@aastustudent.edu.et`, the email validation function SHALL return false.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: OTP is always a 6-digit numeric string

*For any* call to the OTP generation function, the result SHALL be a string of exactly 6 characters where every character is a digit (0–9).

**Validates: Requirements 2.1**

---

### Property 3: OTP expiry is always in the future at time of generation

*For any* call to the OTP generation function, the returned expiry timestamp SHALL be strictly greater than the current time at the moment of generation.

**Validates: Requirements 2.2**

---

### Property 4: Verification code round-trip

*For any* valid user registration, the verification code stored in the database SHALL equal the code that was generated and sent to the user's email, and retrieving it before expiry SHALL return the same value.

**Validates: Requirements 2.3, 3.2**

---

### Property 5: Expired codes are rejected

*For any* verification attempt where the current time is after `verificationCodeExpiry`, the System SHALL reject the attempt regardless of whether the code value matches.

**Validates: Requirements 3.3, 3.6**

---

### Property 6: Verified users have cleared OTP fields

*For any* user who has successfully verified their email, the `verificationCode` and `verificationCodeExpiry` fields SHALL be null.

**Validates: Requirements 3.4, 3.5**

---

### Property 7: Unverified users cannot obtain a JWT

*For any* user where `isVerified` is false, a login attempt with correct credentials SHALL not return a JWT token.

**Validates: Requirements 4.1, 4.2**

---

## Error Handling

| Scenario | HTTP Status | Message |
|---|---|---|
| Email does not match institutional pattern | 400 | "Only AASTU institutional emails are allowed" |
| Missing required fields on register | 400 | "Name, email, and password are required" |
| Email already registered | 409 | "Email already in use" |
| Nodemailer send failure | 500 | "Failed to send verification email" |
| User not found on verify | 404 | "User not found" |
| Code mismatch | 400 | "Invalid verification code" |
| Code expired | 400 | "Verification code has expired" |
| Login with unverified account | 403 | "Please verify your email first" |
| Invalid credentials on login | 401 | "Invalid credentials" |
| User not found on resend | 404 | "User not found" |

---

## Testing Strategy

### Property-Based Testing (fast-check)

The backend already has `fast-check` and `vitest` installed as dev dependencies. All property-based tests will use these libraries.

Each property-based test runs a minimum of 100 iterations.

Each test is tagged with the format:
`// Feature: institutional-email-verification, Property {N}: {property_text}`

Properties to implement as PBTs:

- **Property 1** — Generate arbitrary strings; assert `isInstitutionalEmail(s)` returns false for all non-matching inputs, and true for all valid `firstname.fathername@aastustudent.edu.et` inputs.
- **Property 2** — Call `generateOTP()` many times; assert result is always a 6-character all-digit string.
- **Property 3** — Call `generateOTPExpiry()` many times; assert result is always `> Date.now()`.
- **Property 5** — Generate expired timestamps; assert `isCodeExpired(expiry)` returns true for all past timestamps.
- **Property 6** — Simulate a successful verification; assert `verificationCode` and `verificationCodeExpiry` are null afterward.
- **Property 7** — Simulate login for users with `isVerified = false`; assert no JWT is returned.

### Unit Tests (vitest)

- `isInstitutionalEmail`: specific valid and invalid examples
- `generateOTP`: check format and range
- `verifyEmail` controller: correct code, wrong code, expired code
- `login` controller: unverified user rejection, verified user success
- `resendCode` controller: unknown email, known unverified user
