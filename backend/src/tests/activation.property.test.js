/**
 * Property-Based Tests — Preloaded Student Activation
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: preloaded-student-activation, Property N: <property text>
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../lib/db.js'
import { activateStudent, setPassword, login } from '../controllers/auth.controller.js'
import { generateOtpToken } from '../lib/authUtils.js'

const JWT_SECRET = process.env.JWT_SECRET || 'aastusecretkey123'
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

/** Insert a Student row directly and track it for cleanup. */
async function insertStudent({ id, username, name, email, department, photo = null, isActivated = false }) {
  const uname = username || `auto-${crypto.randomUUID().slice(0, 8)}`
  await pool.query(
    `INSERT INTO "Student" ("id", "username", "name", "email", "photo", "department", "isActivated")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, uname, name, email, photo, department, isActivated]
  )
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

/** Build a unique student ID that won't collide across test runs. */
function uniqueStudentId() {
  return `ETS${Math.floor(100000 + Math.random() * 900000)}/${String(Math.floor(10 + Math.random() * 90))}`
}

function uniqueEmail() {
  return `test-${crypto.randomUUID().slice(0, 8)}@test.local`
}

// ---------------------------------------------------------------------------
// Property 3: Mismatched or unknown username/student_id returns 404 on activate
// Feature: preloaded-student-activation, Property 3: Mismatched or unknown username/student_id returns 404 on activate
// Validates: Requirements 2.2, 3.6
// ---------------------------------------------------------------------------
describe('Property 3: Mismatched or unknown username/student_id returns 404 on activate', () => {
  it('POST /activate with a non-existent student_id returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 40 }).filter(s => s.trim().length > 0),
        async (randomId) => {
          // Ensure this ID doesn't exist in the DB
          await pool.query(`DELETE FROM "Student" WHERE "id" = $1`, [randomId])

          const { req, res } = makeReqRes({ student_id: randomId })
          await activateStudent(req, res)

          if (res.statusCode !== 404) {
            throw new Error(`Expected 404 for unknown student_id, got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('POST /activate with a non-existent student_id returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id1 = uniqueStudentId()
        const id2 = uniqueStudentId()
        createdStudentIds.push(id1, id2)

        await insertStudent({ id: id1, username: `u1-${crypto.randomUUID().slice(0, 6)}`, name: 'Student A', department: 'CS', isActivated: false })

        // Send id2 which doesn't exist
        const { req, res } = makeReqRes({ student_id: id2 })
        await activateStudent(req, res)

        if (res.statusCode !== 404) {
          throw new Error(`Expected 404 for non-existent student_id, got ${res.statusCode}`)
        }
      }),
      { numRuns: 50 }
    )
  })

  it('POST /set-password with a non-existent student_id returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const randomId = uniqueStudentId()
        await pool.query(`DELETE FROM "Student" WHERE "id" = $1`, [randomId])

        // Generate a valid token for this non-existent student
        const token = generateOtpToken(randomId, `test.user@aastustudent.edu.et`)

        const { req, res } = makeReqRes({ student_id: randomId, otpToken: token, password: 'validpass123' })
        await setPassword(req, res)

        if (res.statusCode !== 404) {
          throw new Error(`Expected 404 for unknown student_id "${randomId}", got ${res.statusCode}`)
        }
      }),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4: Already-activated student is rejected on both activation endpoints
