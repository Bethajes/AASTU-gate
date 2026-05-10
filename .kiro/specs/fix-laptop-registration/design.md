# Design Document: Fix Laptop Registration and Data Fetching

## Overview

This design addresses critical bugs in the laptop registration and data fetching functionality. The root cause is that the raw SQL INSERT statement in `registerLaptop` is missing the `verificationStatus` field, which causes database constraint violations. Additionally, error handling needs improvement to provide better diagnostics.

## Architecture

The fix involves:
1. Updating the `registerLaptop` controller to include all required database fields
2. Improving error logging to capture full error details
3. Ensuring proper error responses are returned to the frontend
4. Validating that the database schema matches the application expectations

The system uses:
- Express.js for the REST API
- PostgreSQL with raw SQL queries via node-postgres (pg)
- Multer for file upload handling
- JWT for authentication

## Components and Interfaces

### Laptop Controller (`backend/src/controllers/laptop.controller.js`)

**registerLaptop function:**
- Input: `req.body` containing `{ serialNumber, brand, model }`, `req.file` for photo, `req.user.id` from JWT
- Output: JSON response with laptop data, QR image, and QR code number
- Database: INSERT into Laptop table with all required fields

**getAllLaptops function:**
- Input: `req.user` (must be ADMIN or GUARD role)
- Output: JSON array of all laptops with owner and verifier information
- Database: SELECT with JOINs on User table

### Database Schema

The Laptop table has these fields:
- `id` (UUID, primary key)
- `serialNumber` (String, unique)
- `brand` (String)
- `model` (String)
- `qrCode` (String, unique, nullable)
- `isInCampus` (Boolean, default false)
- `registeredAt` (DateTime, default now)
- `photoUrl` (String, nullable)
- `ownerId` (UUID, foreign key to User)
- `verificationStatus` (Enum: PENDING/VERIFIED/BLOCKED, default PENDING) **← Currently missing from INSERT**
- `verifiedAt` (DateTime, nullable)
- `verifiedById` (UUID, nullable, foreign key to User)

## Data Models

### Laptop Registration Request
```typescript
{
  serialNumber: string  // required
  brand: string         // required
  model: string         // required
  photo: File          // optional multipart file
}
```

### Laptop Response
```typescript
{
  id: string
  serial_number: string
  brand: string
  model: string
  qr_code: string
  is_in_campus: boolean
  registered_at: string (ISO date)
  owner_id: string
  owner_name: string
  student_id: string
  photo_url: string | null
  verification_status: 'PENDING' | 'VERIFIED' | 'BLOCKED'
  verified_at: string | null
  verified_by_name: string | null
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Successful registration creates complete record
*For any* valid laptop registration request with all required fields, the database INSERT should succeed and return a laptop record with verificationStatus set to PENDING
**Validates: Requirements 1.1**

Property 2: Duplicate serial numbers are rejected
*For any* laptop registration attempt where the serial number already exists in the database, the System should return a 400 error with message "Serial number already registered"
**Validates: Requirements 1.3**

Property 3: Missing required fields are rejected
*For any* registration request missing serialNumber, brand, or model, the System should return a 400 error before attempting database insertion
**Validates: Requirements 1.4**

Property 4: Admin fetch returns all laptops
*For any* admin user requesting all laptops, the System should return an array containing all laptop records with complete owner information
**Validates: Requirements 2.1, 2.2**

Property 5: Empty laptop list returns empty array
*For any* database state where no laptops exist, the getAllLaptops endpoint should return an empty array with 200 status
**Validates: Requirements 2.3**

## Error Handling

### Database Errors
- Unique constraint violations (code 23505): Return 400 with user-friendly message
- Connection errors: Log full error, return 500 with generic message
- Query errors: Log full error including SQL and parameters, return 500

### Validation Errors
- Missing required fields: Return 400 with specific field names
- Invalid file types: Return 400 with allowed types message
- File size exceeded: Return 400 with size limit message

### Authentication Errors
- Missing token: Return 401 with "No token provided"
- Invalid token: Return 401 with "Invalid token"
- Insufficient permissions: Return 403 with role-specific message

### Error Logging
All errors should be logged with:
- Error message
- Stack trace
- Request context (user ID, endpoint, method)
- Database query (if applicable)

## Testing Strategy

### Unit Testing
We will write unit tests for:
- Input validation logic
- Error message formatting
- QR code generation

### Property-Based Testing
We will use **fast-check** (JavaScript property-based testing library) for:
- Testing that valid inputs always result in successful database inserts
- Testing that duplicate serial numbers are always rejected
- Testing that missing fields are always caught before database operations

Each property-based test will run a minimum of 100 iterations to ensure coverage across the input space.

### Integration Testing
- Test full registration flow with real database
- Test admin fetch with various database states
- Test error scenarios (duplicate serial, missing fields, invalid auth)

### Manual Testing
- Test file upload with various image formats
- Test with actual frontend to ensure end-to-end functionality
- Verify error messages are user-friendly in the UI
