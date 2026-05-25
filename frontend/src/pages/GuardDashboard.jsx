import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AASTUFooter from '../components/AASTUFooter'
import { buildPhotoUrl } from '../utils/photoUrl'
import API from '../api/axios'
import {
  lookupLaptop,
  verifyLaptop,
  logEntry,
  logExit,
  blockLaptop,
  fetchLogs,
  registerGuest,
  guestEntry,
  guestExit,
} from '../api/gate'

const BASE_URL = 'http://localhost:5001'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusStyle(status) {
  switch (status) {
    case 'VERIFIED': return { backgroundColor: '#e6ffed', color: '#2e7d32' }
    case 'BLOCKED':  return { backgroundColor: '#ffebee', color: '#c62828' }
    default:         return { backgroundColor: '#fff3e0', color: '#e65100' }
  }
}

function statusLabel(status) {
  switch (status) {
    case 'VERIFIED': return '✅ VERIFIED'
    case 'BLOCKED':  return '🚫 BLOCKED'
    default:         return '⏳ PENDING'
  }
}

function securityStatusStyle(status) {
  switch (status) {
    case 'STOLEN': return { backgroundColor: '#ffebee', color: '#b71c1c', border: '1.5px solid #ef9a9a' }
    case 'LOST':   return { backgroundColor: '#fff8e1', color: '#8a5a00', border: '1.5px solid #FFD700' }
    default:       return { backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1.5px solid #a5d6a7' }
  }
}

function securityStatusLabel(status) {
  switch (status) {
    case 'STOLEN': return '🚨 STOLEN'
    case 'LOST':   return '⚠️ LOST'
    default:       return '✅ ACTIVE'
  }
}

// ─── QR Scanner ──────────────────────────────────────────────────────────────

function QRScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [camError, setCamError] = useState(null)

  const tick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (window.jsQR) {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height)
      if (code && /^\d{8}$/.test(code.data)) {
        onDetected(code.data)
        return
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [onDetected])

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        rafRef.current = requestAnimationFrame(tick)
      })
      .catch(() => setCamError('Camera access denied. Please use manual entry.'))
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [tick])

  if (camError) {
    return (
      <div style={styles.camError}>
        <p>{camError}</p>
        <button style={styles.btnSecondary} onClick={onClose}>Close Scanner</button>
      </div>
    )
  }

  return (
    <div style={styles.scannerWrap}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} style={styles.video} playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button style={styles.btnSecondary} onClick={onClose}>Stop Scanner</button>
    </div>
  )
}

// ─── Guest Registration Form ──────────────────────────────────────────────────

const GUEST_FIELDS = [
  { key: 'guestName',    label: 'Full Name',          placeholder: 'e.g. John Doe' },
  { key: 'phone',        label: 'Phone Number',        placeholder: 'e.g. +251911234567' },
  { key: 'purpose',      label: 'Purpose of Visit',    placeholder: 'e.g. Meeting with faculty' },
  { key: 'deviceBrand',  label: 'Device Brand',        placeholder: 'e.g. Dell' },
  { key: 'deviceModel',  label: 'Device Model',        placeholder: 'e.g. Latitude 5520' },
  { key: 'serialNumber', label: 'Device Serial Number',placeholder: 'e.g. SN-DELL-001' },
]

function GuestRegistrationForm({ onSuccess }) {
  const [form, setForm] = useState({ guestName: '', phone: '', purpose: '', deviceBrand: '', deviceModel: '', serialNumber: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await registerGuest(form)
      setResult(res.data.guestPass)
      setForm({ guestName: '', phone: '', purpose: '', deviceBrand: '', deviceModel: '', serialNumber: '' })
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error  && <div style={styles.errorBox}>{error}</div>}

      {result && (
        <div style={styles.guestCodeBox}>
          <div style={styles.guestCodeLabel}>✅ Guest registered! Hand this code to the guest:</div>
          <div style={styles.guestCodeNumber}>{result.guestCode}</div>
          <div style={styles.guestCodeHint}>Guard can type this 8-digit code to log entry/exit</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {GUEST_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} style={styles.field}>
            <label style={styles.label}>{label}</label>
            <input
              style={styles.input}
              placeholder={placeholder}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              required
            />
          </div>
        ))}
        <button style={styles.btnPrimary} type="submit" disabled={loading}>
          {loading ? 'Registering…' : 'Register Guest'}
        </button>
      </form>
    </div>
  )
}

// ─── Guest Card ───────────────────────────────────────────────────────────────