// Feature: preloaded-student-activation, Property 4: Already-activated student is rejected on both activation endpoints
// Validates: Requirements 2.3, 3.5, 6.2
// ---------------------------------------------------------------------------
describe('Property 4: Already-activated student is rejected on both activation endpoints', () => {
  it('POST /activate returns 409 when isActivated=true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const username = `act-${crypto.randomUUID().slice(0, 6)}`
        createdStudentIds.push(id)
        await insertStudent({ id, username, name: 'Test Student', email: uniqueEmail(), department: 'CS', isActivated: true })

        const { req, res } = makeReqRes({ student_id: id, username })
        await activateStudent(req, res)

        if (res.statusCode !== 409) {
          throw new Error(`Expected 409 for already-activated student, got ${res.statusCode}`)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('POST /set-password returns 409 when isActivated=true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id = uniqueStudentId()
        const username = `act-sp-${crypto.randomUUID().slice(0, 6)}`
        const email = `test.user${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}@aastustudent.edu.et`
        createdStudentIds.push(id)
        await insertStudent({ id, username, name: 'Test Student', email, department: 'CS', isActivated: true })

        const token = generateOtpToken(id, email)
        const { req, res } = makeReqRes({ student_id: id, otpToken: token, password: 'validpass123' })
        await setPassword(req, res)

        if (res.statusCode !== 409) {
          throw new Error(`Expected 409 for already-activated student on set-password, got ${res.statusCode}`)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5: Activation lookup returns correct fields and no sensitive data
// Feature: preloaded-student-activation, Property 5: Activation lookup returns correct fields and no sensitive data
// Validates: Requirements 2.1, 2.4
// ---------------------------------------------------------------------------
describe('Property 5: Activation lookup returns correct fields and no sensitive data', () => {
  it('POST /activate returns name, photo, department, username and no password or email field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name:       fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          department: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        async ({ name, department }) => {
          const id = uniqueStudentId()
          const username = `u-${crypto.randomUUID().slice(0, 6)}`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name, email: uniqueEmail(), department, isActivated: false })

          const { req, res } = makeReqRes({ student_id: id, username })
          await activateStudent(req, res)

          if (res.statusCode !== 200) {
            throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          const body = res.body
          if (body.name === undefined) throw new Error('Response missing "name"')
          if (body.department === undefined) throw new Error('Response missing "department"')
          if (body.username === undefined) throw new Error('Response missing "username"')
          if (!('photo' in body)) throw new Error('Response missing "photo" key')
          if ('password' in body) throw new Error('Response must NOT contain "password"')
          if ('email' in body) throw new Error('Response must NOT contain "email"')
          if (body.name !== name) throw new Error(`name mismatch: expected "${name}", got "${body.name}"`)
          if (body.username !== username) throw new Error(`username mismatch: expected "${username}", got "${body.username}"`)
          if (body.department !== department) throw new Error('department mismatch')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Missing username or student_id returns 400 on activation endpoints
// Feature: preloaded-student-activation, Property 6: Missing username or student_id returns 400 on activation endpoints
// Validates: Requirements 2.5, 6.3
// ---------------------------------------------------------------------------
describe('Property 6: Missing student_id returns 400 on activation endpoints', () => {
  it('POST /activate returns 400 when student_id is absent or empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(''),
          fc.constant('   '),
        ),
        async (badId) => {
          const body = badId === undefined
            ? {}
            : { student_id: badId }
          const { req, res } = makeReqRes(body)
          await activateStudent(req, res)

          if (res.statusCode !== 400) {
            throw new Error(`Expected 400 for student_id="${badId}", got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('POST /set-password returns 400 when student_id is absent or empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(''),
          fc.constant('   '),
        ),
        async (badId) => {
          const body = badId === undefined
            ? { otpToken: 'sometoken', password: 'validpass' }
            : { student_id: badId, otpToken: 'sometoken', password: 'validpass' }
          const { req, res } = makeReqRes(body)
          await setPassword(req, res)

          if (res.statusCode !== 400) {
            throw new Error(`Expected 400 for student_id="${badId}", got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7: Successful set-password creates a STUDENT User, saves email, and marks student as activated
// Feature: preloaded-student-activation, Property 7: Successful set-password creates a STUDENT User, saves email, and marks student as activated
// Validates: Requirements 3.1, 3.3
// ---------------------------------------------------------------------------
describe('Property 7: Successful set-password creates a STUDENT User, saves email, and marks student as activated', () => {
  it('creates User with role=STUDENT, saves email on Student, and sets isActivated=true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
        async (password) => {
          const id = uniqueStudentId()
          const username = `sp-${crypto.randomUUID().slice(0, 6)}`
          const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
          const email = `test${hex}.user@aastustudent.edu.et`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const token = generateOtpToken(id, email)
          const { req, res } = makeReqRes({ student_id: id, otpToken: token, password })
          await setPassword(req, res)

          if (res.statusCode !== 201) {
            throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          // Verify User was created with STUDENT role
          const userRow = await pool.query(
            `SELECT "id", "role", "studentId", "email" FROM "User" WHERE "studentId" = $1`,
            [id]
          )
          if (userRow.rows.length === 0) throw new Error('No User record created')
          const user = userRow.rows[0]
          createdUserIds.push(user.id)
          if (user.role !== 'STUDENT') throw new Error(`Expected role=STUDENT, got ${user.role}`)
          if (user.studentId !== id) throw new Error('studentId mismatch')
          if (user.email !== email) throw new Error(`User.email mismatch: expected "${email}", got "${user.email}"`)

          // Verify Student.isActivated = true and email saved
          const studentRow = await pool.query(
            `SELECT "isActivated", "email" FROM "Student" WHERE "id" = $1`,
            [id]
          )
          if (!studentRow.rows[0].isActivated) throw new Error('Student.isActivated should be true after set-password')
          if (studentRow.rows[0].email !== email) throw new Error(`Student.email mismatch: expected "${email}", got "${studentRow.rows[0].email}"`)
        }
      ),
      { numRuns: 20 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 8: Password is stored as a bcrypt hash (round-trip)
// Feature: preloaded-student-activation, Property 8: Password is stored as a bcrypt hash (round-trip)
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------
describe('Property 8: Password is stored as a bcrypt hash (round-trip)', () => {
  it('stored password satisfies bcrypt.compare and does not equal plaintext', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
        async (plaintext) => {
          const id = uniqueStudentId()
          const username = `bh-${crypto.randomUUID().slice(0, 6)}`
          const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
          const email = `test${hex}.user@aastustudent.edu.et`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const token = generateOtpToken(id, email)
          const { req, res } = makeReqRes({ student_id: id, otpToken: token, password: plaintext })
          await setPassword(req, res)

          if (res.statusCode !== 201) {
            throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          const userRow = await pool.query(
            `SELECT "id", "password" FROM "User" WHERE "studentId" = $1`,
            [id]
          )
          const stored = userRow.rows[0].password
          createdUserIds.push(userRow.rows[0].id)

          if (stored === plaintext) throw new Error('Password stored as plaintext — must be hashed')
          const matches = await bcrypt.compare(plaintext, stored)
          if (!matches) throw new Error('bcrypt.compare returned false — hash does not match plaintext')
        }
      ),
      { numRuns: 20 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 9: Passwords shorter than 6 characters are rejected
// Feature: preloaded-student-activation, Property 9: Passwords shorter than 6 characters are rejected
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------
describe('Property 9: Passwords shorter than 6 characters are rejected', () => {
  it('POST /set-password returns 400 for any password with length < 6', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 5 }),
        async (shortPassword) => {
          const id = uniqueStudentId()
          const username = `sp9-${crypto.randomUUID().slice(0, 6)}`
          const email = `test.user${crypto.randomUUID().slice(0, 4)}@aastustudent.edu.et`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const token = generateOtpToken(id, email)
          const { req, res } = makeReqRes({ student_id: id, otpToken: token, password: shortPassword })
          await setPassword(req, res)

          if (res.statusCode !== 400) {
            throw new Error(`Expected 400 for password of length ${shortPassword.length}, got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)
})

// ---------------------------------------------------------------------------
// Property 12: Username login round-trip
// Feature: preloaded-student-activation, Property 12: Username login round-trip
// Validates: Requirements 4.1, 4.4
// ---------------------------------------------------------------------------
describe('Property 12: Username login round-trip', () => {
  it('activated student can log in via username and receives a JWT with correct id and role=STUDENT', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
        async (plaintext) => {
          const id = uniqueStudentId()
          const username = `lr-${crypto.randomUUID().slice(0, 6)}`
          const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
          const email = `test${hex}.user@aastustudent.edu.et`
          createdStudentIds.push(id)

          // Activate the student via setPassword
          await insertStudent({ id, username, name: 'Login Test', department: 'CS', isActivated: false })
          const token = generateOtpToken(id, email)
          const { req: spReq, res: spRes } = makeReqRes({ student_id: id, otpToken: token, password: plaintext })
          await setPassword(spReq, spRes)
          if (spRes.statusCode !== 201) {
            throw new Error(`setPassword failed: ${JSON.stringify(spRes.body)}`)
          }

          // Track created user for cleanup
          const userRow = await pool.query(`SELECT "id" FROM "User" WHERE "studentId" = $1`, [id])
          if (userRow.rows[0]) createdUserIds.push(userRow.rows[0].id)

          // Now log in with username + password
          const { req, res } = makeReqRes({ username, password: plaintext })
          await login(req, res)

          if (res.statusCode !== 200) {
            throw new Error(`Expected 200 on login, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          const { token: jwtToken, user } = res.body
          if (!jwtToken) throw new Error('No token in login response')
          if (user.role !== 'STUDENT') throw new Error(`Expected role=STUDENT, got ${user.role}`)

          // Decode JWT and verify payload
          const payload = jwt.verify(jwtToken, JWT_SECRET)
          if (payload.role !== 'STUDENT') throw new Error(`JWT role mismatch: ${payload.role}`)
          if (payload.id !== user.id) throw new Error(`JWT id mismatch`)
        }
      ),
      { numRuns: 20 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 13: Wrong password at login returns 401
// Feature: preloaded-student-activation, Property 13: Wrong password at login returns 401
// Validates: Requirements 4.3
// ---------------------------------------------------------------------------
describe('Property 13: Wrong password at login returns 401', () => {
  it('submitting an incorrect password for an activated student returns 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
          fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
        ).filter(([correct, wrong]) => correct !== wrong),
        async ([correctPassword, wrongPassword]) => {
          const id = uniqueStudentId()
          const username = `wp-${crypto.randomUUID().slice(0, 6)}`
          const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
          const email = `test${hex}.user@aastustudent.edu.et`
          createdStudentIds.push(id)

          await insertStudent({ id, username, name: 'Wrong Pass Test', department: 'CS', isActivated: false })
          const token = generateOtpToken(id, email)
          const { req: spReq, res: spRes } = makeReqRes({ student_id: id, otpToken: token, password: correctPassword })
          await setPassword(spReq, spRes)
          if (spRes.statusCode !== 201) {
            throw new Error(`setPassword failed: ${JSON.stringify(spRes.body)}`)
          }

          const userRow = await pool.query(`SELECT "id" FROM "User" WHERE "studentId" = $1`, [id])
          if (userRow.rows[0]) createdUserIds.push(userRow.rows[0].id)

          // Login with wrong password via username path
          const { req, res } = makeReqRes({ username, password: wrongPassword })
          await login(req, res)

          if (res.statusCode !== 401) {
            throw new Error(`Expected 401 for wrong password, got ${res.statusCode}`)
          }
          if (!res.body?.message?.toLowerCase().includes('invalid')) {
            throw new Error(`Expected generic "Invalid credentials" message, got: ${res.body?.message}`)
          }
        }
      ),
      { numRuns: 20 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 10: Duplicate email is rejected on set-password
// Feature: preloaded-student-activation, Property 10: Duplicate email is rejected on set-password
// Validates: Requirements 3.7
// ---------------------------------------------------------------------------
describe('Property 10: Duplicate email is rejected on set-password', () => {
  it('second set-password with the same email returns 409', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const id1 = uniqueStudentId()
        const id2 = uniqueStudentId()
        const username1 = `de1-${crypto.randomUUID().slice(0, 6)}`
        const username2 = `de2-${crypto.randomUUID().slice(0, 6)}`
        const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
        const sharedEmail = `test${hex}.user@aastustudent.edu.et`
        createdStudentIds.push(id1, id2)

        await insertStudent({ id: id1, username: username1, name: 'Student One', department: 'CS', isActivated: false })
        await insertStudent({ id: id2, username: username2, name: 'Student Two', department: 'CS', isActivated: false })

        // First activation — should succeed
        const token1 = generateOtpToken(id1, sharedEmail)
        const { req: r1, res: s1 } = makeReqRes({ student_id: id1, otpToken: token1, password: 'validpass1' })
        await setPassword(r1, s1)
        if (s1.statusCode !== 201) {
          throw new Error(`First setPassword failed: ${JSON.stringify(s1.body)}`)
        }
        const u1 = await pool.query(`SELECT "id" FROM "User" WHERE "studentId" = $1`, [id1])
        if (u1.rows[0]) createdUserIds.push(u1.rows[0].id)

        // Second activation with same email — should return 409
        const token2 = generateOtpToken(id2, sharedEmail)
        const { req: r2, res: s2 } = makeReqRes({ student_id: id2, otpToken: token2, password: 'validpass2' })
        await setPassword(r2, s2)

        if (s2.statusCode !== 409) {
          throw new Error(`Expected 409 for duplicate email, got ${s2.statusCode}: ${JSON.stringify(s2.body)}`)
        }
      }),
      { numRuns: 50 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 11: Missing email returns 400 on set-password
// Feature: preloaded-student-activation, Property 11: Missing email returns 400 on set-password
// Validates: Requirements 3.8
// ---------------------------------------------------------------------------
describe('Property 11: Missing otpToken returns 400 on set-password', () => {
  it('POST /set-password returns 400 when otpToken is absent or empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(''),
          fc.constant('   '),
        ),
        async (badToken) => {
          const id = uniqueStudentId()
          const username = `me-${crypto.randomUUID().slice(0, 6)}`
          createdStudentIds.push(id)
          await insertStudent({ id, username, name: 'Test Student', department: 'CS', isActivated: false })

          const body = badToken === undefined
            ? { student_id: id, password: 'validpass' }
            : { student_id: id, otpToken: badToken, password: 'validpass' }
          const { req, res } = makeReqRes(body)
          await setPassword(req, res)

          if (res.statusCode !== 400) {
            throw new Error(`Expected 400 for otpToken="${badToken}", got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)
})

// ---------------------------------------------------------------------------
// Property 14: Unactivated student cannot log in
// Feature: preloaded-student-activation, Property 14: Unactivated student cannot log in via username path
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------
describe('Property 14: Unactivated student cannot log in via username path', () => {
  it('student with isActivated=false is rejected at login with 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
        async (password) => {
          const id = uniqueStudentId()
          const username = `unact-${crypto.randomUUID().slice(0, 6)}`
          const email = uniqueEmail()
          createdStudentIds.push(id)

          // Insert student but do NOT activate (isActivated stays false)
          await insertStudent({ id, username, name: 'Unactivated', email, department: 'CS', isActivated: false })

          // Attempt login via username path without ever calling setPassword
          const { req, res } = makeReqRes({ username, password })
          await login(req, res)

          if (res.statusCode !== 401) {
            throw new Error(`Expected 401 for unactivated student, got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)
})

// ---------------------------------------------------------------------------
// Property 1: New student records default to not activated with null email
// Feature: preloaded-student-activation, Property 1: New student records default to not activated with null email
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------
import { createStudent } from '../controllers/student.controller.js'

describe('Property 1: New student records default to not activated with null email', () => {
  it('every student created via createStudent has isActivated=false and null email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name:       fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          department: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        async ({ name, department }) => {
          const id = uniqueStudentId()
          createdStudentIds.push(id)

          // No email provided — should default to null
          const { req, res } = makeReqRes({ id, name, department })
          await createStudent(req, res)

          if (res.statusCode !== 201) {
            throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          // Verify directly in DB
          const row = await pool.query(
            `SELECT "isActivated", "email" FROM "Student" WHERE "id" = $1`,
            [id]
          )
          if (row.rows.length === 0) throw new Error('Student record not found after creation')
          if (row.rows[0].isActivated !== false) {
            throw new Error(`Expected isActivated=false, got ${row.rows[0].isActivated}`)
          }
          if (row.rows[0].email !== null) {
            throw new Error(`Expected email=null, got ${row.rows[0].email}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Duplicate student ID or username is rejected on creation
// Feature: preloaded-student-activation, Property 2: Duplicate student ID or username is rejected on creation
// Validates: Requirements 1.3, 1.4
// ---------------------------------------------------------------------------
describe('Property 2: Duplicate student ID or username is rejected on creation', () => {
  it('second createStudent with same student ID returns 409', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name:       fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          department: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        async ({ name, department }) => {
          const id = uniqueStudentId()
          createdStudentIds.push(id)

          // First creation — should succeed
          const { req: req1, res: res1 } = makeReqRes({ id, name, department })
          await createStudent(req1, res1)
          if (res1.statusCode !== 201) {
            throw new Error(`First createStudent failed: ${JSON.stringify(res1.body)}`)
          }

          // Second creation with same ID but different username — should return 409
          const { req: req2, res: res2 } = makeReqRes({ id, name, department })
          await createStudent(req2, res2)
          if (res2.statusCode !== 409) {
            throw new Error(`Expected 409 for duplicate student ID, got ${res2.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)

  it('createStudent derives username from student ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name:       fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          department: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        async ({ name, department }) => {
          const id1 = uniqueStudentId()
          createdStudentIds.push(id1)

          // First creation — should succeed
          const { req: req1, res: res1 } = makeReqRes({ id: id1, name, department })
          await createStudent(req1, res1)
          if (res1.statusCode !== 201) {
            throw new Error(`First createStudent failed: ${JSON.stringify(res1.body)}`)
          }

          const expectedUsername = id1.replace(/\//g, '')
          if (res1.body.student.username !== expectedUsername) {
            throw new Error(`Expected username ${expectedUsername}, got ${res1.body.student.username}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 15: Password reset round-trip
// Feature: preloaded-student-activation, Property 15: Password reset round-trip
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------
import { forgotPassword, resetPassword } from '../controllers/auth.controller.js'

describe('Property 15: Password reset round-trip', () => {
  it('after requesting a reset and submitting the correct code, the student can log in with the new password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
          fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6),
        ).filter(([original, newPass]) => original !== newPass),
        async ([originalPassword, newPassword]) => {
          const id = uniqueStudentId()
          const username = `pr-${crypto.randomUUID().slice(0, 6)}`
          const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
          const email = `test${hex}.user@aastustudent.edu.et`
          createdStudentIds.push(id)

          // 1. Create and activate the student
          await insertStudent({ id, username, name: 'Reset Test', department: 'CS', isActivated: false })
          const token = generateOtpToken(id, email)
          const { req: spReq, res: spRes } = makeReqRes({ student_id: id, otpToken: token, password: originalPassword })
          await setPassword(spReq, spRes)
          if (spRes.statusCode !== 201) {
            throw new Error(`setPassword failed: ${JSON.stringify(spRes.body)}`)
          }
          const userRow = await pool.query(`SELECT "id" FROM "User" WHERE "studentId" = $1`, [id])
          if (userRow.rows[0]) createdUserIds.push(userRow.rows[0].id)

          // 2. Bypass email send by writing the code directly to the DB
          const code = String(Math.floor(100000 + Math.random() * 900000))
          const expiry = new Date(Date.now() + 15 * 60 * 1000)
          await pool.query(
            `UPDATE "User" SET "verificationCode" = $1, "verificationCodeExpiry" = $2 WHERE "studentId" = $3`,
            [code, expiry, id]
          )

          // 3. Submit reset-password with the correct code and new password
          const { req: rpReq, res: rpRes } = makeReqRes({ email, code, newPassword })
          await resetPassword(rpReq, rpRes)
          if (rpRes.statusCode !== 200) {
            throw new Error(`resetPassword failed: ${JSON.stringify(rpRes.body)}`)
          }

          // 4. Log in with the new password — should succeed
          const { req: loginReq, res: loginRes } = makeReqRes({ username, password: newPassword })
          await login(loginReq, loginRes)
          if (loginRes.statusCode !== 200) {
            throw new Error(`Login with new password failed: ${JSON.stringify(loginRes.body)}`)
          }

          // 5. Log in with the old password — should fail
          const { req: oldLoginReq, res: oldLoginRes } = makeReqRes({ username, password: originalPassword })
          await login(oldLoginReq, oldLoginRes)
          if (oldLoginRes.statusCode !== 401) {
            throw new Error(`Expected 401 with old password after reset, got ${oldLoginRes.statusCode}`)
          }
        }
      ),
      { numRuns: 20 }
    )
  }, 60000)
})
