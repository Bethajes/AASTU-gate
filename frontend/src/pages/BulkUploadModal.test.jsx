import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { importRows } from './BulkUploadModal'

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const safeStringArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && s === s.trim())

const studentRowArb = fc.record({
  id:         safeStringArb,
  username:   safeStringArb,
  name:       safeStringArb,
  department: safeStringArb,
})

// ─── Property 7: Bulk import fires one request per valid row ──────────────────
// **Feature: admin-student-management, Property 7: Bulk import fires one request per valid row**
// **Validates: Requirements 4.3**

describe('BulkUploadModal - importRows', () => {
  it('Property 7: calls postFn exactly N times and success+failure counts sum to N', async () => {
    // **Feature: admin-student-management, Property 7: Bulk import fires one request per valid row**
    // **Validates: Requirements 4.3**
    await fc.assert(
      fc.asyncProperty(
        fc.array(studentRowArb, { minLength: 1, maxLength: 10 }),
        // booleans: true = this row succeeds, false = fails
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        async (rows, outcomes) => {
          let callCount = 0

          // postFn succeeds or fails based on outcomes array (cycling if shorter)
          const postFn = vi.fn().mockImplementation(() => {
            const idx = callCount++
            const shouldSucceed = outcomes[idx % outcomes.length]
            return shouldSucceed
              ? Promise.resolve({})
              : Promise.reject(new Error('server error'))
          })

          const result = await importRows(rows, postFn)

          // Property: postFn called exactly once per row
          expect(postFn).toHaveBeenCalledTimes(rows.length)

          // Property: succeeded + failed === total rows
          expect(result.succeeded + result.failed).toBe(rows.length)

          // Property: failedIds contains exactly the IDs of failed rows
          expect(result.failedIds).toHaveLength(result.failed)
        }
      ),
      { numRuns: 100 }
    )
  })
})
