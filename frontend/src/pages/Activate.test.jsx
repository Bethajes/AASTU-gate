import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import Activate from './Activate'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLogin = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../components/AASTULogo', () => ({
  default: () => <div data-testid="logo" />,
}))

vi.mock('../components/AuthPageLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

import API from '../api/axios'

const STUDENT_ID = 'ETS023/15'
const EMAIL = 'test.student@aastustudent.edu.et'
const ID_PLACEHOLDER = /e\.g\. ETS023\/15/i
const EMAIL_PLACEHOLDER = /firstname\.fathername@aastustudent\(s\)\.edu\.et/i

function renderActivate() {
  return render(
    <MemoryRouter>
      <Activate />
    </MemoryRouter>
  ).container
}

// Step 1: student ID + institutional email -> POST /auth/send-otp
// The submit button stays disabled until the debounced availability probe settles.
async function submitStep1(container) {
  const view = within(container)
  fireEvent.change(view.getByPlaceholderText(ID_PLACEHOLDER), {
    target: { value: STUDENT_ID },
  })
  fireEvent.change(view.getByPlaceholderText(EMAIL_PLACEHOLDER), {
    target: { value: EMAIL },
  })
  await waitFor(() => expect(API.get).toHaveBeenCalledWith('/auth/check-email', {
    params: { email: EMAIL },
  }))
  await waitFor(() =>
    expect(view.getByRole('button', { name: /send verification code/i })).not.toBeDisabled()
  )
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: /send verification code/i }))
  })
}

// Step 2: OTP -> POST /auth/verify-otp -> student identity
async function submitOtp(container, code = '123456') {
  const view = within(container)
  await waitFor(() => view.getByPlaceholderText('123456'))
  fireEvent.change(view.getByPlaceholderText('123456'), { target: { value: code } })
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: /^submit$/i }))
  })
}

const verifyOtpResponse = {
  otpToken: 'mock-token-123',
  name: 'Test Student',
  department: 'CS',
  username: 'ETS02315',
  photo: null,
}

// Testing Library collapses runs of whitespace when matching element text, so
// the expected string has to be normalized the same way.
const normalizeText = (s) => s.replace(/\s+/g, ' ').trim()

beforeEach(() => {
  vi.clearAllMocks()
  // The email-availability probe gates the submit button; report the
  // institutional address as available.
  API.get.mockResolvedValue({ data: { available: true } })
})

afterEach(() => cleanup())

// ── Property 16: UI displays student identity after successful OTP verification ─
// **Feature: preloaded-student-activation, Property 16: UI displays student identity after successful OTP verification**
// **Validates: Requirements 5.2**
describe('Property 16: UI displays student identity after successful OTP verification', () => {
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
          API.get.mockResolvedValue({ data: { available: true } })
          API.post
            .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
            .mockResolvedValueOnce({ data: { ...verifyOtpResponse, ...student } })

          const container = renderActivate()

          await submitStep1(container)
          await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/send-otp', {
            student_id: STUDENT_ID,
            email: EMAIL,
          }))

          submitOtp(container)

          await waitFor(() => {
            const nameElements = within(container).getAllByText(normalizeText(student.name))
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
          API.get.mockResolvedValue({ data: { available: true } })
          API.post.mockRejectedValueOnce({
            response: { data: { message: errorMessage } },
          })

          const container = renderActivate()

          await submitStep1(container)

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

    await submitStep1(container)

    await waitFor(() => {
      const alert = within(container).getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert.textContent.trim().length).toBeGreaterThan(0)
    })
  })
})

// ── Step flow integration tests ───────────────────────────────────────────────

describe('Activate wizard step flow', () => {
  it('Step 1 sends student_id and email to /auth/send-otp', async () => {
    API.post.mockResolvedValueOnce({ data: { message: 'OTP sent' } })

    const container = renderActivate()
    await submitStep1(container)

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/send-otp', {
        student_id: STUDENT_ID,
        email: EMAIL,
      })
    })
  })

  it('advances to Step 2 OTP input after the code is sent', async () => {
    API.post.mockResolvedValueOnce({ data: { message: 'OTP sent' } })

    const container = renderActivate()
    await submitStep1(container)

    await waitFor(() => {
      expect(within(container).getByPlaceholderText('123456')).toBeInTheDocument()
      // Label flips between "Resend Code" and "Resend in Ns" while cooling down.
      expect(within(container).getByRole('button', { name: /resend/i })).toBeInTheDocument()
    })
  })

  it('advances to Step 3 identity confirmation after successful OTP verification', async () => {
    API.post
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({ data: verifyOtpResponse })

    const container = renderActivate()
    await submitStep1(container)
    submitOtp(container)

    await waitFor(() => {
      expect(within(container).getByText('Test Student')).toBeInTheDocument()
      expect(within(container).getByText('Confirm Your Identity')).toBeInTheDocument()
    })
    expect(API.post).toHaveBeenCalledWith('/auth/verify-otp', {
      student_id: STUDENT_ID,
      code: '123456',
    })
  })

  it('advances to Step 4 password creation after confirming identity', async () => {
    API.post
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({ data: verifyOtpResponse })

    const container = renderActivate()
    await submitStep1(container)
    submitOtp(container)

    await waitFor(() => within(container).getByRole('button', { name: /confirm/i }))
    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))


    await waitFor(() => {
      expect(within(container).getByText('Set Your Password')).toBeInTheDocument()
      // No email field in Step 4
      expect(within(container).queryByPlaceholderText(EMAIL_PLACEHOLDER)).not.toBeInTheDocument()
    })
  })

  it('Step 4 shows inline error when passwords do not match without calling API', async () => {
    API.post
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({ data: verifyOtpResponse })

    const container = renderActivate()
    await submitStep1(container)
    submitOtp(container)

    await waitFor(() => within(container).getByRole('button', { name: /confirm/i }))
    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))


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

  it('sets the password and logs in when both passwords match', async () => {
    API.post
      .mockResolvedValueOnce({ data: { message: 'OTP sent' } })
      .mockResolvedValueOnce({ data: verifyOtpResponse })
      .mockResolvedValueOnce({ data: { message: 'Password set' } })
      .mockResolvedValueOnce({ data: { user: { id: 'u1', role: 'STUDENT' }, token: 'jwt-123' } })

    const container = renderActivate()
    await submitStep1(container)
    submitOtp(container)

    await waitFor(() => within(container).getByRole('button', { name: /confirm/i }))
    fireEvent.click(within(container).getByRole('button', { name: /confirm/i }))


    await waitFor(() => within(container).getByText('Set Your Password'))

    const passwordInputs = container.querySelectorAll('input[type="password"]')
    fireEvent.change(passwordInputs[0], { target: { value: 'password1' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'password1' } })
    fireEvent.click(within(container).getByRole('button', { name: /activate account/i }))

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/set-password', {
        student_id: STUDENT_ID,
        otpToken: 'mock-token-123',
        password: 'password1',
      })
      expect(API.post).toHaveBeenCalledWith('/auth/login', {
        username: 'ETS02315',
        password: 'password1',
      })
    })
    expect(mockLogin).toHaveBeenCalledWith({ id: 'u1', role: 'STUDENT' }, 'jwt-123')
  })
})
