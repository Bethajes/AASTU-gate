/**
 * Property-Based Tests — Laptop Update Request
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: laptop-update-request, Property N: <property text>
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import pool from '../lib/db.js'
import { createUpdateRequest, listMyUpdateRequests } from '../controllers/updateRequest.controller.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function createUser(role = 'STUDENT') {
  const id = crypto.randomUUID()
  const suffix = id.slice(0, 8)
  let studentId = null
  if (role === 'STUDENT') {
    studentId = `ETS${suffix}`
    await pool.query(
      `INSERT INTO "Student" (id, username, name, email, department, "isActivated")
       VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (id) DO NOTHING`,
      [studentId, `user_${suffix}`, `Test Student ${suffix}`, `${suffix}@test.local`, 'CS']
    )
  }
  await pool.query(
    `INSERT INTO "User" (id, name, email, password, role, "studentId")
     VALUES ($1, $2, $3, 'hashed', $4::"Role", $5)`,
    [id, `Test ${role} ${suffix}`, `${suffix}@test.local`, role, studentId]
  )
  return { id, studentId }
}

async function createLaptop(ownerId) {
  const id = crypto.randomUUID()
  const serial = `SN-${id.slice(0, 8)}`
  const qrCode = Math.floor(10000000 + Math.random() * 90000000).toString()
  await pool.query(
    `INSERT INTO "Laptop" (id, "serialNumber", brand, model, "qrCode", "ownerId", "verificationStatus", "isInCampus")
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', false)`,
    [id, serial, 'OriginalBrand', 'TestModel', qrCode, ownerId]
  )
  return { id, serial, brand: 'OriginalBrand' }
}

async function getLaptop(laptopId) {
  const r = await pool.query(`SELECT * FROM "Laptop" WHERE id = $1`, [laptopId])
  return r.rows[0]
}

async function getUpdateRequest(requestId) {
  const r = await pool.query(`SELECT * FROM "laptop_update_requests" WHERE id = $1`, [requestId])
  return r.rows[0]
}

/** Build a minimal Express-like req/res pair */
function makeReqRes({ body = {}, user = {}, file = null } = {}) {
  const req = { body, user, file, params: {}, query: {} }
  let statusCode = 200
  let responseBody = null
  const res = {
    status(code) { statusCode = code; return res },
    json(body) { responseBody = body; return res },
    get statusCode() { return statusCode },
    get body() { return responseBody },
  }
  return { req, res }
}

// Track created rows for cleanup
const createdUsers = []
const createdLaptops = []
const createdRequests = []
const createdStudents = []

async function makeUser(role) {
  const u = await createUser(role)
  createdUsers.push(u.id)
  if (u.studentId) createdStudents.push(u.studentId)
  return u
}

async function makeLaptop(ownerId) {
  const l = await createLaptop(ownerId)
  createdLaptops.push(l.id)
  return l
}

afterEach(async () => {
  if (createdRequests.length) {
    await pool.query(`DELETE FROM "laptop_update_requests" WHERE id = ANY($1)`, [createdRequests])
    createdRequests.length = 0
  }
  if (createdLaptops.length) {
    await pool.query(`DELETE FROM "laptop_update_requests" WHERE "laptopId" = ANY($1)`, [createdLaptops])
    await pool.query(`DELETE FROM "Laptop" WHERE id = ANY($1)`, [createdLaptops])
    createdLaptops.length = 0
  }
  if (createdUsers.length) {
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [createdUsers])
    createdUsers.length = 0
  }
  if (createdStudents.length) {
    await pool.query(`DELETE FROM "Student" WHERE id = ANY($1)`, [createdStudents])
    createdStudents.length = 0
  }
})

