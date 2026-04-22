/**
 * Property-Based Tests — Hybrid Gate Verification
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: hybrid-gate-verification, Property N: <property text>
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import pool from '../lib/db.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a minimal User row and return its id */
async function createUser(role = 'GUARD') {
  const id = crypto.randomUUID()
  const suffix = id.slice(0, 8)
  const studentId = role === 'STUDENT' ? `ETS${suffix}` : null
  await pool.query(
    `INSERT INTO "User" (id, name, email, password, role, "studentId")
     VALUES ($1, $2, $3, 'hashed', $4::"Role", $5)`,
    [id, `Test ${role} ${suffix}`, `${suffix}@test.local`, role, studentId]
  )
  return { id, studentId }
}

/** Create a Laptop row with PENDING status and return its id + qrCode */
async function createLaptop(ownerId, overrides = {}) {
  const id = crypto.randomUUID()
  const qrCode = Math.floor(10000000 + Math.random() * 90000000).toString()
  const serial = `SN-${id.slice(0, 8)}`
  await pool.query(
    `INSERT INTO "Laptop" (id, "serialNumber", brand, model, "qrCode", "ownerId",
                           "verificationStatus", "isInCampus")
     VALUES ($1, $2, $3, $4, $5, $6,
             $7::"VerificationStatus", $8)`,
    [
      id, serial, 'TestBrand', 'TestModel', qrCode, ownerId,
      overrides.verificationStatus ?? 'PENDING',
      overrides.isInCampus ?? false,
    ]
  )
  return { id, qrCode }
}

/** Set a laptop's verificationStatus directly in the DB */
async function setStatus(laptopId, status) {
  await pool.query(
    `UPDATE "Laptop" SET "verificationStatus" = $1::"VerificationStatus" WHERE id = $2`,
    [status, laptopId]
  )
}

/** Set isInCampus directly */
async function setInCampus(laptopId, value) {
  await pool.query(
    `UPDATE "Laptop" SET "isInCampus" = $1 WHERE id = $2`,
    [value, laptopId]
  )
}

/** Fetch a laptop row by id */
async function getLaptop(laptopId) {
  const r = await pool.query(`SELECT * FROM "Laptop" WHERE id = $1`, [laptopId])
  return r.rows[0]
}

/** Count GateLog rows for a laptop with a given action */
async function countLogs(laptopId, action) {
  const r = await pool.query(
    `SELECT COUNT(*) FROM "GateLog" WHERE "laptopId" = $1 AND action = $2`,
    [laptopId, action]
  )
  return parseInt(r.rows[0].count, 10)
}

// Track created IDs for cleanup
const createdUsers = []
const createdLaptops = []

async function makeUser(role) {
  const u = await createUser(role)
  createdUsers.push(u.id)
  return u
}

async function makeLaptop(ownerId, overrides) {
  const l = await createLaptop(ownerId, overrides)
  createdLaptops.push(l.id)
  return l
}

afterEach(async () => {
  if (createdLaptops.length) {
    await pool.query(`DELETE FROM "GateLog" WHERE "laptopId" = ANY($1)`, [createdLaptops])
    await pool.query(`DELETE FROM "Laptop" WHERE id = ANY($1)`, [createdLaptops])
    createdLaptops.length = 0
  }
  if (createdUsers.length) {
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [createdUsers])
    createdUsers.length = 0
  }
})

// ---------------------------------------------------------------------------
// Import controllers under test
// ---------------------------------------------------------------------------
import {
  lookupLaptop,
  verifyLaptop,
  blockLaptop,
  logEntry,
  logExit,
} from '../controllers/gate.controller.js'

