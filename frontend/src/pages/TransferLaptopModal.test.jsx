/**
 * Property-Based Tests — TransferLaptopModal: Student Search Filter
 * Library: fast-check  |  Runner: Vitest
 *
 * Feature: laptop-transfer, Property 5: Student search filter returns only matching results
 * Validates: Requirements 2.2
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// ---------------------------------------------------------------------------
// The filter logic extracted from TransferLaptopModal (pure function under test)
// This mirrors the useMemo in the component exactly.
// ---------------------------------------------------------------------------

/**
 * @param {Array<{full_name?: string, name?: string, student_id?: string, id?: string}>} students
 * @param {string} searchQuery
 * @returns {Array}
 */
function filterStudents(students, searchQuery) {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return []
  return students.filter(s => {
    const name = (s.full_name ?? s.name ?? '').toLowerCase()
    const sid  = (s.student_id ?? s.id ?? '').toLowerCase()
    return name.includes(q) || sid.includes(q)
  })
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const studentArb = fc.record({
  full_name:  fc.string({ minLength: 1, maxLength: 40 }),
  student_id: fc.string({ minLength: 1, maxLength: 20 }),
})

const studentListArb = fc.array(studentArb, { minLength: 0, maxLength: 50 })

// ---------------------------------------------------------------------------
// Property 5: Student search filter returns only matching results
// Feature: laptop-transfer, Property 5: Student search filter returns only matching results
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Property 5: Student search filter returns only matching results', () => {
  it(
    'for any list of students and any non-empty query, every returned student matches by name or student ID',
    () => {
      fc.assert(
        fc.property(
          studentListArb,
          fc.string({ minLength: 1, maxLength: 15 }),
          (students, query) => {
            const results = filterStudents(students, query)
            const q = query.trim().toLowerCase()

            // If query trims to empty, results must be empty
            if (!q) {
              expect(results).toHaveLength(0)
              return
            }

            // Every result must match the query in name or student_id
            for (const student of results) {
              const name = (student.full_name ?? student.name ?? '').toLowerCase()
              const sid  = (student.student_id ?? student.id ?? '').toLowerCase()
              const matches = name.includes(q) || sid.includes(q)
              expect(matches).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  it(
    'for any list of students and an empty query, the result is always empty',
    () => {
      fc.assert(
        fc.property(
          studentListArb,
          fc.constantFrom('', '   ', '\t', '\n'),
          (students, emptyQuery) => {
            const results = filterStudents(students, emptyQuery)
            expect(results).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  it(
    'for any student in the list, searching by their exact name returns a result containing that student',
    () => {
      fc.assert(
        fc.property(
          fc.array(studentArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (students, idx) => {
            const target = students[Math.min(idx, students.length - 1)]
            const query  = target.full_name

            const results = filterStudents(students, query)

            // The target student must appear in results
            const found = results.some(
              s => s.full_name === target.full_name && s.student_id === target.student_id
            )
            expect(found).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  it(
    'for any student in the list, searching by their exact student_id returns a result containing that student',
    () => {
      fc.assert(
        fc.property(
          fc.array(studentArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (students, idx) => {
            const target = students[Math.min(idx, students.length - 1)]
            const query  = target.student_id

            const results = filterStudents(students, query)

            const found = results.some(
              s => s.full_name === target.full_name && s.student_id === target.student_id
            )
            expect(found).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})
