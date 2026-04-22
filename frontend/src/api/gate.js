import API from './axios'

/**
 * Look up a laptop or guest pass by 8-digit code or student ID.
 * @param {Object} query - { code?: string, studentId?: string }
 */
export const lookupLaptop = (query) => {
  const params = new URLSearchParams()
  if (query.code) params.append('code', query.code)
  if (query.studentId) params.append('studentId', query.studentId)
  return API.get(`/gate/lookup?${params.toString()}`)
}

/** Verify a PENDING laptop (sets status → VERIFIED). */
export const verifyLaptop = (id) => API.post(`/gate/verify/${id}`)

/** Log an ENTRY event for a VERIFIED laptop. */
export const logEntry = (id) => API.post(`/gate/entry/${id}`)

/** Log an EXIT event for a VERIFIED laptop. */
export const logExit = (id) => API.post(`/gate/exit/${id}`)

/** Block a laptop (sets status → BLOCKED). */
export const blockLaptop = (id) => API.post(`/gate/block/${id}`)

/** Fetch all gate log records ordered by timestamp descending. */
export const fetchLogs = () => API.get('/gate/logs')

// ── Guest API ────────────────────────────────────────────────────────────────

/** Register a new guest pass (no photo required). */
export const registerGuest = (data) => API.post('/guests/register', data)

/** Log a guest ENTRY event. */
export const guestEntry = (id) => API.post(`/guests/entry/${id}`)

/** Log a guest EXIT event. */
export const guestExit = (id) => API.post(`/guests/exit/${id}`)