/** Build a minimal Express-like req/res pair */
function makeReqRes(params = {}, query = {}, user = {}) {
  const req = { params, query, user, body: {} }
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

// ---------------------------------------------------------------------------
// Property 11: Lookup by code and lookup by studentId return equivalent records
// Feature: hybrid-gate-verification, Property 11: Lookup by code and lookup by studentId return equivalent records
// ---------------------------------------------------------------------------
describe('Property 11: Lookup by code and lookup by studentId return equivalent records', () => {
  it('returns the same laptop id regardless of lookup method', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id)

        const { req: reqByCode, res: resByCode } = makeReqRes({}, { code: laptop.qrCode }, {})
        await lookupLaptop(reqByCode, resByCode)

        const { req: reqById, res: resByStudentId } = makeReqRes({}, { studentId: student.studentId }, {})
        await lookupLaptop(reqById, resByStudentId)

        if (resByCode.statusCode !== 200 || resByStudentId.statusCode !== 200) {
          throw new Error(
            `Expected 200 for both lookups, got code=${resByCode.statusCode} studentId=${resByStudentId.statusCode}`
          )
        }

        if (resByCode.body.id !== resByStudentId.body.id) {
          throw new Error(
            `Lookup by code returned id=${resByCode.body.id} but lookup by studentId returned id=${resByStudentId.body.id}`
          )
        }
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Verify transitions PENDING → VERIFIED
// Feature: hybrid-gate-verification, Property 2: Verify transitions PENDING → VERIFIED
// ---------------------------------------------------------------------------
describe('Property 2: Verify transitions PENDING → VERIFIED', () => {
  it('sets verificationStatus to VERIFIED and records verifiedAt and verifiedBy', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'PENDING' })

        const { req, res } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await verifyLaptop(req, res)

        if (res.statusCode !== 200) {
          throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }

        const row = await getLaptop(laptop.id)
        if (row.verificationStatus !== 'VERIFIED') {
          throw new Error(`Expected VERIFIED, got ${row.verificationStatus}`)
        }
        if (!row.verifiedAt) {
          throw new Error('verifiedAt should be set')
        }
        if (row.verifiedById !== guard.id) {
          throw new Error(`verifiedById should be ${guard.id}, got ${row.verifiedById}`)
        }
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 9: Verify is idempotent-safe — double verify is rejected
// Feature: hybrid-gate-verification, Property 9: Verify is idempotent-safe — double verify is rejected
// ---------------------------------------------------------------------------
describe('Property 9: Verify is idempotent-safe — double verify is rejected', () => {
  it('rejects a second verify request with 400', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'PENDING' })

        // First verify — should succeed
        const { req: req1, res: res1 } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await verifyLaptop(req1, res1)

        // Second verify — should be rejected
        const { req: req2, res: res2 } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await verifyLaptop(req2, res2)

        if (res2.statusCode !== 400) {
          throw new Error(`Expected 400 on double verify, got ${res2.statusCode}`)
        }
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Block sets status to BLOCKED
// Feature: hybrid-gate-verification, Property 3: Block sets status to BLOCKED
// ---------------------------------------------------------------------------
describe('Property 3: Block sets status to BLOCKED', () => {
  it('sets verificationStatus to BLOCKED for any starting status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PENDING', 'VERIFIED'),
        async (startStatus) => {
          const guard = await makeUser('GUARD')
          const student = await makeUser('STUDENT')
          const laptop = await makeLaptop(student.id, { verificationStatus: startStatus })

          const { req, res } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
          await blockLaptop(req, res)

          if (res.statusCode !== 200) {
            throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          const row = await getLaptop(laptop.id)
          if (row.verificationStatus !== 'BLOCKED') {
            throw new Error(`Expected BLOCKED, got ${row.verificationStatus}`)
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5: PENDING laptop rejects gate actions
// Feature: hybrid-gate-verification, Property 5: PENDING laptop rejects gate actions
// ---------------------------------------------------------------------------
describe('Property 5: PENDING laptop rejects gate actions', () => {
  it('rejects ENTRY and EXIT with non-2xx for PENDING laptops', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('entry', 'exit'), async (action) => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'PENDING', isInCampus: action === 'exit' })

        const controller = action === 'entry' ? logEntry : logExit
        const { req, res } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await controller(req, res)

        if (res.statusCode < 400) {
          throw new Error(`Expected non-2xx for PENDING laptop ${action}, got ${res.statusCode}`)
        }
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4: BLOCKED laptop rejects gate actions
// Feature: hybrid-gate-verification, Property 4: BLOCKED laptop rejects gate actions
// ---------------------------------------------------------------------------
describe('Property 4: BLOCKED laptop rejects gate actions', () => {
  it('rejects ENTRY and EXIT with non-2xx for BLOCKED laptops', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('entry', 'exit'), async (action) => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'BLOCKED', isInCampus: action === 'exit' })

        const controller = action === 'entry' ? logEntry : logExit
        const { req, res } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await controller(req, res)

        if (res.statusCode < 400) {
          throw new Error(`Expected non-2xx for BLOCKED laptop ${action}, got ${res.statusCode}`)
        }
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Entry log creates a GateLog record with action ENTRY
// Feature: hybrid-gate-verification, Property 6: Entry log creates a GateLog record with action ENTRY
// ---------------------------------------------------------------------------
describe('Property 6: Entry log creates a GateLog record with action ENTRY', () => {
  it('inserts a GateLog row with action=ENTRY after successful entry', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'VERIFIED', isInCampus: false })

        const before = await countLogs(laptop.id, 'ENTRY')

        const { req, res } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await logEntry(req, res)

        if (res.statusCode !== 200) {
          throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }

        const after = await countLogs(laptop.id, 'ENTRY')
        if (after !== before + 1) {
          throw new Error(`Expected ENTRY log count to increase by 1, was ${before} now ${after}`)
        }

        // Reset for cleanup
        await setInCampus(laptop.id, false)
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7: Exit log creates a GateLog record with action EXIT
// Feature: hybrid-gate-verification, Property 7: Exit log creates a GateLog record with action EXIT
// ---------------------------------------------------------------------------
describe('Property 7: Exit log creates a GateLog record with action EXIT', () => {
  it('inserts a GateLog row with action=EXIT after successful exit', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'VERIFIED', isInCampus: true })

        const before = await countLogs(laptop.id, 'EXIT')

        const { req, res } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await logExit(req, res)

        if (res.statusCode !== 200) {
          throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }

        const after = await countLogs(laptop.id, 'EXIT')
        if (after !== before + 1) {
          throw new Error(`Expected EXIT log count to increase by 1, was ${before} now ${after}`)
        }

        // Reset for cleanup
        await setInCampus(laptop.id, true)
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 8: Entry sets isInCampus = true, Exit sets isInCampus = false
// Feature: hybrid-gate-verification, Property 8: Entry sets isInCampus = true, Exit sets isInCampus = false
// ---------------------------------------------------------------------------
describe('Property 8: Entry sets isInCampus = true, Exit sets isInCampus = false', () => {
  it('entry then exit round-trips isInCampus correctly', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeUser('GUARD')
        const student = await makeUser('STUDENT')
        const laptop = await makeLaptop(student.id, { verificationStatus: 'VERIFIED', isInCampus: false })

        // Entry
        const { req: entryReq, res: entryRes } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await logEntry(entryReq, entryRes)
        if (entryRes.statusCode !== 200) throw new Error(`Entry failed: ${entryRes.statusCode}`)

        const afterEntry = await getLaptop(laptop.id)
        if (!afterEntry.isInCampus) throw new Error('isInCampus should be true after entry')

        // Exit
        const { req: exitReq, res: exitRes } = makeReqRes({ laptopId: laptop.id }, {}, { id: guard.id })
        await logExit(exitReq, exitRes)
        if (exitRes.statusCode !== 200) throw new Error(`Exit failed: ${exitRes.statusCode}`)

        const afterExit = await getLaptop(laptop.id)
        if (afterExit.isInCampus) throw new Error('isInCampus should be false after exit')
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 10: Role enforcement — non-guard/admin is rejected
// Feature: hybrid-gate-verification, Property 10: Role enforcement — non-guard/admin is rejected
// ---------------------------------------------------------------------------
describe('Property 10: Role enforcement — non-guard/admin is rejected', () => {
  it('returns 403 when a STUDENT calls gate endpoints via middleware', async () => {
    // This property tests the allowRoles middleware logic directly
    const { allowRoles } = await import('../middleware/auth.middleware.js')

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('verify', 'entry', 'exit', 'block'),
        async (endpoint) => {
          const studentReq = { user: { role: 'STUDENT' } }
          let statusCode = null
          const res = {
            status(code) { statusCode = code; return res },
            json() { return res },
          }
          let nextCalled = false
          const next = () => { nextCalled = true }

          allowRoles('GUARD', 'ADMIN')(studentReq, res, next)

          if (statusCode !== 403) {
            throw new Error(`Expected 403 for STUDENT on ${endpoint}, got ${statusCode}`)
          }
          if (nextCalled) {
            throw new Error(`next() should not be called for STUDENT on ${endpoint}`)
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})
