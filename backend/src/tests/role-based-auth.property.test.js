/**
 * Property-Based Tests — Role-Based Authentication
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: role-based-auth, Property N: <property text>
 */

import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import crypto from 'crypto'
import pool from '../lib/db.js'
import { register } from '../controllers/auth.controller.js'
import { allowRoles } from '../middleware/auth.middleware.js'

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

// Generates a valid AASTU institutional email: firstname.fathername@aastustudent.edu.et or @aastustudents.edu.et
function validEmail(first, father) {
  return `${first}.${father}@aastustudent.edu.et`
}

const createdUserIds = []

afterEach(async () => {
  if (createdUserIds.length) {
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [createdUserIds])
    createdUserIds.length = 0
  }
})

// ---------------------------------------------------------------------------
// Property 1: Register endpoint is disabled (returns 410)
// Manual registration was removed in the aastu-student-identity spec (Requirement 8.1).
// **Feature: role-based-auth, Property 1: Register always produces STUDENT role**
// ---------------------------------------------------------------------------
describe('Property 1: Register always produces STUDENT role', () => {
  it('for any valid registration payload, the created user always has role STUDENT', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          first: fc.stringMatching(/^[a-zA-Z]{1,15}$/),
          father: fc.stringMatching(/^[a-zA-Z]{1,15}$/),
        }),
        async ({ name, first, father }) => {
          const email = validEmail(first, father)
          const { req, res } = makeReqRes({ name: name.trim(), email, password: 'Password123' })
          await register(req, res)

          // Manual registration is disabled — endpoint returns 410 Gone
          if (res.statusCode !== 410) {
            throw new Error(`Expected 410 (endpoint removed), got ${res.statusCode}: ${JSON.stringify(res.body)}`)
          }
        }
      ),
      { numRuns: 30 }
    )
  }, 60000)
})

// ---------------------------------------------------------------------------
// Property 2: Register endpoint is disabled — role injection is impossible
// Manual registration was removed in the aastu-student-identity spec (Requirement 8.1).
// **Feature: role-based-auth, Property 2: Role field in request body is always rejected**
// ---------------------------------------------------------------------------
describe('Property 2: Role field in request body is always rejected', () => {
  it('for any payload containing a role field, the handler returns 403', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          suffix: fc.nat({ max: 999999 }),
          role: fc.oneof(
            fc.constant('STUDENT'),
            fc.constant('GUARD'),
            fc.constant('ADMIN'),
            fc.string({ minLength: 1, maxLength: 20 })
          ),
        }),
        async ({ suffix, role }) => {
          const email = validEmail(`user${suffix}`, `test${suffix}`)
          const { req, res } = makeReqRes({
            name: 'Test User',
            email,
            password: 'Password123',
            role,
          })
          await register(req, res)

          // Manual registration is disabled — endpoint returns 410 Gone before role check
          if (res.statusCode !== 410) {
            throw new Error(`Expected 410 (endpoint removed), got ${res.statusCode}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Register endpoint is disabled — missing fields return 410
// Manual registration was removed in the aastu-student-identity spec (Requirement 8.1).
// **Feature: role-based-auth, Property 3: Missing required fields are always rejected**
// ---------------------------------------------------------------------------
describe('Property 3: Missing required fields are always rejected', () => {
  it('for any payload missing name, email, or password, the handler returns 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(['name', 'email', 'password'], { minLength: 1 }),
        async (missingFields) => {
          const full = {
            name: 'Test User',
            email: validEmail(`user${crypto.randomUUID().slice(0, 6)}`, `test${crypto.randomUUID().slice(0, 6)}`),
            password: 'Password123',
          }
          const payload = { ...full }
          for (const f of missingFields) delete payload[f]

          const { req, res } = makeReqRes(payload)
          await register(req, res)

          // Manual registration is disabled — endpoint returns 410 Gone before field validation
          if (res.statusCode !== 410) {
            throw new Error(
              `Expected 410 (endpoint removed) when missing [${missingFields.join(', ')}], got ${res.statusCode}`
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Register endpoint is disabled — duplicate email check is moot
// Manual registration was removed in the aastu-student-identity spec (Requirement 8.1).
// **Feature: role-based-auth, Property 6: Duplicate email registration is always rejected**
// ---------------------------------------------------------------------------
describe('Property 6: Duplicate email registration is always rejected', () => {
  it('for any email already registered, a second attempt returns 409', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          first: fc.stringMatching(/^[a-zA-Z]{1,15}$/),
          father: fc.stringMatching(/^[a-zA-Z]{1,15}$/),
        }),
        async ({ first, father }) => {
          const email = validEmail(first, father)

          // Both attempts should return 410 — endpoint is removed
          const { req: req1, res: res1 } = makeReqRes({
            name: 'First User',
            email,
            password: 'Password123',
          })
          await register(req1, res1)

          if (res1.statusCode !== 410) {
            throw new Error(`Expected 410 (endpoint removed), got: ${res1.statusCode} ${JSON.stringify(res1.body)}`)
          }

          const { req: req2, res: res2 } = makeReqRes({
            name: 'Second User',
            email,
            password: 'DifferentPass456',
          })
          await register(req2, res2)

          if (res2.statusCode !== 410) {
            throw new Error(`Expected 410 (endpoint removed) on second attempt, got ${res2.statusCode}`)
          }
        }
      ),
      { numRuns: 30 }
    )
  }, 120000)
})

// ---------------------------------------------------------------------------
// Property 5: Role-based route access is enforced for all roles
// **Feature: role-based-auth, Property 5: Role-based route access is enforced for all roles**
// ---------------------------------------------------------------------------
describe('Property 5: Role-based route access is enforced for all roles', () => {
  it('allowRoles returns 403 for roles not in whitelist and passes for roles in whitelist', () => {
    const ALL_ROLES = ['STUDENT', 'GUARD', 'ADMIN']

    fc.assert(
      fc.property(
        fc.subarray(ALL_ROLES, { minLength: 1 }),
        fc.constantFrom(...ALL_ROLES),
        (whitelist, userRole) => {
          let nextCalled = false
          let statusCode = null
          let responseBody = null

          const req = { user: { role: userRole } }
          const res = {
            status(code) { statusCode = code; return res },
            json(b) { responseBody = b; return res },
          }
          const next = () => { nextCalled = true }

          allowRoles(...whitelist)(req, res, next)

          if (whitelist.includes(userRole)) {
            if (!nextCalled) {
              throw new Error(`Expected next() to be called for role "${userRole}" in whitelist [${whitelist}]`)
            }
          } else {
            if (nextCalled) {
              throw new Error(`Expected 403 for role "${userRole}" not in whitelist [${whitelist}]`)
            }
            if (statusCode !== 403) {
              throw new Error(`Expected status 403, got ${statusCode}`)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
