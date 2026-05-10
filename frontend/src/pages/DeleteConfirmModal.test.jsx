import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as fc from 'fast-check'
import DeleteConfirmModal from './DeleteConfirmModal'

// ── Mock API ──────────────────────────────────────────────────────────────────
vi.mock('../api/axios', () => ({
  default: { delete: vi.fn() },
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

// ─── Pure helper: apply deletion to a list ────────────────────────────────────

export function deleteStudentFromList(students, deletedId) {
  return students.filter(s => s.id !== deletedId)
}

// ─── Property 4: Delete removes the correct record ───────────────────────────
// **Feature: admin-student-management, Property 4: Delete removes the correct record**
// **Validates: Requirements 3.2**

describe('DeleteConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Property 4: confirming deletion removes only the target student and leaves all others', async () => {
    // **Feature: admin-student-management, Property 4: Delete removes the correct record**
    // **Validates: Requirements 3.2**
    await fc.assert(
      fc.asyncProperty(
        fc.array(studentArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        async (students, rawIndex) => {
          // Pick a valid index within the actual array length
          const index   = rawIndex % students.length
          const target  = students[index]

          API.delete.mockResolvedValue({})

          const onSuccess = vi.fn()
          const onClose   = vi.fn()

          const { unmount } = render(
            <DeleteConfirmModal student={target} onSuccess={onSuccess} onClose={onClose} />
          )

          // Click the Delete button to confirm
          fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

          await waitFor(() => {
            expect(API.delete).toHaveBeenCalledWith(`/students/${target.id}`)
            expect(onSuccess).toHaveBeenCalledWith(target.id)
          })

          // Verify the pure list-update logic: target is gone, others remain
          const updated = deleteStudentFromList(students, target.id)
          expect(updated.find(s => s.id === target.id)).toBeUndefined()
          expect(updated.length).toBe(students.filter(s => s.id !== target.id).length)

          unmount()
        }
      ),
      { numRuns: 20 }
    )
  })

  it('shows an error message and does not call onSuccess when the delete request fails', async () => {
    const student  = { id: 'ETS001', username: 'jdoe', name: 'John Doe', department: 'CS', isActivated: false }
    const onSuccess = vi.fn()
    const onClose   = vi.fn()

    API.delete.mockRejectedValue({ response: { data: { message: 'Not found' } } })

    render(<DeleteConfirmModal student={student} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
