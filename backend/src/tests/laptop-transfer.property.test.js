/**
 * Property-Based Tests — Laptop Transfer
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: laptop-transfer, Property N: <property text>
 *   Validates: Requirements X.Y
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import pool from '../lib/db.js'
import { transferLaptop, getLaptopTransferLogs } from '../controllers/laptop.controller.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createStudent(activated = true) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const studentId = `ETS${suffix}`
  await pool.query(
    `INSERT INTO "Student" (id, username, name, email, department, "isActivated")
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [studentId, `user_${suffix}`, `Test Student ${suffix}`, `${suffix}@test.local`, 'CS', activated]
  )
  const userId = crypto.randomUUID()
  await pool.query(
    `INSERT INTO "User" (id, name, email, password, role, "studentId")
     VALUES ($1, $2, $3, 'hashed', 'STUDENT'::"Role", $4)`,
    [userId, `Test Student ${suffix}`, `${suffix}@test.local`, studentId]
  )
  return { userId, studentId }
}

async function createAdmin() {
  const id = crypto.randomUUID()
  const suffix = id.slice(0, 8)
  await pool.query(
    `INSERT INTO "User" (id, name, email, password, role)
     VALUES ($1, $2, $3, 'hashed', 'ADMIN'::"Role")`,
    [id, `Admin ${suffix}`, `admin_${suffix}@test.local`]
  )
  return { userId: id }
}

async function createLaptop(ownerId, verificationStatus = 'VERIFIED') {
  const id = crypto.randomUUID()
  const serial = `SN-${id.slice(0, 8)}`
  const qrCode = Math.floor(10000000 + Math.random() * 90000000).toString()
  await pool.query(
    `INSERT INTO "Laptop" (id, "serialNumber", brand, model, "qrCode", "ownerId", "verificationStatus", "isInCampus")
     VALUES ($1, $2, $3, $4, $5, $6, $7::"VerificationStatus", false)`,
    [id, serial, 'TestBrand', 'TestModel', qrCode, ownerId, verificationStatus]
  )
  return { id }
}

function makeReqRes({ body = {}, user = {}, params = {} } = {}) {
  const req = { body, user, params, query: {}, file: null }
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

// Cleanup tracking
const createdUsers = []
const createdStudents = []
const createdLaptops = []

async function makeStudent(activated = true) {
  const s = await createStudent(activated)
  createdUsers.push(s.userId)
  createdStudents.push(s.studentId)
  return s
}

async function makeAdmin() {
  const a = await createAdmin()
  createdUsers.push(a.userId)
  return a
}

async function makeLaptop(ownerId, verificationStatus = 'VERIFIED') {
  const l = await createLaptop(ownerId, verificationStatus)
  createdLaptops.push(l.id)
  return l
}

afterEach(async () => {
  if (createdLaptops.length) {
    await pool.query(`DELETE FROM "laptop_transfer_logs" WHERE "laptopId" = ANY($1)`, [createdLaptops])
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
// Property 1: Transfer changes ownership AND resets verification
// Feature: laptop-transfer, Property 1: Transfer changes ownership AND resets verification
// Validates: Requirements 1.1, 1.2
// ---------------------------------------------------------------------------
describe('Property 1: Transfer changes ownership AND resets verification', () => {
  it(
    'for any laptop and two distinct activated students, after transfer the ownerId equals the target and verificationStatus is PENDING',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PENDING', 'VERIFIED', 'BLOCKED'),
          async (initialStatus) => {
            const fromStudent = await makeStudent(true)
            const toStudent = await makeStudent(true)
            const admin = await makeAdmin()
            const laptop = await makeLaptop(fromStudent.userId, initialStatus)

            const { req, res } = makeReqRes({
              params: { id: laptop.id },
              body: { targetStudentId: toStudent.studentId },
              user: { id: admin.userId },
            })

            await transferLaptop(req, res)

            if (res.statusCode !== 200) {
              throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
            }

            // Check returned payload
            const returned = res.body.laptop
            if (returned.owner_id !== toStudent.userId) {
              throw new Error(`Expected owner_id=${toStudent.userId}, got ${returned.owner_id}`)
            }
            if (returned.verification_status !== 'PENDING') {
              throw new Error(`Expected verification_status=PENDING, got ${returned.verification_status}`)
            }
            if (returned.verified_at !== null) {
              throw new Error(`Expected verified_at=null, got ${returned.verified_at}`)
            }
            if (returned.verified_by_id !== null) {
              throw new Error(`Expected verified_by_id=null, got ${returned.verified_by_id}`)
            }

            // Confirm in DB
            const dbRow = await pool.query(`SELECT * FROM "Laptop" WHERE id = $1`, [laptop.id])
            const row = dbRow.rows[0]
            if (row.ownerId !== toStudent.userId) {
              throw new Error(`DB ownerId mismatch: expected ${toStudent.userId}, got ${row.ownerId}`)
            }
            if (row.verificationStatus !== 'PENDING') {
              throw new Error(`DB verificationStatus should be PENDING, got ${row.verificationStatus}`)
            }
            if (row.verifiedAt !== null) {
              throw new Error(`DB verifiedAt should be null`)
            }
            if (row.verifiedById !== null) {
              throw new Error(`DB verifiedById should be null`)
            }
          }
        ),
        { numRuns: 20 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Property 2: Transfer creates a correct audit log entry
// Feature: laptop-transfer, Property 2: Transfer creates a correct audit log entry
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------
describe('Property 2: Transfer creates a correct audit log entry', () => {
  it(
    'for any successful transfer, exactly one new log entry is created with correct laptopId, fromUserId, toUserId, and transferredById',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const fromStudent = await makeStudent(true)
            const toStudent = await makeStudent(true)
            const admin = await makeAdmin()
            const laptop = await makeLaptop(fromStudent.userId)

            // Count logs before
            const before = await pool.query(
              `SELECT COUNT(*) FROM "laptop_transfer_logs" WHERE "laptopId" = $1`,
              [laptop.id]
            )
            const countBefore = parseInt(before.rows[0].count, 10)

            const { req, res } = makeReqRes({
              params: { id: laptop.id },
              body: { targetStudentId: toStudent.studentId },
              user: { id: admin.userId },
            })

            await transferLaptop(req, res)

            if (res.statusCode !== 200) {
              throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
            }

            // Count logs after — must be exactly one more
            const after = await pool.query(
              `SELECT * FROM "laptop_transfer_logs" WHERE "laptopId" = $1 ORDER BY "transferredAt" DESC`,
              [laptop.id]
            )
            const countAfter = after.rows.length
            if (countAfter !== countBefore + 1) {
              throw new Error(`Expected ${countBefore + 1} log entries, got ${countAfter}`)
            }

            // Verify the newest entry has correct fields
            const log = after.rows[0]
            if (log.laptopId !== laptop.id) {
              throw new Error(`Log laptopId mismatch: expected ${laptop.id}, got ${log.laptopId}`)
            }
            if (log.fromUserId !== fromStudent.userId) {
              throw new Error(`Log fromUserId mismatch: expected ${fromStudent.userId}, got ${log.fromUserId}`)
            }
            if (log.toUserId !== toStudent.userId) {
              throw new Error(`Log toUserId mismatch: expected ${toStudent.userId}, got ${log.toUserId}`)
            }
            if (log.transferredById !== admin.userId) {
              throw new Error(`Log transferredById mismatch: expected ${admin.userId}, got ${log.transferredById}`)
            }
            if (!log.transferredAt) {
              throw new Error('Log transferredAt must be set')
            }
          }
        ),
        { numRuns: 20 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Property 4: Transfer history is ordered descending with correct fields
// Feature: laptop-transfer, Property 4: Transfer history is ordered descending with correct fields
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------
describe('Property 4: Transfer history is ordered descending with correct fields', () => {
  it(
    'for any laptop with multiple transfers, getLaptopTransferLogs returns entries ordered by transferredAt DESC with correct fields',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Number of transfers to perform: 2 to 5
          fc.integer({ min: 2, max: 5 }),
          async (numTransfers) => {
            const admin = await makeAdmin()

            // Create a chain of students: student[0] is initial owner, then we transfer to student[1], [2], ...
            const students = []
            for (let i = 0; i <= numTransfers; i++) {
              students.push(await makeStudent(true))
            }

            const laptop = await makeLaptop(students[0].userId)

            // Perform numTransfers sequential transfers
            for (let i = 0; i < numTransfers; i++) {
              const { req, res } = makeReqRes({
                params: { id: laptop.id },
                body: { targetStudentId: students[i + 1].studentId },
                user: { id: admin.userId },
              })
              await transferLaptop(req, res)
              if (res.statusCode !== 200) {
                throw new Error(`Transfer ${i + 1} failed: ${JSON.stringify(res.body)}`)
              }
            }

            // Fetch transfer logs
            const { req: logReq, res: logRes } = makeReqRes({
              params: { id: laptop.id },
              user: { id: admin.userId },
            })
            await getLaptopTransferLogs(logReq, logRes)

            if (logRes.statusCode !== 200) {
              throw new Error(`getLaptopTransferLogs failed: ${JSON.stringify(logRes.body)}`)
            }

            const logs = logRes.body
            if (!Array.isArray(logs)) {
              throw new Error(`Expected array, got ${typeof logs}`)
            }

            // Must have exactly numTransfers entries
            if (logs.length !== numTransfers) {
              throw new Error(`Expected ${numTransfers} log entries, got ${logs.length}`)
            }

            // Verify ordering: each entry's transferred_at must be >= the next one's
            for (let i = 0; i < logs.length - 1; i++) {
              const curr = new Date(logs[i].transferred_at).getTime()
              const next = new Date(logs[i + 1].transferred_at).getTime()
              if (curr < next) {
                throw new Error(
                  `Logs not ordered DESC: entry[${i}].transferred_at (${logs[i].transferred_at}) < entry[${i + 1}].transferred_at (${logs[i + 1].transferred_at})`
                )
              }
            }

            // Verify required fields are present on every entry
            for (const log of logs) {
              const requiredFields = [
                'id', 'laptop_id', 'from_user_id', 'from_owner_name', 'from_student_id',
                'to_user_id', 'to_owner_name', 'to_student_id',
                'transferred_by_id', 'transferred_by_name', 'transferred_at',
              ]
              for (const field of requiredFields) {
                if (log[field] === undefined || log[field] === null) {
                  throw new Error(`Log entry missing required field: ${field}`)
                }
              }
            }

            // Verify the most recent log (index 0) matches the last transfer
            const lastLog = logs[0]
            const lastFrom = students[numTransfers - 1]
            const lastTo = students[numTransfers]
            if (lastLog.from_user_id !== lastFrom.userId) {
              throw new Error(`Most recent log from_user_id mismatch: expected ${lastFrom.userId}, got ${lastLog.from_user_id}`)
            }
            if (lastLog.to_user_id !== lastTo.userId) {
              throw new Error(`Most recent log to_user_id mismatch: expected ${lastTo.userId}, got ${lastLog.to_user_id}`)
            }
            if (lastLog.transferred_by_id !== admin.userId) {
              throw new Error(`Most recent log transferred_by_id mismatch: expected ${admin.userId}, got ${lastLog.transferred_by_id}`)
            }
          }
        ),
        { numRuns: 10 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Property 3: Transfer to non-existent student is rejected
// Feature: laptop-transfer, Property 3: Transfer to non-existent student is rejected
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------
describe('Property 3: Transfer to non-existent student is rejected', () => {
  it(
    'for any laptop and any studentId that has no activated User account, the transfer returns 400 and the laptop ownerId is unchanged',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random string that won't match any real studentId
          fc.string({ minLength: 5, maxLength: 20 }).map(s => `NONEXISTENT_${s}`),
          async (fakeStudentId) => {
            const owner = await makeStudent(true)
            const admin = await makeAdmin()
            const laptop = await makeLaptop(owner.userId)

            const { req, res } = makeReqRes({
              params: { id: laptop.id },
              body: { targetStudentId: fakeStudentId },
              user: { id: admin.userId },
            })

            await transferLaptop(req, res)

            // Must return 400
            if (res.statusCode !== 400) {
              throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
            }

            // Laptop ownerId must be unchanged
            const dbRow = await pool.query(`SELECT "ownerId" FROM "Laptop" WHERE id = $1`, [laptop.id])
            if (dbRow.rows[0].ownerId !== owner.userId) {
              throw new Error(`ownerId changed after rejected transfer: expected ${owner.userId}, got ${dbRow.rows[0].ownerId}`)
            }
          }
        ),
        { numRuns: 20 }
      )
    }
  )
})
