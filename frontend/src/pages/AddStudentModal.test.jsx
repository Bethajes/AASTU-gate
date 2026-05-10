import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fc from 'fast-check'
import AddStudentModal, { validateStudentForm, REQUIRED_FIELDS } from './AddStudentModal'

// ── Mock API ──────────────────────────────────────────────────────────────────
vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

import API from '../api/axios'

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// A form state where at least one required field is blank/empty
const invalidFormArb = fc.record({
  id:         fc.string(),
  username:   fc.string(),
  name:       fc.string(),
  department: fc.string(),
}).chain(base => {
  return fc.subarray(REQUIRED_FIELDS, { minLength: 1 }).map(blanked => {
    const form = { ...base }
    for (const f of blanked) form[f] = ''
    return form
  })
})

// A fully valid form (all required fields non-empty, non-whitespace)
const validFormArb = fc.record({
  id:         fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  username:   fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  name:       fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  department: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
})

// ─── Property 3: Add form rejects missing required fields ─────────────────────
// **Feature: admin-student-management, Property 3: Add form rejects missing required fields**
// **Validates: Requirements 2.3**

describe('AddStudentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Property 3: validateStudentForm returns errors for any form with a missing required field', () => {
    // **Feature: admin-student-management, Property 3: Add form rejects missing required fields**
    // **Validates: Requirements 2.3**
    fc.assert(
      fc.property(
        invalidFormArb,
        (formData) => {
          const errs = validateStudentForm(formData)

          // Must produce at least one error
          expect(Object.keys(errs).length).toBeGreaterThan(0)

          // Every blank required field must have an error entry
          for (const field of REQUIRED_FIELDS) {
            if (!formData[field] || formData[field].trim() === '') {
              expect(errs[field]).toBeTruthy()
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('Property 3 (UI): submitting with a blank required field does not call the API', () => {
    // Spot-check the UI wiring: blank "id" field should block submission
    const onSuccess = vi.fn()
    const onClose   = vi.fn()

    render(<AddStudentModal onSuccess={onSuccess} onClose={onClose} />)

    // Leave id blank, fill the rest
    fireEvent.change(document.getElementById('add-student-username'),   { target: { name: 'username',   value: 'jdoe' } })
    fireEvent.change(document.getElementById('add-student-name'),       { target: { name: 'name',       value: 'John Doe' } })
    fireEvent.change(document.getElementById('add-student-department'), { target: { name: 'department', value: 'CS' } })

    fireEvent.submit(screen.getByRole('dialog').querySelector('form'))

    expect(API.post).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Id is required')).toBeInTheDocument()
  })

  it('validates that a fully valid form has no errors', () => {
    fc.assert(
      fc.property(validFormArb, (formData) => {
        const errs = validateStudentForm(formData)
        expect(Object.keys(errs).length).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
