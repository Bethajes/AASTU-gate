/**
 * Property-Based Tests — AASTU Student Identity Activation
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: aastu-student-identity, Property N: <property text>
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import pool from '../lib/db.js'
import { sendOtp, verifyOtp } from '../controllers/auth.controller.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-property-tests'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReqRes(body = {}) {
  const req = { body }
  let statusCode = 200
  let responseBody = null
  const res = {
    status(code) { statusCode = code; return res },
    json(b) { responseBody = b; return res },
    get statusCode() { return statusCode },
    get body() { return responseBody },
  }
  return { req, res }
}

async function insertStudent({ id, username, name, department, email = null, isActivated = false }) {
  const uname = username || `auto-${crypto.randomUUID().slice(0, 8)}`
  await pool.query(
    `INSERT INTO "Student" ("id", "username", "name", "email", "photo", "department", "isActivated")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, uname, name, email, null, department, isActivated]
  )
}

function uniqueStudentId() {
  return `ETS${Math.floor(100000 + Math.random() * 900000)}/${String(Math.floor(10 + Math.random() * 90))}`
}

/**
 * Generates a valid institutional email matching /^[a-zA-Z]+\.[a-zA-Z]+@aastustudent\.edu\.et$/
 * Uses only letters to satisfy the isInstitutionalEmail regex, with a unique suffix per call.
 */
function uniqueInstitutionalEmail() {
  // Convert a random hex UUID to letters only (a-p mapping for hex digits 0-f)
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  const toLetters = (h) => h.split('').map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
  const first = 'test' + toLetters(hex.slice(0, 4))
  const father = 'user' + toLetters(hex.slice(4, 8))
  return `${first}.${father}@aastustudent.edu.et`
}

const createdStudentIds = []
const createdUserIds = []

afterEach(async () => {
  if (createdUserIds.length) {
    await pool.query(`DELETE FROM "User" WHERE "studentId" = ANY($1)`, [createdStudentIds])
    createdUserIds.length = 0
  }
  if (createdStudentIds.length) {
    await pool.query(`DELETE FROM "Student" WHERE "id" = ANY($1)`, [createdStudentIds])
    createdStudentIds.length = 0
  }
})