function GuestCard({ guest, onRefresh }) {
  const [actionLoading, setActionLoading] = useState(null)
  const [actionMsg, setActionMsg] = useState('')
  const [actionError, setActionError] = useState('')

  const doAction = async (type, apiFn) => {
    setActionLoading(type)
    setActionMsg('')
    setActionError('')
    try {
      await apiFn(guest.id)
      setActionMsg(`${type} successful`)
      onRefresh?.()
    } catch (err) {
      setActionError(err.response?.data?.message || `${type} failed`)
    } finally {
      setActionLoading(null)
    }
  }

  const status = guest.verification_status

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>👤 Guest Details</h2>

      {actionMsg   && <div style={styles.successBox}>{actionMsg}</div>}
      {actionError && <div style={styles.errorBox}>{actionError}</div>}

      {status === 'BLOCKED' && (
        <div style={styles.blockedAlert}>🚫 This guest pass is BLOCKED. No entry or exit is permitted.</div>
      )}

      <div style={styles.details}>
        <Row label="Guest Name"    value={guest.guest_name} />
        <Row label="Phone"         value={guest.phone} />
        <Row label="Purpose"       value={guest.purpose} />
        <Row label="Device Brand"  value={guest.device_brand} />
        <Row label="Device Model"  value={guest.device_model} />
        <Row label="Serial Number" value={guest.serial_number} />
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Status</span>
          <span style={{ ...styles.badge, ...statusStyle(status) }}>{statusLabel(status)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Campus</span>
          <span style={{
            ...styles.badge,
            backgroundColor: guest.is_in_campus ? '#e6ffed' : '#fff0f0',
            color: guest.is_in_campus ? '#2e7d32' : '#c62828',
          }}>
            {guest.is_in_campus ? '✅ On Campus' : '🏠 Off Campus'}
          </span>
        </div>
      </div>

      <div style={styles.actions}>
        {status === 'VERIFIED' && (
          <>
            <button style={{ ...styles.btnAction, ...styles.btnEntry }}
              onClick={() => doAction('entry', guestEntry)} disabled={!!actionLoading}>
              {actionLoading === 'entry' ? 'Logging…' : '🔵 Allow Entry'}
            </button>
            <button style={{ ...styles.btnAction, ...styles.btnExit }}
              onClick={() => doAction('exit', guestExit)} disabled={!!actionLoading}>
              {actionLoading === 'exit' ? 'Logging…' : '🟡 Allow Exit'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Guard Register Laptop Form ───────────────────────────────────────────────


function GuardRegisterLaptopForm() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    studentId: '',
    serialNumber: '',
    brand: '',
    model: ''
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(null)

  const validate = () => {
    const e = {}
    if (!form.name.trim())         e.name         = 'Name is required'
    if (!form.phone.trim())        e.phone        = 'Phone number is required'
    if (!form.studentId.trim())    e.studentId    = 'Student ID is required'
    if (!form.serialNumber.trim()) e.serialNumber = 'Serial number is required'
    if (!form.brand.trim())        e.brand        = 'Brand is required'
    if (!form.model.trim())        e.model        = 'Model is required'
    return e
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    setSuccess(null)
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('name',         form.name.trim())
      fd.append('phone',        form.phone.trim())
      fd.append('studentId',    form.studentId.trim())
      fd.append('serialNumber', form.serialNumber.trim())
      fd.append('brand',        form.brand.trim())
      fd.append('model',        form.model.trim())
      const token = localStorage.getItem('token')
      const res = await API.post('/laptops/guard-register', fd, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          'Content-Type': undefined,
        },
      })
      setSuccess(res.data)
      setForm({ name: '', phone: '', studentId: '', serialNumber: '', brand: '', model: '' })
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const fields = [
    { name: 'name',         label: 'Name',         placeholder: 'e.g. John Doe' },
    { name: 'phone',        label: 'Phone Number', placeholder: 'e.g. 0912345678' },
    { name: 'studentId',    label: 'Student ID',    placeholder: 'e.g. ETS0123/14' },
    { name: 'serialNumber', label: 'Serial Number', placeholder: 'e.g. SN123456' },
    { name: 'brand',        label: 'Brand',         placeholder: 'e.g. Dell' },
    { name: 'model',        label: 'Model',         placeholder: 'e.g. XPS 15' },
  ]

  return (
    <div>
      {apiError && <div style={styles.errorBox}>{apiError}</div>}
      {success && (
        <div style={styles.successBox}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Laptop registered successfully!</div>
          <div style={{ fontSize: 13 }}>
            {success.laptop.brand} {success.laptop.model} — <span style={{ fontFamily: 'monospace' }}>{success.laptop.serial_number}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            QR Code: <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 }}>{success.qrCodeNumber}</span>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        {fields.map(({ name, label, placeholder }) => (
          <div key={name} style={styles.field}>
            <label style={styles.label}>{label} *</label>
            <input
              name={name}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              style={{ ...styles.input, ...(errors[name] ? { borderColor: '#c62828' } : {}) }}
            />
            {errors[name] && <span style={{ fontSize: 12, color: '#c62828', marginTop: 4, display: 'block' }}>{errors[name]}</span>}
          </div>
        ))}
        <button style={styles.btnPrimary} type="submit" disabled={submitting}>
          {submitting ? 'Registering…' : '💻 Register Laptop'}
        </button>
      </form>
    </div>
  )
}

// ─── Block Reason Modal ───────────────────────────────────────────────────────

function BlockReasonModal({ laptop, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reason.trim()) { setError('Please provide a reason for blocking.'); return }
    onConfirm(reason.trim())
  }

  return (
    <div style={blockModalStyles.overlay} role="dialog" aria-modal="true">
      <div style={blockModalStyles.box}>
        <h3 style={blockModalStyles.title}>🚫 Block Laptop</h3>
        <p style={blockModalStyles.sub}>
          {laptop?.brand} {laptop?.model} — <span style={{ fontFamily: 'monospace' }}>{laptop?.serial_number}</span>
        </p>
        <form onSubmit={handleSubmit}>
          <label style={blockModalStyles.label}>Reason for blocking *</label>
          <textarea
            style={blockModalStyles.textarea}
            placeholder="e.g. Suspected stolen device, owner could not verify identity…"
            value={reason}
            onChange={e => { setReason(e.target.value); setError('') }}
            rows={3}
            autoFocus
          />
          {error && <p style={blockModalStyles.error}>{error}</p>}
          <div style={blockModalStyles.actions}>
            <button type="button" style={blockModalStyles.cancelBtn} onClick={onCancel}>Cancel</button>
            <button type="submit" style={blockModalStyles.confirmBtn}>Confirm Block</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const blockModalStyles = {
  overlay:    { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 },
  box:        { backgroundColor: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 440, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  title:      { margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#c62828' },
  sub:        { margin: '0 0 20px', fontSize: 13, color: '#555' },
  label:      { display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#333' },
  textarea:   { width: '100%', padding: '10px 14px', borderRadius: 10, border: '2px solid #e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' },
  error:      { margin: '6px 0 0', fontSize: 12, color: '#c62828' },
  actions:    { display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' },
  cancelBtn:  { padding: '9px 20px', borderRadius: 8, border: '1.5px solid #ddd', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  confirmBtn: { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#c62828', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuardDashboard() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const { logout: authLogout } = useAuth()
  const [activeTab, setActiveTab] = useState('scan')
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState('code')
  const [record, setRecord] = useState(null)
  const [guestList, setGuestList] = useState([])
  const [lookupError, setLookupError] = useState('')
  const [searching, setSearching] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [logs, setLogs] = useState([])
  const [showScanner, setShowScanner] = useState(false)
  const [blockReasonModal, setBlockReasonModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [languageMenu, setLanguageMenu] = useState(false)
  const [currentLang, setCurrentLang] = useState(i18n.language?.startsWith('am') ? 'am' : 'en')
  const [liveTime, setLiveTime] = useState(new Date())
  const [notifications, setNotifications] = useState(3)
  const [tableFilter, setTableFilter] = useState('all')
  const [sortKey, setSortKey] = useState('time')
  const [sortDirection, setSortDirection] = useState('desc')
  const [tablePage, setTablePage] = useState(1)
  const [pulseActive, setPulseActive] = useState(false)
  const logsRef = useRef([])

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setCurrentLang(i18n.language?.startsWith('am') ? 'am' : 'en')
  }, [i18n.language])

  useEffect(() => { loadLogs() }, [])

  const handleLogout = () => {
    authLogout()
    navigate('/login')
  }

  const loadLogs = async () => {
    try {
      const res = await fetchLogs()
      const fetched = Array.isArray(res.data) ? res.data : []
      const isNew = fetched.length > logsRef.current.length || (fetched[0]?.id !== logsRef.current[0]?.id && fetched.length > 0)
      if (isNew) {
        setPulseActive(true)
        window.setTimeout(() => setPulseActive(false), 1800)
      }
      logsRef.current = fetched
      setLogs(fetched)
      setNotifications(fetched.filter((log) => log.action === 'DENIED').length || fetched.length)
    } catch { /* non-critical */ }
  }

  const actionItems = [
    { id: 'scan', icon: '🔍', label: 'Lookup', tooltip: 'Scan or lookup records' },
    { id: 'register', icon: '👤', label: 'Guest Pass', tooltip: 'Register a guest' },
    { id: 'registerLaptop', icon: '💻', label: 'Register a laptop' },
  ]

  const filterButtons = [
    { id: 'all', label: 'All' },
    { id: 'entry', label: 'Entry' },
    { id: 'exit', label: 'Exit' },
    { id: 'guest', label: 'Guest' },
    { id: 'laptop', label: 'Laptop' },
    { id: 'today', label: 'Today' },
  ]

  const searchValidation = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return { valid: false, label: 'Enter a query' }
    if (searchType === 'code') {
      const valid = /^\d{8}$/.test(trimmed)
      return { valid, label: valid ? 'Valid 8-digit code' : 'Code must be 8 digits' }
    }
    if (searchType === 'studentId') {
      const valid = trimmed.length >= 5
      return { valid, label: valid ? 'Looks good' : 'Use at least 5 characters' }
    }
    return { valid: trimmed.length >= 3, label: trimmed.length >= 3 ? 'Ready to search' : 'Type 3 or more letters' }
  }, [query, searchType])

  const sortedLogs = useMemo(() => {
    const filtered = logs.filter((log) => {
      if (tableFilter === 'entry') return log.action === 'ENTRY'
      if (tableFilter === 'exit') return log.action === 'EXIT'
      if (tableFilter === 'guest') return log.type === 'guest'
      if (tableFilter === 'laptop') return log.type !== 'guest'
      if (tableFilter === 'today') {
        const today = new Date().toDateString()
        return new Date(log.scanned_at).toDateString() === today
      }
      return true
    })
    return filtered.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      if (sortKey === 'guard') {
        return direction * (a.scanned_by_name || '').localeCompare(b.scanned_by_name || '')
      }
      if (sortKey === 'owner') {
        const nameA = a.type === 'guest' ? a.guest_name : a.owner_name
        const nameB = b.type === 'guest' ? b.guest_name : b.owner_name
        return direction * (nameA || '').localeCompare(nameB || '')
      }
      return direction * (new Date(a.scanned_at) - new Date(b.scanned_at))
    })
  }, [logs, sortKey, sortDirection, tableFilter])

  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(sortedLogs.length / pageSize))
  const displayedLogs = useMemo(() => sortedLogs.slice((tablePage - 1) * pageSize, tablePage * pageSize), [sortedLogs, tablePage])

  const formatActivityTime = (value) => new Date(value).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short' })

  const handleSearch = async (e) => {
    e?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setSearching(true)
    setLookupError('')
    setRecord(null)
    setGuestList([])
    setActionMsg('')
    setActionError('')
    try {
      let param
      if (searchType === 'code') param = { code: trimmed }
      else if (searchType === 'studentId') param = { studentId: trimmed }
      else param = { guestName: trimmed }

      const res = await lookupLaptop(param)

      if (res.data.type === 'guestList') {
        if (res.data.results.length === 0) {
          setLookupError('No guests found with that name')
        } else {
          setGuestList(res.data.results)
        }
      } else {
        setRecord(res.data)
      }
    } catch (err) {
      setLookupError(err.response?.data?.message || 'No record found')
    } finally {
      setSearching(false)
    }
  }

  const handleQRDetected = (code) => {
    setShowScanner(false)
    setSearchType('code')
    setQuery(code)
    setSearching(true)
    setLookupError('')
    setRecord(null)
    lookupLaptop({ code })
      .then((res) => setRecord(res.data))
      .catch((err) => setLookupError(err.response?.data?.message || 'No record found'))
      .finally(() => setSearching(false))
  }

  const doLaptopAction = async (type, apiFn, reason) => {
    if (!record) return
    setActionLoading(type)
    setActionMsg('')
    setActionError('')
    try {
      await apiFn(record.id, reason)
      const param = record.qr_code ? { code: record.qr_code } : { studentId: record.student_id }
      const res = await lookupLaptop(param)
      setRecord(res.data)
      setActionMsg(`${type.charAt(0).toUpperCase() + type.slice(1)} successful`)
      loadLogs()
    } catch (err) {
      setActionError(err.response?.data?.message || `${type} failed`)
    } finally {
      setActionLoading(null)
    }
  }

  const refreshRecord = async () => {
    if (!record) return
    try {
      const param = record.type === 'guest'
        ? { code: record.guest_code }
        : record.qr_code ? { code: record.qr_code } : { studentId: record.student_id }
      const res = await lookupLaptop(param)
      setRecord(res.data)
      loadLogs()
    } catch { /* ignore */ }
  }

  const status = record?.verification_status
  const securityStatus = record?.security_status || 'ACTIVE'

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes scan-line {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { transform: translateX(100%); opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }

        .guard-mobile-toggle { display: none; }
        @media (max-width: 960px) {
          .guard-mobile-toggle { display: inline-flex; }
          .guard-sidebar { position: fixed; top: 110px; left: 12px; z-index: 95; }
          .guard-sidebar + .guard-main-content { margin-left: 0 !important; }
        }
      `}</style>
      <div style={styles.pageHeader}>
        <div>
          <div style={styles.brandLabel}>AASTU ICT Campus Security</div>
          <div style={styles.pageHeadline}>Guard Operations Center</div>
          <div style={styles.pageDetail}>Scan devices, verify guests, and monitor campus entry activity in real time.</div>
        </div>

        <div style={styles.headerActions}>
          <button className="guard-mobile-toggle" style={styles.mobileSidebarToggle} onClick={() => setSidebarOpen((open) => !open)}>
            ☰
          </button>
          <div style={styles.clockPill}>
            <span>{liveTime.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <strong>{liveTime.toLocaleTimeString('en-GB')}</strong>
          </div>
          <button style={styles.notificationBtn} aria-label="Notifications">
            <span style={styles.bellIcon}>🔔</span>
            <span style={styles.notificationBadge}>{notifications}</span>
          </button>
          <div style={styles.langMenu}>
            <button type="button" style={styles.langBtn} onClick={() => setLanguageMenu((v) => !v)}>
              {currentLang === 'am' ? '🇪🇹 አማ' : '🇬🇧 EN'} ▾
            </button>
            {languageMenu && (
              <div style={styles.langDropdown}>
                <button type="button" style={styles.langOption} onClick={() => { setLanguageMenu(false); i18n.changeLanguage('en') }}>🇬🇧 English</button>
                <button type="button" style={styles.langOption} onClick={() => { setLanguageMenu(false); i18n.changeLanguage('am') }}>🇪🇹 አማርኛ</button>
              </div>
            )}
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout} aria-label="Logout">
            🚪 Sign Out
          </button>
        </div>
      </div>

      <div style={styles.main}>
        <aside className="guard-sidebar" style={{ ...styles.sidebar, ...(sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed) }}>
          <div style={styles.sidebarBrand}>Actions</div>
          <nav style={styles.sidebarNav}>
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.tooltip}
                style={{
                  ...styles.sidebarButton,
                  ...(activeTab === item.id ? styles.sidebarButtonActive : {}),
                }}
                onClick={() => setActiveTab(item.id)}
              >
                <span style={styles.sidebarIcon}>{item.icon}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div style={styles.content}>
          <div style={styles.workspaceGrid}>
            <div style={styles.workspaceCard}>
              <h2 style={styles.workspaceTitle}>Lookup & Verification</h2>
              <p style={styles.workspaceCopy}>Switch search mode, scan a QR code, or 검색 guest and student details with instant validation.</p>
            </div>
            <div style={styles.workspaceCardAccent}>
              <div style={styles.workspaceStatLabel}>Live Activity</div>
              <div style={styles.workspaceStatValue}>{logs.length}</div>
              <div style={styles.workspaceSmall}>Recent records tracked in the last refresh.</div>
            </div>
          </div>

          {(activeTab === 'register' || activeTab === 'registerLaptop') && (
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <div>
                  <h2 style={styles.cardTitle}>{activeTab === 'register' ? 'Guest Pass Registration' : 'Guard Laptop Registration'}</h2>
                  <div style={styles.cardSubTitle}>
                    {activeTab === 'register'
                      ? 'Create a guest pass for campus entry.'
                      : 'Register a laptop under guard supervision.'}
                  </div>
                </div>
              </div>
              {activeTab === 'register' ? (
                <GuestRegistrationForm onSuccess={() => { setActionMsg('Guest registered successfully'); setLookupError(''); loadLogs() }} />
              ) : (
                <GuardRegisterLaptopForm />
              )}
            </div>
          )}

          {activeTab === 'scan' && (
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <div>
                  <h2 style={styles.cardTitle}>Laptop / Guest Lookup</h2>
                  <div style={styles.cardSubTitle}>Fast lookup across guests, student IDs, and QR codes.</div>
                </div>
                <div style={styles.statusPillRow}>
                  <span style={styles.pulseLabel}>{pulseActive ? 'Live Pulse Active' : 'Dashboard Ready'}</span>
                </div>
              </div>

              <form onSubmit={handleSearch} style={styles.searchForm}>
                <div style={styles.toggleGroup}>
                  {[
                    { id: 'code', label: '8-Digit Code' },
                    { id: 'studentId', label: 'Student ID' },
                    { id: 'guestName', label: 'Guest Name' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setSearchType(id); setGuestList([]); setRecord(null); setLookupError('') }}
                      style={{
                        ...styles.toggleButton,
                        ...(searchType === id ? styles.toggleButtonActive : {}),
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div style={styles.searchRow}>
                  <div style={styles.searchFieldWrapper}>
                    <input
                      style={styles.searchInput}
                      placeholder={
                        searchType === 'code' ? 'e.g. 48271935'
                          : searchType === 'studentId' ? 'e.g. ETS0123/14'
                          : 'e.g. John Doe'
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                    />
                    <span style={{
                      ...styles.validationBadge,
                      backgroundColor: searchValidation.valid ? '#d1fae5' : '#fff1f2',
                      color: searchValidation.valid ? '#166534' : '#b91c1c',
                    }}>
                      {searchValidation.valid ? '✔' : '✕'} {searchValidation.label}
                    </span>
                  </div>

                  <div style={styles.actionButtonGroup}>
                    <button style={styles.btnPrimary} type="submit" disabled={searching}>
                      {searching ? 'Searching…' : 'Search'}
                    </button>
                    {searchType !== 'guestName' && (
                      <button type="button" style={styles.btnQR} onClick={() => setShowScanner((v) => !v)}>
                        <span style={styles.scanLine} />
                        📷 Scan QR
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {showScanner && (
                <QRScanner onDetected={handleQRDetected} onClose={() => setShowScanner(false)} />
              )}

              {lookupError && <div style={styles.errorBox}>{lookupError}</div>}

              {guestList.length > 0 && (
                <div style={styles.entityList}>
                  <p style={styles.entityListText}>
                    {guestList.length} guest{guestList.length !== 1 ? 's' : ''} found — select one to view details.
                  </p>
                  {guestList.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setRecord({ ...g, type: 'guest' }); setGuestList([]) }}
                      style={styles.entityListItem}
                    >
                      <div>
                        <div style={styles.entityTitle}>{g.guest_name}</div>
                        <div style={styles.entityMeta}>{g.device_brand} · Code: <span style={styles.entityCode}>{g.guest_code}</span></div>
                      </div>
                      <span style={{
                        ...styles.entityBadge,
                        backgroundColor: g.is_in_campus ? '#d1fae5' : '#fee2e2',
                        color: g.is_in_campus ? '#065f46' : '#991b1b',
                      }}>
                        {g.is_in_campus ? 'On Campus' : 'Off Campus'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {record?.type === 'guest' && (
            <GuestCard guest={record} onRefresh={refreshRecord} />
          )}

          {record?.type === 'laptop' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Laptop Details</h2>
              {actionMsg && <div style={styles.successBox}>{actionMsg}</div>}
              {actionError && <div style={styles.errorBox}>{actionError}</div>}
              {status === 'BLOCKED' && <div style={styles.blockedAlert}>🚫 This laptop is BLOCKED. No entry or exit is permitted.</div>}
              {securityStatus === 'STOLEN' && <div style={styles.stolenAlert}>🚨 SECURITY ALERT: This laptop is reported STOLEN. Exit approval is not allowed.{record.report_reason ? <div style={styles.alertReason}>Reason: {record.report_reason}</div> : null}</div>}
              {securityStatus === 'LOST' && <div style={styles.lostAlert}>⚠️ This laptop is reported LOST.{record.report_reason ? <div style={styles.alertReason}>Reason: {record.report_reason}</div> : null}</div>}
              <div style={styles.laptopContent}>
                <div style={styles.photoColumns}>
                  <div style={styles.photoWrap}>{record.photo_url ? <img src={buildPhotoUrl(record.photo_url)} alt={`${record.brand} laptop`} style={styles.photo} /> : <div style={styles.noPhoto}>💻</div>}<div style={styles.photoLabel}>Laptop Photo</div></div>
                  <div style={styles.photoWrap}>{record.student_photo_url ? <img src={buildPhotoUrl(record.student_photo_url)} alt={`${record.owner_name} student`} style={styles.photo} /> : <div style={styles.noPhoto}>👤</div>}<div style={styles.photoLabel}>Student Photo</div></div>
                </div>
                <div style={styles.details}>
                  <Row label="Owner" value={record.student_full_name || record.owner_name} />
                  <Row label="Student ID" value={record.student_id || 'N/A'} />
                  <Row label="Email" value={record.owner_email || 'N/A'} />
                  <Row label="Brand" value={record.brand} />
                  <Row label="Model" value={record.model} />
                  <Row label="Serial Number" value={record.serial_number} />
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Status</span><span style={{ ...styles.badge, ...statusStyle(status) }}>{statusLabel(status)}</span></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Security</span><span style={{ ...styles.badge, ...securityStatusStyle(securityStatus) }}>{securityStatusLabel(securityStatus)}</span></div>
                  {record.reported_at && <Row label="Reported At" value={new Date(record.reported_at).toLocaleString()} />}
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Campus</span><span style={{ ...styles.badge, backgroundColor: record.is_in_campus ? '#e6ffed' : '#fff0f0', color: record.is_in_campus ? '#2e7d32' : '#c62828' }}>{record.is_in_campus ? '✅ On Campus' : '🏠 Off Campus'}</span></div>
                </div>
              </div>
              <div style={styles.actions}>{status === 'PENDING' && <button style={{ ...styles.btnAction, ...styles.btnVerify }} onClick={() => doLaptopAction('verify', verifyLaptop)} disabled={!!actionLoading}>{actionLoading === 'verify' ? 'Verifying…' : '✅ Verify Laptop'}</button>}{status === 'VERIFIED' && <><button style={{ ...styles.btnAction, ...styles.btnEntry }} onClick={() => doLaptopAction('entry', logEntry)} disabled={!!actionLoading}>{actionLoading === 'entry' ? 'Logging…' : '🔵 Allow Entry'}</button><button style={{ ...styles.btnAction, ...styles.btnExit }} onClick={() => doLaptopAction('exit', logExit)} disabled={!!actionLoading || securityStatus === 'STOLEN'}>{securityStatus === 'STOLEN' ? '🚨 Exit Blocked' : actionLoading === 'exit' ? 'Logging…' : '🟡 Allow Exit'}</button></>}{(status === 'PENDING' || status === 'VERIFIED') && <button style={{ ...styles.btnAction, ...styles.btnBlock }} onClick={() => setBlockReasonModal(true)} disabled={!!actionLoading}>{actionLoading === 'block' ? 'Blocking…' : '🚫 Block Laptop'}</button>}</div>
            </div>
          )}

          <div style={styles.card}>
            <div style={styles.cardHeaderRow}>
              <div>
                <h2 style={styles.cardTitle}>Recent Gate Activity</h2>
                <div style={styles.cardSubTitle}>Live records sorted by time, guard, or owner.</div>
              </div>
            </div>
            <div style={styles.filterBar}>
              {filterButtons.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  style={{
                    ...styles.filterButton,
                    ...(tableFilter === filter.id ? styles.filterButtonActive : {}),
                  }}
                  onClick={() => { setTableFilter(filter.id); setTablePage(1) }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th} onClick={() => { setSortKey('time'); setSortDirection(sortKey === 'time' && sortDirection === 'asc' ? 'desc' : 'asc') }}>
                      Time {sortKey === 'time' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th style={styles.th} onClick={() => { setSortKey('guard'); setSortDirection(sortKey === 'guard' && sortDirection === 'asc' ? 'desc' : 'asc') }}>
                      Guard {sortKey === 'guard' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th style={styles.th} onClick={() => { setSortKey('owner'); setSortDirection(sortKey === 'owner' && sortDirection === 'asc' ? 'desc' : 'asc') }}>
                      Owner {sortKey === 'owner' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th style={styles.th}>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={styles.emptyStateCell}>
                        <div style={styles.emptyStateIllustration}>📭</div>
                        <div style={styles.emptyStateTitle}>No activity matches this filter.</div>
                        <div style={styles.emptyStateText}>Try another filter or refresh the dashboard to show the latest records.</div>
                      </td>
                    </tr>
                  ) : displayedLogs.map((log, index) => {
                    const isGuest = log.type === 'guest'
                    const badgeColor = log.action === 'ENTRY' ? { backgroundColor: '#dbeafe', color: '#1e3a8a' } : log.action === 'EXIT' ? { backgroundColor: '#fff7cd', color: '#92400e' } : { backgroundColor: '#fee2e2', color: '#9b1c1c' }
                    return (
                      <tr key={log.id} style={index % 2 === 0 ? styles.tableRowAlt : {}}>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, ...badgeColor }}>{log.action}</span>
                          {isGuest && <span style={styles.guestBadge}>👤 Guest</span>}
                        </td>
                        <td style={styles.td}>{formatActivityTime(log.scanned_at)}</td>
                        <td style={styles.td}>{log.scanned_by_name}</td>
                        <td style={styles.td}>{isGuest ? log.guest_name : log.owner_name}</td>
                        <td style={styles.td}>{isGuest ? log.guest_brand || 'Guest device' : `${log.brand || '—'} ${log.serial_number || ''}`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={styles.paginationRow}>
              <button style={styles.pageButton} type="button" disabled={tablePage === 1} onClick={() => setTablePage((p) => Math.max(1, p - 1))}>Previous</button>
              <span style={styles.pageStatus}>Page {tablePage} of {pageCount}</span>
              <button style={styles.pageButton} type="button" disabled={tablePage === pageCount} onClick={() => setTablePage((p) => Math.min(pageCount, p + 1))}>Next</button>
            </div>
          </div>
        </div>
      </div>

      <AASTUFooter />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#e8ecff', color: '#1f2937', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '22px', padding: '28px 24px 20px', background: 'linear-gradient(135deg, #1a237e 0%, #283593 52%, #3949ab 100%)', boxShadow: '0 18px 60px rgba(15,23,42,0.14)', position: 'sticky', top: 0, zIndex: 90, borderBottom: '1px solid rgba(255,255,255,0.14)', flexWrap: 'wrap' },
  brandLabel: { fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#f9d423', fontWeight: 700 },
  pageHeadline: { marginTop: '10px', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, lineHeight: 1.05, color: '#fff' },
  pageDetail: { marginTop: '12px', maxWidth: '640px', color: 'rgba(255,255,255,0.84)', fontSize: '0.98rem', lineHeight: 1.8 },
  headerActions: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  mobileSidebarToggle: { display: 'none', minWidth: 0, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '12px 14px', cursor: 'pointer', fontSize: '18px' },
  clockPill: { display: 'grid', gap: '4px', padding: '12px 18px', borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', minWidth: '180px', textAlign: 'right', color: '#fff' },
  notificationBtn: { position: 'relative', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: '16px', padding: '12px 16px', cursor: 'pointer', fontSize: '18px' },
  bellIcon: { fontSize: '18px' },
  notificationBadge: { position: 'absolute', top: '6px', right: '6px', minWidth: '20px', height: '20px', borderRadius: '999px', backgroundColor: '#f9d423', color: '#1a237e', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' },
  langMenu: { position: 'relative' },
  langBtn: { border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.12)', borderRadius: '16px', color: '#fff', padding: '12px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
  langDropdown: { position: 'absolute', right: 0, top: 'calc(100% + 12px)', backgroundColor: '#fff', borderRadius: '18px', boxShadow: '0 18px 40px rgba(15,23,42,0.16)', overflow: 'hidden', minWidth: '180px', zIndex: 98 },
  langOption: { width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', background: 'transparent', color: '#1f2937', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  logoutBtn: { border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(220,53,69,0.15)', borderRadius: '16px', color: '#fff', padding: '12px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, transition: 'all 0.2s ease', whiteSpace: 'nowrap' },
  main: { display: 'flex', gap: '24px', padding: '24px 20px 32px', boxSizing: 'border-box', minHeight: 'calc(100vh - 132px)', alignItems: 'flex-start', flexWrap: 'wrap' },
  sidebar: { width: '94px', minWidth: '94px', backgroundColor: '#fff', borderRadius: '24px', padding: '18px 12px', boxShadow: '0 18px 40px rgba(15,23,42,0.08)', position: 'sticky', top: '120px', alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.24s ease, opacity 0.24s ease' },
  sidebarOpen: { transform: 'translateX(0)', opacity: 1 },
  sidebarClosed: { transform: 'translateX(-140%)', opacity: 0.02 },
  sidebarBrand: { color: '#1a237e', fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', textAlign: 'center' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' },
  sidebarButton: { all: 'unset', width: '58px', height: '58px', borderRadius: '18px', backgroundColor: '#f8fafc', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 12px 30px rgba(15,23,42,0.08)', transition: 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease' },
  sidebarButtonActive: { backgroundColor: '#1a237e', color: '#fff', boxShadow: '0 14px 34px rgba(26,35,126,0.24)', transform: 'translateY(-1px)' },
  sidebarIcon: { fontSize: '22px' },
  content: { flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1200px', boxSizing: 'border-box' },
  workspaceGrid: { display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '20px', marginBottom: '10px' },
  workspaceCard: { padding: '26px', borderRadius: '24px', backgroundColor: '#fff', boxShadow: '0 18px 40px rgba(15,23,42,0.08)', minHeight: '140px' },
  workspaceCardAccent: { padding: '26px', borderRadius: '24px', background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: '#fff', boxShadow: '0 18px 40px rgba(15,23,42,0.14)', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  workspaceTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' },
  workspaceCopy: { marginTop: '10px', color: '#475569', lineHeight: 1.75 },
  workspaceStatLabel: { fontSize: '13px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c5d6ff', opacity: 0.95 },
  workspaceStatValue: { marginTop: '14px', fontSize: '44px', fontWeight: 800, color: '#fff' },
  workspaceSmall: { marginTop: '10px', color: 'rgba(255,255,255,0.85)', fontSize: '13px', lineHeight: 1.7 },
  card: { backgroundColor: '#fff', borderRadius: '24px', padding: '32px', boxShadow: '0 18px 40px rgba(15,23,42,0.08)' },
  cardHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '22px' },
  cardSubTitle: { color: '#475569', fontSize: '14px', marginTop: '6px' },
  statusPillRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pulseLabel: { padding: '10px 16px', borderRadius: '999px', backgroundColor: '#e8f1ff', color: '#1e3a8a', fontSize: '13px', fontWeight: 600 },
  searchForm: { display: 'flex', flexDirection: 'column', gap: '20px' },
  toggleGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' },
  toggleButton: { flex: 1, minWidth: '120px', borderRadius: '999px', border: '1px solid #c7d2e8', backgroundColor: '#fff', color: '#1f2937', padding: '12px 18px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' },
  toggleButtonActive: { backgroundColor: '#1a237e', borderColor: '#1a237e', color: '#fff', boxShadow: '0 12px 24px rgba(26,35,126,0.14)' },
  searchRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  searchFieldWrapper: { position: 'relative', flex: 1, minWidth: '240px' },
  searchInput: { width: '100%', padding: '16px 170px 16px 20px', borderRadius: '18px', border: '2px solid #cbd5e1', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1f2937', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' },
  validationBadge: { position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', borderRadius: '999px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, boxShadow: '0 6px 20px rgba(15,23,42,0.08)' },
  actionButtonGroup: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
  btnPrimary: { padding: '14px 24px', borderRadius: '16px', border: 'none', background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer', minWidth: '140px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
  btnPrimaryHover: { transform: 'translateY(-1px)', boxShadow: '0 14px 30px rgba(26,35,126,0.18)' },
  btnQR: { position: 'relative', overflow: 'hidden', padding: '14px 24px', borderRadius: '16px', border: '1px solid #f9d423', backgroundColor: '#fff9e5', color: '#b45309', fontWeight: 700, cursor: 'pointer', minWidth: '150px', transition: 'transform 0.2s ease' },
  scanLine: { position: 'absolute', left: 0, right: 0, top: '0%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(249,212,35,0.85), transparent)', animation: 'scan-line 2.4s infinite ease-in-out' },
  entityList: { borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: '#fff', padding: '20px', boxShadow: '0 8px 30px rgba(15,23,42,0.05)' },
  entityListText: { margin: 0, marginBottom: '14px', fontSize: '13px', color: '#475569' },
  entityListItem: { width: '100%', textAlign: 'left', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '18px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', transition: 'background 0.2s ease, border-color 0.2s ease' },
  entityTitle: { fontSize: '15px', fontWeight: 700, color: '#111827' },
  entityMeta: { marginTop: '6px', fontSize: '13px', color: '#64748b' },
  entityCode: { fontFamily: 'monospace', color: '#1a237e' },
  entityBadge: { minWidth: '92px', textAlign: 'center', borderRadius: '999px', fontSize: '12px', fontWeight: 700, padding: '8px 12px' },
  filterBar: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' },
  filterButton: { padding: '10px 16px', borderRadius: '999px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#1f2937', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease' },
  filterButtonActive: { backgroundColor: '#1a237e', borderColor: '#1a237e', color: '#fff', boxShadow: '0 10px 30px rgba(26,35,126,0.16)' },
  tableWrap: { overflowX: 'auto', borderRadius: '22px', boxShadow: '0 14px 40px rgba(15,23,42,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
  th: { textAlign: 'left', padding: '16px 18px', color: '#1f2937', fontWeight: 700, fontSize: '13px', letterSpacing: '0.01em', borderBottom: '2px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' },
  td: { padding: '16px 18px', borderBottom: '1px solid #e5e7eb', color: '#374151', fontSize: '14px' },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.01em' },
  emptyStateCell: { padding: '44px 0', textAlign: 'center', color: '#475569' },
  emptyStateIllustration: { fontSize: '40px', marginBottom: '16px' },
  emptyStateTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '8px' },
  emptyStateText: { fontSize: '14px', color: '#64748b', lineHeight: 1.7 },
  paginationRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '18px', flexWrap: 'wrap' },
  pageButton: { padding: '10px 18px', borderRadius: '999px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#1a237e', cursor: 'pointer', fontWeight: 700, minWidth: '110px' },
  pageStatus: { color: '#475569', fontSize: '14px' },
  // Legacy styles still used by some card components
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' },
  input: { width: '100%', padding: '14px 18px', borderRadius: '10px', border: '2px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1f2937', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' },
  guestCodeBox: { backgroundColor: '#fff8e1', border: '2px solid #FFD700', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '24px' },
  guestCodeLabel: { fontSize: '14px', color: '#e65100', marginBottom: '12px', fontWeight: '500' },
  guestCodeNumber: { fontSize: '52px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '8px', color: '#0033A0', backgroundColor: '#fff', padding: '16px', borderRadius: '10px', marginBottom: '8px' },
  guestCodeHint: { fontSize: '12px', color: '#888' },
  errorBox: { backgroundColor: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '16px', marginTop: '16px', fontSize: '14px' },
  successBox: { backgroundColor: '#e8f5e9', color: '#166534', padding: '12px 16px', borderRadius: '16px', marginBottom: '16px', fontSize: '14px' },
  blockedAlert: { backgroundColor: '#ffebee', color: '#b91c1c', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontWeight: 700, border: '1px solid #fca5a5' },
  stolenAlert: { backgroundColor: '#ffebee', color: '#b91c1c', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontWeight: 700, border: '1px solid #fca5a5' },
  lostAlert: { backgroundColor: '#fff7cd', color: '#92400e', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontWeight: 700, border: '1px solid #facc15' },
  alertReason: { marginTop: 8, fontSize: 13, fontWeight: 600 },
  laptopContent: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' },
  photoColumns: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  photoWrap: { flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  photo: { width: '160px', height: '160px', objectFit: 'cover', borderRadius: '16px', border: '3px solid #f9d423' },
  noPhoto: { width: '160px', height: '160px', borderRadius: '16px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px', border: '2px dashed #cbd5e1' },
  photoLabel: { fontSize: '13px', color: '#475569', fontWeight: 600 },
  details: { flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' },
  detailRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  detailLabel: { fontWeight: 700, color: '#334155', minWidth: '120px', fontSize: '13px' },
  detailValue: { color: '#1f2937', fontSize: '14px' },
  badge: { padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 },
  actions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  btnAction: { padding: '12px 22px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' },
  btnVerify: { backgroundColor: '#e8f5e9', color: '#166534', border: '1px solid #6ee7b7' },
  btnEntry: { backgroundColor: '#dbeafe', color: '#1e3a8a', border: '1px solid #93c5fd' },
  btnExit: { backgroundColor: '#fff7cd', color: '#92400e', border: '1px solid #fde68a' },
  btnBlock: { backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
  // legacy support
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#334155' },
  input: { width: '100%', padding: '14px 18px', borderRadius: '14px', border: '2px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1f2937', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' },
  guestCodeBox: { backgroundColor: '#fff8e1', border: '2px solid #facc15', borderRadius: '14px', padding: '20px', textAlign: 'center', marginBottom: '24px' },
  guestCodeLabel: { fontSize: '14px', color: '#b45309', marginBottom: '12px', fontWeight: 700 },
  guestCodeNumber: { fontSize: '52px', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '8px', color: '#1e3a8a', backgroundColor: '#fff', padding: '16px', borderRadius: '14px', marginBottom: '8px' },
  guestCodeHint: { fontSize: '12px', color: '#6b7280' },
}
