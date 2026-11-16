import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../i18n/i18n.js'
import Login from './Login'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

vi.mock('../api/axios', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  }
})

import API from '../api/axios'

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => cleanup())

// ── Structure ─────────────────────────────────────────────────────────────────

describe('Login page structure', () => {
  it('renders the institutional header, hero and login card', () => {
    renderLogin()

    expect(screen.getByText('AASTU Campus Asset & Security Registry')).toBeInTheDocument()
    expect(screen.getByText('Laptop Gate Pass System')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /campus laptop gate pass system/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByText(/sign in to access your campus security portal/i)).toBeInTheDocument()
  })

  it('shows the hero photograph with descriptive alt text', () => {
    const { container } = renderLogin()
    const img = container.querySelector('.login-hero__img')

    expect(img).toBeTruthy()
    expect(img.getAttribute('alt')).toMatch(/student.*laptop.*campus/i)
    expect(img.getAttribute('src')).toContain('/hero/')
  })

  it('keeps the official university logo in the header', () => {
    const { container } = renderLogin()
    expect(container.querySelector('.login-header__logo')).toBeTruthy()
  })

  it('lists the four student onboarding steps', () => {
    renderLogin()
    const steps = within(document.querySelector('.login-guide__grid')).getAllByRole('listitem')

    expect(steps).toHaveLength(4)
    expect(screen.getByText('Activate your account')).toBeInTheDocument()
    expect(screen.getByText('Verify your email')).toBeInTheDocument()
    expect(screen.getByText('Sign in and register your laptop')).toBeInTheDocument()
    expect(screen.getByText('Present your QR code')).toBeInTheDocument()
  })

  it('exposes labelled credential fields and the account-recovery actions', () => {
    renderLogin()

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: /activate your account/i })).toHaveAttribute('href', '/activate')
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('Login page validation', () => {
  it('blocks submission and shows inline errors when both fields are empty', () => {
    renderLogin()
    submit()

    expect(API.post).not.toHaveBeenCalled()
    expect(screen.getByText(/enter your username to continue/i)).toBeInTheDocument()
    expect(screen.getByText(/enter your password to continue/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears a field error once the field is edited', () => {
    renderLogin()
    submit()
    expect(screen.getByText(/enter your username to continue/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ETS02315/14' } })

    expect(screen.queryByText(/enter your username to continue/i)).not.toBeInTheDocument()
  })
})

// ── Password visibility ───────────────────────────────────────────────────────

describe('Password visibility toggle', () => {
  it('switches the password input type and reports its state', () => {
    renderLogin()
    const input = screen.getByLabelText('Password')
    const toggle = screen.getByRole('button', { name: /show password/i })

    expect(input).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })
})

// ── Authentication flow (unchanged endpoints / routing) ───────────────────────

describe('Login authentication', () => {
  const fillCredentials = () => {
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ETS02315/14' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
  }

  it.each([
    ['STUDENT', '/student'],
    ['GUARD', '/guard'],
    ['ADMIN', '/admin'],
  ])('sends credentials to /auth/login and routes %s users to %s', async (role, path) => {
    API.post.mockResolvedValueOnce({ data: { user: { id: 'u1', role }, token: 'jwt-abc' } })

    renderLogin()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/login', {
        username: 'ETS02315/14',
        password: 'secret123',
      })
    })
    expect(mockLogin).toHaveBeenCalledWith({ id: 'u1', role }, 'jwt-abc')
    expect(mockNavigate).toHaveBeenCalledWith(path)
  })

  it('surfaces the server error message and keeps the user on the form', async () => {
    API.post.mockRejectedValueOnce({ response: { data: { message: 'Invalid credentials' } } })

    renderLogin()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    })
    expect(mockLogin).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when the server returns no body', async () => {
    API.post.mockRejectedValueOnce({ response: { data: {} } })

    renderLogin()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i)
    })
  })

  it('disables the submit button and shows progress while authenticating', async () => {
    let resolveLogin
    API.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve
      })
    )

    renderLogin()
    fillCredentials()
    submit()

    const button = await screen.findByRole('button', { name: /signing in/i })
    expect(button).toBeDisabled()

    resolveLogin({ data: { user: { id: 'u1', role: 'ADMIN' }, token: 'jwt-abc' } })

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'))
  })
})

// ── Language switching ────────────────────────────────────────────────────────

describe('Language switcher', () => {
  it('marks the active language and re-renders copy when switched', async () => {
    await i18n.changeLanguage('en')
    renderLogin()

    const en = screen.getByRole('button', { name: 'EN' })
    const am = screen.getByRole('button', { name: 'አማ' })
    expect(en).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(am)

    await waitFor(() => {
      expect(am).toHaveAttribute('aria-pressed', 'true')
      expect(en).toHaveAttribute('aria-pressed', 'false')
    })

    // Restore for other tests
    await i18n.changeLanguage('en')
  })
})
