import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import Activate from './Activate'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

vi.mock('../components/AASTULogo', () => ({
  default: () => <div data-testid="logo" />,
}))

vi.mock('../components/AuthPageLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

import API from '../api/axios'

function renderActivate() {
  return render(
    <MemoryRouter>
      <Activate />
    </MemoryRouter>
  ).container
}

// Submit Step 1 with the given studentId
function submitStep1(container, studentId) {
  const view = within(container)
  fireEvent.change(view.getByPlaceholderText(/e\.g\. ETS023\/15/i), {
    target: { value: studentId },
  })
  fireEvent.click(view.getByRole('button', { name: /continue/i }))
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

// ── Property 16: UI displays student identity after valid student ID submission ──
// **Feature: preloaded-student-activation, Property 16: UI displays student identity after valid username + student ID submission**
// **Validates: Requirements 5.2**
describe('Property 16: UI displays student identity after valid student ID submission', () => {
  it('renders student name and photo area for any valid student record returned by the backend', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 3, maxLength: 40 })
            .filter(s => s.trim() === s && s.trim().length > 0),
          department: fc.string({ minLength: 1, maxLength: 40 }),
          photo: fc.oneof(fc.constant(null), fc.constant('https://example.com/photo.jpg')),
        }),
        async (student) => {
          cleanup()
          vi.clearAllMocks()
          API.post.mockResolvedValueOnce({ data: student })

          const container = renderActivate()

          submitStep1(container, 'ETS023/15')

          await waitFor(() => {
            const nameElements = within(container).getAllByText(student.name)
            expect(nameElements.length).toBeGreaterThan(0)
          })

          const photo = container.querySelector('img[alt*="profile"]')
          const placeholder = within(container).queryByLabelText(/no photo available/i)
          expect(photo !== null || placeholder !== null).toBe(true)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ── Property 17: UI displays error message on backend error response ──────────
// **Feature: preloaded-student-activation, Property 17: UI displays error message on backend error response**
// **Validates: Requirements 5.5**
describe('Property 17: UI displays error message on backend error response', () => {
  it('displays a non-empty error message for any non-empty error message returned by the backend', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (errorMessage) => {
          cleanup()
          vi.clearAllMocks()
          API.post.mockRejectedValueOnce({
            response: { data: { message: errorMessage } },
          })

          const container = renderActivate()

          submitStep1(container, 'ETS023/15')

          await waitFor(() => {
            const alert = within(container).getByRole('alert')
            expect(alert).toBeInTheDocument()
            expect(alert.textContent.trim().length).toBeGreaterThan(0)
          })
        }
      ),
      { numRuns: 20 }
    )
  })

  it('displays a fallback error message when backend returns no message body', async () => {
    API.post.mockRejectedValueOnce({ response: { data: {} } })

    const container = renderActivate()

    submitStep1(container, 'ETS023/15')

    await waitFor(() => {
      const alert = within(container).getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert.textContent.trim().length).toBeGreaterThan(0)
    })
  })
})

// ── Step flow integration tests ───────────────────────────────────────────────

describe('Activate wizard step flow', () => {
  it('Step 1 sends only student_id (no username) to /auth/activate', async () => {
    API.post.mockResolvedValueOnce({ data: { name: 'Test Student', department: 'CS' } })

    const container = renderActivate()
    submitStep1(container, 'ETS023/15')

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/activate', { student_id: 'ETS023/15' })
    })
  })

  it('advances to Step 3 email input after identity confirmation', async () => {
    API.post.mockResolvedValueOnce({ data: { name: 'Test Student', department: 'CS' } })

    const container = renderActivate()
    submitStep1(container, 'ETS023/15')

    await waitFor(() => within(container).getByText('Test Student'))

    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i)).toBeInTheDocument()
    })
  })

  it('advances to OTP input after successful send-otp', async () => {
    API.post
      .mockResolvedValueOnce({ data: { name: 'Test Student', department: 'CS' } }) // activate
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } }) // send-otp

    const container = renderActivate()
    submitStep1(container, 'ETS023/15')

    await waitFor(() => within(container).getByText('Test Student'))
    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))

    await waitFor(() => within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i))

    fireEvent.change(
      within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i),
      { target: { value: 'test.student@aastustudent.edu.et' } }
    )
    fireEvent.click(within(container).getByRole('button', { name: /send verification code/i }))

    await waitFor(() => {
      expect(within(container).getByPlaceholderText('123456')).toBeInTheDocument()
      expect(within(container).getByRole('button', { name: /resend code/i })).toBeInTheDocument()
    })
  })

  it('advances to Step 4 password creation after successful OTP verification', async () => {
    API.post
      .mockResolvedValueOnce({ data: { name: 'Test Student', department: 'CS' } })
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({ data: { otpToken: 'mock-token-123' } })

    const container = renderActivate()
    submitStep1(container, 'ETS023/15')

    await waitFor(() => within(container).getByText('Test Student'))
    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))

    await waitFor(() => within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i))
    fireEvent.change(
      within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i),
      { target: { value: 'test.student@aastustudent.edu.et' } }
    )
    fireEvent.click(within(container).getByRole('button', { name: /send verification code/i }))

    await waitFor(() => within(container).getByPlaceholderText('123456'))
    fireEvent.change(within(container).getByPlaceholderText('123456'), { target: { value: '123456' } })
    fireEvent.click(within(container).getByRole('button', { name: /^submit$/i }))

    await waitFor(() => {
      expect(within(container).getByText('Set Your Password')).toBeInTheDocument()
      // No email field in Step 4
      expect(within(container).queryByLabelText(/email/i)).not.toBeInTheDocument()
    })
  })

  it('Step 4 shows inline error when passwords do not match without calling API', async () => {
    API.post
      .mockResolvedValueOnce({ data: { name: 'Test Student', department: 'CS' } })
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({ data: { otpToken: 'mock-token-123' } })

    const container = renderActivate()
    submitStep1(container, 'ETS023/15')

    await waitFor(() => within(container).getByText('Test Student'))
    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))

    await waitFor(() => within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i))
    fireEvent.change(
      within(container).getByPlaceholderText(/firstname\.fathername@aastustudent\.edu\.et/i),
      { target: { value: 'test.student@aastustudent.edu.et' } }
    )
    fireEvent.click(within(container).getByRole('button', { name: /send verification code/i }))

    await waitFor(() => within(container).getByPlaceholderText('123456'))
    fireEvent.change(within(container).getByPlaceholderText('123456'), { target: { value: '654321' } })
    fireEvent.click(within(container).getByRole('button', { name: /^submit$/i }))

    await waitFor(() => within(container).getByText('Set Your Password'))

    const passwordInputs = container.querySelectorAll('input[type="password"]')
    fireEvent.change(passwordInputs[0], { target: { value: 'password1' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'password2' } })
    fireEvent.click(within(container).getByRole('button', { name: /activate account/i }))

    await waitFor(() => {
      const alert = within(container).getByRole('alert')
      expect(alert.textContent).toMatch(/passwords do not match/i)
    })

    // set-password API should NOT have been called
    const setPasswordCalls = API.post.mock.calls.filter(c => c[0] === '/auth/set-password')
    expect(setPasswordCalls.length).toBe(0)
  })
})