// ---------------------------------------------------------------------------
// Property 1: Request creation invariants
// Feature: laptop-update-request, Property 1: Request creation invariants
// ---------------------------------------------------------------------------
describe('Property 1: Request creation invariants', () => {
  it(
    'creates a PENDING request linked to the correct student and laptop, sets requestedAt, and leaves the laptop unchanged',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate at least one non-empty change field
          fc.record({
            newBrand: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
            newSerialNumber: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
            reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }).filter(({ newBrand, newSerialNumber }) =>
            // At least one change field must be present (no photo in unit test)
            newBrand !== undefined || newSerialNumber !== undefined
          ),
          async ({ newBrand, newSerialNumber, reason }) => {
            const student = await makeUser('STUDENT')
            const laptop = await makeLaptop(student.id)

            // Snapshot the laptop before the request
            const laptopBefore = await getLaptop(laptop.id)

            const { req, res } = makeReqRes({
              body: {
                laptopId: laptop.id,
                ...(newBrand !== undefined && { newBrand }),
                ...(newSerialNumber !== undefined && { newSerialNumber }),
                ...(reason !== undefined && { reason }),
              },
              user: { id: student.id },
              file: null,
            })

            await createUpdateRequest(req, res)

            // (a) Must return 201
            if (res.statusCode !== 201) {
              throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
            }

            const returned = res.body.request

            // Track for cleanup
            createdRequests.push(returned.id)

            // (b) Status must be PENDING
            if (returned.status !== 'PENDING') {
              throw new Error(`Expected status PENDING, got ${returned.status}`)
            }

            // (c) Must be associated with the correct studentId and laptopId
            if (returned.student_id !== student.id) {
              throw new Error(`Expected student_id=${student.id}, got ${returned.student_id}`)
            }
            if (returned.laptop_id !== laptop.id) {
              throw new Error(`Expected laptop_id=${laptop.id}, got ${returned.laptop_id}`)
            }

            // (d) requestedAt must be a non-null timestamp
            if (!returned.requested_at) {
              throw new Error('requestedAt must be set on the returned request')
            }

            // Verify in DB as well
            const dbRow = await getUpdateRequest(returned.id)
            if (!dbRow) throw new Error('Request row not found in DB')
            if (dbRow.status !== 'PENDING') throw new Error(`DB status should be PENDING, got ${dbRow.status}`)
            if (!dbRow.requestedAt) throw new Error('DB requestedAt must be non-null')
            if (dbRow.studentId !== student.id) throw new Error('DB studentId mismatch')
            if (dbRow.laptopId !== laptop.id) throw new Error('DB laptopId mismatch')

            // (e) reason stored if provided
            if (reason !== undefined && dbRow.reason !== reason) {
              throw new Error(`Expected reason="${reason}", got "${dbRow.reason}"`)
            }

            // (f) Original Laptop row must be completely unchanged
            const laptopAfter = await getLaptop(laptop.id)
            if (laptopAfter.brand !== laptopBefore.brand) {
              throw new Error(`Laptop brand changed: ${laptopBefore.brand} → ${laptopAfter.brand}`)
            }
            if (laptopAfter.serialNumber !== laptopBefore.serialNumber) {
              throw new Error(`Laptop serialNumber changed`)
            }
            if (laptopAfter.verificationStatus !== laptopBefore.verificationStatus) {
              throw new Error(`Laptop verificationStatus changed`)
            }
            if (laptopAfter.photoUrl !== laptopBefore.photoUrl) {
              throw new Error(`Laptop photoUrl changed`)
            }
          }
        ),
        { numRuns: 20 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Property 2: Ownership enforcement
// Feature: laptop-update-request, Property 2: Ownership enforcement
// ---------------------------------------------------------------------------
describe('Property 2: Ownership enforcement', () => {
  it(
    'returns 403 and creates no request row when a student submits for a laptop they do not own',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate at least one non-empty change field
          fc.record({
            newBrand: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
            newSerialNumber: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
          }).filter(({ newBrand, newSerialNumber }) =>
            newBrand !== undefined || newSerialNumber !== undefined
          ),
          async ({ newBrand, newSerialNumber }) => {
            // Two distinct students — attacker does NOT own the laptop
            const owner = await makeUser('STUDENT')
            const attacker = await makeUser('STUDENT')
            const laptop = await makeLaptop(owner.id)

            // Count existing requests for this laptop before the call
            const countBefore = await pool.query(
              `SELECT COUNT(*) FROM "laptop_update_requests" WHERE "laptopId" = $1`,
              [laptop.id]
            )
            const before = parseInt(countBefore.rows[0].count, 10)

            const { req, res } = makeReqRes({
              body: {
                laptopId: laptop.id,
                ...(newBrand !== undefined && { newBrand }),
                ...(newSerialNumber !== undefined && { newSerialNumber }),
              },
              user: { id: attacker.id },
              file: null,
            })

            await createUpdateRequest(req, res)

            // Must return 403
            if (res.statusCode !== 403) {
              throw new Error(`Expected 403, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
            }

            // Must not have created any new request row
            const countAfter = await pool.query(
              `SELECT COUNT(*) FROM "laptop_update_requests" WHERE "laptopId" = $1`,
              [laptop.id]
            )
            const after = parseInt(countAfter.rows[0].count, 10)
            if (after !== before) {
              throw new Error(
                `Expected request count to stay at ${before}, but got ${after} after rejected ownership attempt`
              )
            }
          }
        ),
        { numRuns: 20 }
      )
    }
  )
})