// ---------------------------------------------------------------------------
// Property 1: Institutional email domain enforcement
// **Feature: aastu-student-identity, Property 1: Institutional email domain enforcement**
// **Validates: Requirements 3.1, 3.2**
// ---------------------------------------------------------------------------
describe('Property 1: Institutional email domain enforcement', () => {
  it('send-otp returns 400 for any email not ending with @aastustudent.edu.et', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress().filter(e => !e.endsWith('@aastustudent.edu.et')),
        async (badEmail) => {
          const id = uniqueStudentId()
          const username = `p1-${crypto.randomUUID().slice(0, 6)}`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const { req, res } = makeReqRes({ student_id: id, email: badEmail })
          await sendOtp(req, res)

          if (res.statusCode !== 400) {
            throw new Error(`Expected 400 for non-institutional email "${badEmail}", got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 7: Duplicate email rejection
// **Feature: aastu-student-identity, Property 7: Duplicate email rejection**
// **Validates: Requirements 3.3**
// ---------------------------------------------------------------------------
describe('Property 7: Duplicate email rejection', () => {
  it('send-otp returns 409 when the institutional email is already associated with an activated account', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const existingId = uniqueStudentId()
        const existingUsername = `p7e-${crypto.randomUUID().slice(0, 6)}`
        const sharedEmail = uniqueInstitutionalEmail()
        createdStudentIds.push(existingId)

        await insertStudent({
          id: existingId,
          username: existingUsername,
          name: 'Existing Student',
          department: 'CS',
          email: sharedEmail,
          isActivated: true,
        })

        const newId = uniqueStudentId()
        const newUsername = `p7n-${crypto.randomUUID().slice(0, 6)}`
        createdStudentIds.push(newId)
        await insertStudent({ id: newId, username: newUsername, name: 'New Student', department: 'CS', isActivated: false })

        const { req, res } = makeReqRes({ student_id: newId, email: sharedEmail })
        await sendOtp(req, res)

        if (res.statusCode !== 409) {
          throw new Error(`Expected 409 for duplicate email "${sharedEmail}", got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }
      }),
      { numRuns: 50 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 6: Activation is idempotent — already-activated students are rejected
// **Feature: aastu-student-identity, Property 6: Activation is idempotent — already-activated students are rejected**
// **Validates: Requirements 1.4, 6.3**
// ---------------------------------------------------------------------------
describe('Property 6: Activation is idempotent — already-activated students are rejected on send-otp', () => {
  it('send-otp returns 409 for any student with isActivated=true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const username = `p6-${crypto.randomUUID().slice(0, 6)}`
        const email = uniqueInstitutionalEmail()
        createdStudentIds.push(id)

        await insertStudent({
          id,
          username,
          name: 'Activated Student',
          department: 'CS',
          email,
          isActivated: true,
        })

        const { req, res } = makeReqRes({ student_id: id, email: uniqueInstitutionalEmail() })
        await sendOtp(req, res)

        if (res.statusCode !== 409) {
          throw new Error(`Expected 409 for already-activated student, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }
      }),
      { numRuns: 100 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 2: OTP expiry enforcement
// **Feature: aastu-student-identity, Property 2: OTP expiry enforcement**
// **Validates: Requirements 4.4**
// ---------------------------------------------------------------------------
describe('Property 2: OTP expiry enforcement', () => {
  it('verify-otp returns 400 for any student whose stored OTP expiry is in the past', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const username = `p2-${crypto.randomUUID().slice(0, 6)}`
        createdStudentIds.push(id)

        await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

        const code = String(Math.floor(100000 + Math.random() * 900000))
        const expiredExpiry = new Date(Date.now() - 60 * 1000) // 1 minute in the past

        await pool.query(
          `UPDATE "Student" SET "otpCode" = $1, "otpExpiry" = $2, "pendingEmail" = $3 WHERE "id" = $4`,
          [code, expiredExpiry, uniqueInstitutionalEmail(), id]
        )

        const { req, res } = makeReqRes({ student_id: id, code })
        await verifyOtp(req, res)

        if (res.statusCode !== 400) {
          throw new Error(`Expected 400 for expired OTP, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }
      }),
      { numRuns: 50 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 3: OTP clearance after verification
// **Feature: aastu-student-identity, Property 3: OTP clearance after verification**
// **Validates: Requirements 4.6**
// ---------------------------------------------------------------------------
describe('Property 3: OTP clearance after verification', () => {
  it('verify-otp clears otpCode and otpExpiry on the Student record after successful verification', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const username = `p3-${crypto.randomUUID().slice(0, 6)}`
        const pendingEmail = uniqueInstitutionalEmail()
        createdStudentIds.push(id)

        await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

        const code = String(Math.floor(100000 + Math.random() * 900000))
        const validExpiry = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes in the future

        await pool.query(
          `UPDATE "Student" SET "otpCode" = $1, "otpExpiry" = $2, "pendingEmail" = $3 WHERE "id" = $4`,
          [code, validExpiry, pendingEmail, id]
        )

        const { req, res } = makeReqRes({ student_id: id, code })
        await verifyOtp(req, res)

        if (res.statusCode !== 200) {
          throw new Error(`Expected 200 for valid OTP, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }

        // Verify OTP fields are cleared in the database
        const check = await pool.query(
          `SELECT "otpCode", "otpExpiry" FROM "Student" WHERE "id" = $1`,
          [id]
        )
        const row = check.rows[0]
        if (row.otpCode !== null || row.otpExpiry !== null) {
          throw new Error(`Expected otpCode and otpExpiry to be null after verification, got otpCode=${row.otpCode}, otpExpiry=${row.otpExpiry}`)
        }
      }),
      { numRuns: 50 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Import setPassword for Properties 5 and 8
// ---------------------------------------------------------------------------
import { setPassword } from '../controllers/auth.controller.js'
import { generateOtpToken } from '../lib/authUtils.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// ---------------------------------------------------------------------------
// Property 5: Password creation requires valid OTP token
// **Feature: aastu-student-identity, Property 5: Password creation requires valid OTP token**
// **Validates: Requirements 5.1, 5.4**
// ---------------------------------------------------------------------------
describe('Property 5: Password creation requires valid OTP token', () => {
  it('set-password returns 401 for any invalid, expired, or tampered otpToken', async () => {
    // Pre-generate a token signed with the wrong secret (synchronously)
    const wrongSecretToken = jwt.sign(
      { studentId: 'ETS000/00', email: 'x.y@aastustudent.edu.et', purpose: 'otp-verified' },
      'wrong-secret',
      { expiresIn: '10m' }
    )

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('not-a-jwt'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
          fc.constant(wrongSecretToken),
        ),
        async (badToken) => {
          const id = uniqueStudentId()
          const username = `p5-${crypto.randomUUID().slice(0, 6)}`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const { req, res } = makeReqRes({ student_id: id, otpToken: badToken, password: 'validpassword123' })
          await setPassword(req, res)

          if (res.statusCode !== 401 && res.statusCode !== 400) {
            throw new Error(`Expected 400 or 401 for invalid otpToken, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)

  it('set-password returns 401 when otpToken studentId does not match request student_id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const otherId = uniqueStudentId()
        const username = `p5b-${crypto.randomUUID().slice(0, 6)}`
        const email = uniqueInstitutionalEmail()
        createdStudentIds.push(id)
        await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

        // Token is for a different student
        const token = generateOtpToken(otherId, email)

        const { req, res } = makeReqRes({ student_id: id, otpToken: token, password: 'validpassword123' })
        await setPassword(req, res)

        if (res.statusCode !== 401) {
          throw new Error(`Expected 401 when token studentId mismatches, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }
      }),
      { numRuns: 50 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 8: Password bcrypt round-trip
// **Feature: aastu-student-identity, Property 8: Password bcrypt round-trip**
// **Validates: Requirements 5.3**
// ---------------------------------------------------------------------------
describe('Property 8: Password bcrypt round-trip', () => {
  it('stored password satisfies bcrypt.compare and does not equal plaintext', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 32 }).filter(p => p.trim().length >= 6),
        async (plainPassword) => {
          const id = uniqueStudentId()
          const username = `p8-${crypto.randomUUID().slice(0, 6)}`
          const email = uniqueInstitutionalEmail()
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const token = generateOtpToken(id, email)

          const { req, res } = makeReqRes({ student_id: id, otpToken: token, password: plainPassword })
          await setPassword(req, res)

          if (res.statusCode !== 201) {
            throw new Error(`Expected 201 for valid activation, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          // Fetch the stored password hash from the User record
          const userRow = await pool.query(
            `SELECT "password" FROM "User" WHERE "studentId" = $1`,
            [id]
          )
          const storedHash = userRow.rows[0]?.password

          if (!storedHash) {
            throw new Error('No User record found after setPassword')
          }

          // Must not store plaintext
          if (storedHash === plainPassword) {
            throw new Error('Password stored as plaintext — must be hashed')
          }

          // bcrypt.compare must return true
          const matches = await bcrypt.compare(plainPassword, storedHash)
          if (!matches) {
            throw new Error('bcrypt.compare returned false — stored hash does not match plaintext password')
          }

          // Track created user for cleanup
          createdUserIds.push(id)
        }
      ),
      { numRuns: 20 }
    )
  }, 120000)
})

// ---------------------------------------------------------------------------
// Property 9: OTP resend resets expiry
// **Feature: aastu-student-identity, Property 9: OTP resend resets expiry**
// **Validates: Requirements 4.5**
// ---------------------------------------------------------------------------
describe('Property 9: OTP resend resets expiry', () => {
  it('calling send-otp again replaces otpCode, otpExpiry, and pendingEmail with fresh values', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const username = `p9-${crypto.randomUUID().slice(0, 6)}`
        createdStudentIds.push(id)
        await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

        // Seed an old OTP with a near-expired expiry (30 seconds from now)
        const oldCode = String(Math.floor(100000 + Math.random() * 900000))
        const oldExpiry = new Date(Date.now() + 30 * 1000)
        const firstEmail = uniqueInstitutionalEmail()
        await pool.query(
          `UPDATE "Student" SET "otpCode" = $1, "otpExpiry" = $2, "pendingEmail" = $3 WHERE "id" = $4`,
          [oldCode, oldExpiry, firstEmail, id]
        )

        // Small delay to ensure new expiry will be strictly after old expiry
        await new Promise(r => setTimeout(r, 10))

        // Resend OTP with a different institutional email
        const secondEmail = uniqueInstitutionalEmail()
        const { req, res } = makeReqRes({ student_id: id, email: secondEmail })
        await sendOtp(req, res)

        // Accept 200 (email sent) or 500 (email delivery failed in test env) —
        // both paths execute the DB UPDATE before attempting email delivery.
        if (res.statusCode !== 200 && res.statusCode !== 500) {
          throw new Error(`Expected 200 or 500 on resend, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }

        const row = await pool.query(
          `SELECT "otpCode", "otpExpiry", "pendingEmail" FROM "Student" WHERE "id" = $1`,
          [id]
        )
        const student = row.rows[0]

        // otpCode must have changed
        if (student.otpCode === oldCode) {
          throw new Error(`Expected otpCode to be replaced on resend, but it is still "${oldCode}"`)
        }

        // otpExpiry must be strictly after the old expiry
        if (new Date(student.otpExpiry) <= oldExpiry) {
          throw new Error(
            `Expected new otpExpiry (${student.otpExpiry}) to be after old expiry (${oldExpiry.toISOString()})`
          )
        }

        // pendingEmail must reflect the new email
        if (student.pendingEmail !== secondEmail) {
          throw new Error(
            `Expected pendingEmail to be "${secondEmail}", got "${student.pendingEmail}"`
          )
        }
      }),
      { numRuns: 20 }
    )
  }, 300000)
})
