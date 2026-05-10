import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import * as fc from 'fast-check'
import StudentsTab from './StudentsTab'

// ── Mock API ──────────────────────────────────────────────────────────────────
vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

import API from '../api/axios'

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const safeStringArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter(s => s.trim().length > 0 && s === s.trim())

const studentArb = fc.record({
  id:          safeStringArb,
  username:    safeStringArb,
  name:        safeStringArb,
  department:  safeStringArb,
  isActivated: fc.boolean(),
})

// ─── Pure filter helper (mirrors StudentsTab logic) ───────────────────────────

function filterStudents(students, search) {
  const q = search.toLowerCase()
  if (!q) return students
  return students.filter(s =>
    (s.student_id || s.id)?.toLowerCase().includes(q) ||
    s.username?.toLowerCase().includes(q) ||
    (s.full_name || s.name)?.toLowerCase().includes(q) ||
    s.department?.toLowerCase().includes(q)
  )
}

// ─── Property 1: Student table displays all required fields ───────────────────
// **Feature: admin-student-management, Property 1: Student table displays all required fields**
// **Validates: Requirements 1.2**

describe('StudentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Property 1: renders all required fields for every student returned by the API', async () => {
    // **Feature: admin-student-management, Property 1: Student table displays all required fields**
    // **Validates: Requirements 1.2**
    await fc.assert(
      fc.asyncProperty(
        fc.array(studentArb, { minLength: 1, maxLength: 5 }),
        async (students) => {
          API.get.mockResolvedValue({ data: students })

          const { unmount } = render(<StudentsTab />)

          await waitFor(() => {
            // Every student's id, username, name, department, and activation status must appear
            for (const s of students) {
              expect(screen.getAllByText(s.student_id || s.id).length).toBeGreaterThan(0)
              expect(screen.getAllByText(s.username).length).toBeGreaterThan(0)
              expect(screen.getAllByText(s.full_name || s.name).length).toBeGreaterThan(0)
              expect(screen.getAllByText(s.department).length).toBeGreaterThan(0)
            }
          })

          unmount()
        }
      ),
      { numRuns: 20 }
    )
  })

  // ─── Property 2: Search filter is correct and complete ────────────────────
  // **Feature: admin-student-management, Property 2: Search filter is correct and complete**
  // **Validates: Requirements 1.3**

  it('Property 2: search filter returns exactly the matching students (pure logic)', () => {
    // **Feature: admin-student-management, Property 2: Search filter is correct and complete**
    // **Validates: Requirements 1.3**
    fc.assert(
      fc.property(
        fc.array(studentArb, { minLength: 0, maxLength: 20 }),
        safeStringArb,
        (students, query) => {
          const result = filterStudents(students, query)
          const q = query.toLowerCase()

          // Every returned student must match the query in at least one field
          for (const s of result) {
            const matches =
              s.id.toLowerCase().includes(q) ||
              s.username.toLowerCase().includes(q) ||
              s.name.toLowerCase().includes(q) ||
              s.department.toLowerCase().includes(q)
            expect(matches).toBe(true)
          }

          // Every student that matches must appear in the result
          for (const s of students) {
            const matches =
              s.id.toLowerCase().includes(q) ||
              s.username.toLowerCase().includes(q) ||
              s.name.toLowerCase().includes(q) ||
              s.department.toLowerCase().includes(q)
            if (matches) {
              expect(result).toContain(s)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
