import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GuardDashboard from './GuardDashboard'

// ── Mock AuthContext ──────────────────────────────────────────────────────────
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Guard One', role: 'GUARD' }, logout: vi.fn() }),
}))

// ── Mock gate API ─────────────────────────────────────────────────────────────
vi.mock('../api/gate', () => ({
  lookupLaptop: vi.fn(),
  verifyLaptop: vi.fn(),
  logEntry: vi.fn(),
  logExit: vi.fn(),
  blockLaptop: vi.fn(),
  fetchLogs: vi.fn().mockResolvedValue({ data: [] }),
  registerGuest: vi.fn(),
  guestEntry: vi.fn(),
  guestExit: vi.fn(),
}))

import * as gateApi from '../api/gate'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <GuardDashboard />
    </MemoryRouter>
  )
}

// Helper: build a mock laptop object
function makeLaptop(status = 'PENDING', isInCampus = false) {
  return {
    type: 'laptop',
    id: 'laptop-1',
    serial_number: 'SN-001',
    brand: 'Dell',
    model: 'Latitude',
    qr_code: '12345678',
    is_in_campus: isInCampus,
    photo_url: null,
    verification_status: status,
    verified_at: null,
    verified_by_name: null,
    owner_name: 'Abebe Kebede',
    student_id: 'ETS0001/14',
  }
}

describe('GuardDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gateApi.fetchLogs.mockResolvedValue({ data: [] })
  })

  // ── Requirement 3.1 ──────────────────────────────────────────────────────
  it('renders search input on mount', () => {
    renderDashboard()
    expect(screen.getByPlaceholderText(/e\.g\. 48271935/i)).toBeInTheDocument()
  })

  it('renders Scan QR button on mount', () => {
    renderDashboard()
    expect(screen.getByText(/scan qr/i)).toBeInTheDocument()
  })

  // ── Requirement 3.6 ──────────────────────────────────────────────────────
  it('shows error message when lookup returns 404', async () => {
    gateApi.lookupLaptop.mockRejectedValue({
      response: { data: { message: 'No laptop found' } },
    })
    renderDashboard()
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 48271935/i), {
      target: { value: '99999999' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    await waitFor(() =>
      expect(screen.getByText(/no laptop found/i)).toBeInTheDocument()
    )
  })

  // ── Requirement 3.3 — PENDING status ─────────────────────────────────────
  it('shows Verify Laptop button and no entry/exit buttons when status is PENDING', async () => {
    gateApi.lookupLaptop.mockResolvedValue({ data: makeLaptop('PENDING') })
    renderDashboard()
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 48271935/i), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    await waitFor(() => screen.getByText(/verify laptop/i))

    expect(screen.getByText(/verify laptop/i)).toBeInTheDocument()
    expect(screen.queryByText(/allow entry/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/allow exit/i)).not.toBeInTheDocument()
  })

  // ── Requirement 3.4 — VERIFIED status ────────────────────────────────────
  it('shows Allow Entry and Allow Exit buttons when status is VERIFIED', async () => {
    gateApi.lookupLaptop.mockResolvedValue({ data: makeLaptop('VERIFIED') })
    renderDashboard()
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 48271935/i), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    await waitFor(() => screen.getByText(/allow entry/i))

    expect(screen.getByText(/allow entry/i)).toBeInTheDocument()
    expect(screen.getByText(/allow exit/i)).toBeInTheDocument()
    expect(screen.queryByText(/verify laptop/i)).not.toBeInTheDocument()
  })

  // ── Requirement 3.5 — BLOCKED status ─────────────────────────────────────
  it('shows blocked alert and no action buttons when status is BLOCKED', async () => {
    gateApi.lookupLaptop.mockResolvedValue({ data: makeLaptop('BLOCKED') })
    renderDashboard()
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 48271935/i), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    await waitFor(() => screen.getByText(/this laptop is blocked/i))

    expect(screen.getByText(/this laptop is blocked/i)).toBeInTheDocument()
    expect(screen.queryByText(/verify laptop/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/allow entry/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/allow exit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/block laptop/i)).not.toBeInTheDocument()
  })

  // ── Requirement 3.2 — laptop details rendered ─────────────────────────────
  it('renders laptop details after successful lookup', async () => {
    gateApi.lookupLaptop.mockResolvedValue({ data: makeLaptop('VERIFIED') })
    renderDashboard()
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 48271935/i), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    await waitFor(() => screen.getByText('Abebe Kebede'))

    expect(screen.getByText('Abebe Kebede')).toBeInTheDocument()
    expect(screen.getByText('ETS0001/14')).toBeInTheDocument()
    expect(screen.getByText('Dell')).toBeInTheDocument()
    expect(screen.getByText('Latitude')).toBeInTheDocument()
    expect(screen.getByText('SN-001')).toBeInTheDocument()
  })
})
