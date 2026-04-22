/**
 * Property-Based Tests — Guest Registration
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: guest-registration, Property N: <property text>
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import pool from '../lib/db.js'
import {
  generateGuestCode,
  registerGuest,
  lookupGuest,
  guestEntry,
  guestExit,
} from '../controllers/guest.controller.js'
import { getLogs } from '../controllers/gate.controller.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(role = 'GUARD') {
  const id = crypto.randomUUID()
  const suffix = id.slice(0, 8)
  await pool.query(
    `INSERT INTO "User" (id, name, email, password, role)
     VALUES ($1, $2, $3, 'hashed', $4::"Role")`,
    [id, `Test ${role} ${suffix}`, `${suffix}@test.local`, role]
  )
  return { id }
}

function makeReqRes(body = {}, params = {}, query = {}, user = {}) {
  const req = { body, params, query, user }
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

function validGuestPayload(overrides = {}) {
  const suffix = crypto.randomUUID().slice(0, 6)
  return {
    guestName: `Guest ${suffix}`,
    phone: `+2519${suffix}`,
    purpose: 'Campus visit',
    deviceBrand: 'Dell',
    deviceModel: 'Latitude',
    serialNumber: `SN-${suffix}`,
    ...overrides,
  }
}

const createdUsers = []
const createdGuests = []

async function makeGuard() {
  const u = await createUser('GUARD')
  createdUsers.push(u.id)
  return u
}

async function createGuestPass(guardId, overrides = {}) {
  const payload = validGuestPayload(overrides)
  const { req, res } = makeReqRes(payload, {}, {}, { id: guardId })
  await registerGuest(req, res)
  if (res.statusCode !== 201) throw new Error(`registerGuest failed: ${JSON.stringify(res.body)}`)
  const gp = res.body.guestPass
  createdGuests.push(gp.id)
  return gp
}

afterEach(async () => {
  if (createdGuests.length) {
    await pool.query(`DELETE FROM "GateLog" WHERE "guestPassId" = ANY($1::uuid[])`, [createdGuests])
    await pool.query(`DELETE FROM "GuestPass" WHERE id = ANY($1::uuid[])`, [createdGuests])
    createdGuests.length = 0
  }
  if (createdUsers.length) {
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [createdUsers])
    createdUsers.length = 0
  }
})

// ---------------------------------------------------------------------------
// Unit test: generateGuestCode always produces 8 numeric digits
// Requirements: 1.3
// ---------------------------------------------------------------------------
describe('generateGuestCode unit test', () => {
  it('always returns exactly 8 numeric digits', async () => {
    for (let i = 0; i < 20; i++) {
      const code = await generateGuestCode()
      if (!/^\d{8}$/.test(code)) {
        throw new Error(`Expected 8-digit numeric code, got: "${code}"`)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Property 1: GuestPass creation invariants
// Feature: guest-registration, Property 1: GuestPass creation invariants
// ---------------------------------------------------------------------------
describe('Property 1: GuestPass creation invariants', () => {
  it('created record has all submitted fields, 8-digit code, VERIFIED status, isInCampus=false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          guestName:    fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          phone:        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          purpose:      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          deviceBrand:  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          deviceModel:  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          serialNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        }),
        async (payload) => {
          const guard = await makeGuard()
          const { req, res } = makeReqRes(payload, {}, {}, { id: guard.id })
          await registerGuest(req, res)

          if (res.statusCode !== 201) {
            throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }

          const gp = res.body.guestPass
          createdGuests.push(gp.id)

          if (!/^\d{8}$/.test(gp.guestCode)) {
            throw new Error(`guestCode "${gp.guestCode}" is not 8 numeric digits`)
          }
          if (gp.verificationstatus !== 'VERIFIED' && gp.verificationStatus !== 'VERIFIED') {
            throw new Error(`Expected VERIFIED, got ${gp.verificationstatus ?? gp.verificationStatus}`)
          }
          if (gp.isincampus !== false && gp.isInCampus !== false) {
            throw new Error(`Expected isInCampus=false, got ${gp.isincampus ?? gp.isInCampus}`)
          }
          if (gp.guestname !== payload.guestName.trim() && gp.guestName !== payload.guestName.trim()) {
            throw new Error(`guestName mismatch: expected "${payload.guestName.trim()}", got "${gp.guestname ?? gp.guestName}"`)
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Missing required field rejection
// Feature: guest-registration, Property 2: Missing required field rejection
// ---------------------------------------------------------------------------
describe('Property 2: Missing required field rejection', () => {
  it('returns 4xx and does not create a record when any required field is blank', async () => {
    const FIELDS = ['guestName', 'phone', 'purpose', 'deviceBrand', 'deviceModel', 'serialNumber']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...FIELDS),
        async (missingField) => {
          const guard = await makeGuard()
          const payload = validGuestPayload({ [missingField]: '' })
          const { req, res } = makeReqRes(payload, {}, {}, { id: guard.id })

          const before = await pool.query(`SELECT COUNT(*) FROM "GuestPass"`)
          await registerGuest(req, res)
          const after = await pool.query(`SELECT COUNT(*) FROM "GuestPass"`)

          if (res.statusCode < 400) {
            throw new Error(`Expected 4xx for missing ${missingField}, got ${res.statusCode}`)
          }
          if (parseInt(after.rows[0].count) !== parseInt(before.rows[0].count)) {
            throw new Error(`GuestPass count changed despite validation error for missing ${missingField}`)
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Guest pass lookup round trip
// Feature: guest-registration, Property 3: Guest pass lookup round trip
// ---------------------------------------------------------------------------
describe('Property 3: Guest pass lookup round trip', () => {
  it('lookup by guestCode returns all required fields and no photoUrl', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeGuard()
        const gp = await createGuestPass(guard.id)

        const { req, res } = makeReqRes({}, {}, { code: gp.guestcode ?? gp.guestCode }, { id: guard.id })
        await lookupGuest(req, res)

        if (res.statusCode !== 200) {
          throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
        }

        const record = res.body
        const required = ['guest_name', 'phone', 'purpose', 'device_brand', 'device_model',
                          'serial_number', 'guest_code', 'verification_status', 'is_in_campus']
        for (const field of required) {
          if (record[field] === undefined) {
            throw new Error(`Missing field "${field}" in lookup response`)
          }
        }
        if ('photo_url' in record || 'photoUrl' in record) {
          throw new Error('Response should not contain a photo_url field')
        }
      }),
      { numRuns: 30 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4: Entry then exit round trip restores campus state
// Feature: guest-registration, Property 4: Entry then exit round trip restores campus state
// ---------------------------------------------------------------------------
describe('Property 4: Entry then exit round trip restores campus state', () => {
  it('entry sets isInCampus=true and logs IN; exit sets isInCampus=false and logs OUT', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeGuard()
        const gp = await createGuestPass(guard.id)

        // Entry
        const { req: entryReq, res: entryRes } = makeReqRes({}, { id: gp.id }, {}, { id: guard.id })
        await guestEntry(entryReq, entryRes)
        if (entryRes.statusCode !== 200) {
          throw new Error(`Entry failed: ${entryRes.statusCode} ${JSON.stringify(entryRes.body)}`)
        }

        const afterEntry = await pool.query(`SELECT "isInCampus" FROM "GuestPass" WHERE id = $1`, [gp.id])
        if (!afterEntry.rows[0].isInCampus) throw new Error('isInCampus should be true after entry')

        const entryLog = await pool.query(
          `SELECT COUNT(*) FROM "GateLog" WHERE "guestPassId" = $1 AND "scanType" = 'IN'::"ScanType"`,
          [gp.id]
        )
        if (parseInt(entryLog.rows[0].count) < 1) throw new Error('Expected GateLog IN record')

        // Exit
        const { req: exitReq, res: exitRes } = makeReqRes({}, { id: gp.id }, {}, { id: guard.id })
        await guestExit(exitReq, exitRes)
        if (exitRes.statusCode !== 200) {
          throw new Error(`Exit failed: ${exitRes.statusCode} ${JSON.stringify(exitRes.body)}`)
        }

        const afterExit = await pool.query(`SELECT "isInCampus" FROM "GuestPass" WHERE id = $1`, [gp.id])
        if (afterExit.rows[0].isInCampus) throw new Error('isInCampus should be false after exit')

        const exitLog = await pool.query(
          `SELECT COUNT(*) FROM "GateLog" WHERE "guestPassId" = $1 AND "scanType" = 'OUT'::"ScanType"`,
          [gp.id]
        )
        if (parseInt(exitLog.rows[0].count) < 1) throw new Error('Expected GateLog OUT record')
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5: Blocked guest pass rejects entry and exit
// Feature: guest-registration, Property 5: Blocked guest pass rejects entry and exit
// ---------------------------------------------------------------------------
describe('Property 5: Blocked guest pass rejects entry and exit', () => {
  it('returns 4xx for both entry and exit when guest pass is BLOCKED', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('entry', 'exit'), async (action) => {
        const guard = await makeGuard()
        const gp = await createGuestPass(guard.id)

        // Block the pass directly
        await pool.query(
          `UPDATE "GuestPass" SET "verificationStatus" = 'BLOCKED', "isInCampus" = $1 WHERE id = $2`,
          [action === 'exit', gp.id]
        )

        const controller = action === 'entry' ? guestEntry : guestExit
        const { req, res } = makeReqRes({}, { id: gp.id }, {}, { id: guard.id })
        await controller(req, res)

        if (res.statusCode < 400) {
          throw new Error(`Expected 4xx for BLOCKED guest ${action}, got ${res.statusCode}`)
        }
      }),
      { numRuns: 20 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Guest events appear in gate log with required fields
// Feature: guest-registration, Property 6: Guest events appear in gate log with required fields
// ---------------------------------------------------------------------------
describe('Property 6: Guest events appear in gate log with required fields', () => {
  it('getLogs returns guest event with guest_name, device brand, serial, scan type, timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const guard = await makeGuard()
        const gp = await createGuestPass(guard.id)

        // Log an entry
        const { req: entryReq, res: entryRes } = makeReqRes({}, { id: gp.id }, {}, { id: guard.id })
        await guestEntry(entryReq, entryRes)
        if (entryRes.statusCode !== 200) throw new Error(`Entry failed: ${entryRes.statusCode}`)

        // Fetch logs
        const { req: logsReq, res: logsRes } = makeReqRes({}, {}, {}, { id: guard.id })
        await getLogs(logsReq, logsRes)
        if (logsRes.statusCode !== 200) throw new Error(`getLogs failed: ${logsRes.statusCode}`)

        const guestLog = logsRes.body.find(l => l.type === 'guest' && l.guest_name)
        if (!guestLog) throw new Error('No guest log entry found in getLogs response')

        const required = ['guest_name', 'guest_brand', 'guest_serial', 'action', 'scanned_at']
        for (const field of required) {
          if (!guestLog[field]) {
            throw new Error(`Missing field "${field}" in guest log entry`)
          }
        }

        // Reset campus state
        await pool.query(`UPDATE "GuestPass" SET "isInCampus" = false WHERE id = $1`, [gp.id])
      }),
      { numRuns: 20 }
    )
  })
})
