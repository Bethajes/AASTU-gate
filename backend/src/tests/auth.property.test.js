/**
 * Property-Based Tests — Institutional Email Verification
 * Library: fast-check  |  Runner: Vitest
 *
 * Each test is tagged with:
 *   Feature: institutional-email-verification, Property N: <property text>
 */

import { describe, it } from 'vitest'
import fc from 'fast-check'
import { isInstitutionalEmail, generateOTP, generateOTPExpiry, generateOtpToken, verifyOtpToken } from '../lib/authUtils.js'

// JWT_SECRET must be set for token tests; fall back to a test secret when running outside the app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-property-tests'

// ---------------------------------------------------------------------------
// Property 1: Institutional email validation rejects non-conforming addresses
// Feature: institutional-email-verification, Property 1: Institutional email validation rejects non-conforming addresses
// ---------------------------------------------------------------------------
describe('Property 1: Institutional email validation rejects non-conforming addresses', () => {
  it('returns false for arbitrary strings that are not valid institutional emails', () => {
    // Generate arbitrary strings and confirm they are rejected
    fc.assert(
      fc.property(fc.string(), (s) => {
        // Only check strings that we know don't match either valid pattern
        const validPattern = /^[a-zA-Z]+\.[a-zA-Z]+@aastustudents?\.edu\.et$/
        if (validPattern.test(s)) return // skip valid inputs
        return isInstitutionalEmail(s) === false
      }),
      { numRuns: 1000 }
    )
  })

  it('returns true for valid institutional emails', () => {
    // Generate valid emails for both @aastustudent.edu.et and @aastustudents.edu.et
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]+$/),
        fc.stringMatching(/^[a-zA-Z]+$/),
        fc.constantFrom('aastustudent.edu.et', 'aastustudents.edu.et'),
        (first, father, domain) => {
          const email = `${first}.${father}@${domain}`
          return isInstitutionalEmail(email) === true
        }
      ),
      { numRuns: 200 }
    )
  })

  it('returns false for emails with wrong domain', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]+$/),
        fc.stringMatching(/^[a-zA-Z]+$/),
        fc.domain(),
        (first, father, domain) => {
          // Exclude both valid domains
          if (domain === 'aastustudent.edu.et' || domain === 'aastustudents.edu.et') return
          const email = `${first}.${father}@${domain}`
          return isInstitutionalEmail(email) === false
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: OTP is always a 6-digit numeric string
// Feature: institutional-email-verification, Property 2: OTP is always a 6-digit numeric string
// ---------------------------------------------------------------------------
describe('Property 2: OTP is always a 6-digit numeric string', () => {
  it('generates a string of exactly 6 numeric characters on every call', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const otp = generateOTP()
        if (typeof otp !== 'string') return false
        if (otp.length !== 6) return false
        return /^\d{6}$/.test(otp)
      }),
      { numRuns: 1000 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: OTP expiry is always in the future at time of generation
// Feature: institutional-email-verification, Property 3: OTP expiry is always in the future at time of generation
// ---------------------------------------------------------------------------
describe('Property 3: OTP expiry is always in the future at time of generation', () => {
  it('returns a Date strictly greater than now on every call', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const before = Date.now()
        const expiry = generateOTPExpiry()
        return expiry instanceof Date && expiry.getTime() > before
      }),
      { numRuns: 1000 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4: OTP token round-trip
// **Feature: aastu-student-identity, Property 4: OTP token round-trip**
// **Validates: Requirements 4.2, 5.4**
// ---------------------------------------------------------------------------
describe('Property 4: OTP token round-trip', () => {
  it('generateOtpToken then verifyOtpToken returns the same studentId and email', () => {
    fc.assert(
      fc.property(
        // Generate valid institutional emails: firstname.fathername@aastustudent.edu.et
        fc.stringMatching(/^[a-zA-Z]+$/),
        fc.stringMatching(/^[a-zA-Z]+$/),
        // Generate realistic student IDs
        fc.integer({ min: 1, max: 99999 }),
        fc.integer({ min: 10, max: 99 }),
        (first, father, num, year) => {
          const studentId = `ETS${String(num).padStart(5, '0')}/${year}`
          const email = `${first}.${father}@aastustudent.edu.et`

          const token = generateOtpToken(studentId, email)
          const result = verifyOtpToken(token)

          if (result === null) return false
          return result.studentId === studentId && result.email === email
        }
      ),
      { numRuns: 100 }
    )
  })

  it('verifyOtpToken returns null for tampered tokens', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]+$/),
        fc.stringMatching(/^[a-zA-Z]+$/),
        (first, father) => {
          const studentId = `ETS00001/15`
          const email = `${first}.${father}@aastustudent.edu.et`

          const token = generateOtpToken(studentId, email)
          // Tamper by appending a character to the signature segment
          const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')

          return verifyOtpToken(tampered) === null
        }
      ),
      { numRuns: 100 }
    )
  })

  it('verifyOtpToken returns null for arbitrary non-token strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.includes('.')),
        (s) => {
          return verifyOtpToken(s) === null
        }
      ),
      { numRuns: 100 }
    )
  })
})
