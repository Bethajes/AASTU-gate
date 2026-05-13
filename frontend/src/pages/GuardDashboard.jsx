import { useState, useEffect, useRef, useCallback } from 'react'
import AASTUHeader from '../components/AASTUHeader'
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
  const [form, setForm] = useState({ studentId: '', serialNumber: '', brand: '', model: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(null)

  const validate = () => {
    const e = {}
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
      fd.append('studentId',    form.studentId.trim())
      fd.append('serialNumber', form.serialNumber.trim())
      fd.append('brand',        form.brand.trim())
      fd.append('model',        form.model.trim())
      const res = await API.post('/laptops/guard-register', fd)
      setSuccess(res.data)
      setForm({ studentId: '', serialNumber: '', brand: '', model: '' })
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const fields = [
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

  useEffect(() => { loadLogs() }, [])

  const loadLogs = async () => {
    try {
      const res = await fetchLogs()
      setLogs(res.data.slice(0, 10))
    } catch { /* non-critical */ }
  }

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

  return (
    <div style={styles.container}>
      <AASTUHeader subtitle="Guard Dashboard" />

      <div style={styles.main}>
        <div style={styles.content}>

          {/* ── Tabs ── */}
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(activeTab === 'scan' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('scan')}
            >
              🔍 Scan / Lookup
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'register' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('register')}
            >
              👤 Register Guest
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'registerLaptop' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('registerLaptop')}
            >
              💻 Register Laptop
            </button>
          </div>

          {/* ── Scan tab ── */}
          {activeTab === 'scan' && (
            <>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Laptop / Guest Lookup</h2>

                <form onSubmit={handleSearch} style={styles.searchForm}>
                  <div style={styles.searchTypeRow}>
                    {[
                      { id: 'code',      label: '8-Digit Code' },
                      { id: 'studentId', label: 'Student ID' },
                      { id: 'guestName', label: '👤 Guest Name' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setSearchType(id); setGuestList([]); setRecord(null); setLookupError('') }}
                        style={{
                          padding: '7px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                          cursor: 'pointer', border: '2px solid',
                          borderColor: searchType === id ? '#0033A0' : '#c7d2e8',
                          backgroundColor: searchType === id ? '#0033A0' : '#fff',
                          color: searchType === id ? '#fff' : '#64748b',
                          transition: 'all 0.18s',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={styles.searchRow}>
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
                    <button style={styles.btnPrimary} type="submit" disabled={searching}>
                      {searching ? 'Searching…' : 'Search'}
                    </button>
                    {searchType !== 'guestName' && (
                      <button type="button" style={styles.btnQR}
                        onClick={() => setShowScanner((v) => !v)}>
                        📷 Scan QR
                      </button>
                    )}
                  </div>
                </form>

                {showScanner && (
                  <QRScanner onDetected={handleQRDetected} onClose={() => setShowScanner(false)} />
                )}

                {lookupError && <div style={styles.errorBox}>{lookupError}</div>}

                {guestList.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
                      {guestList.length} guest{guestList.length !== 1 ? 's' : ''} found — select one to view details
                    </p>
                    {guestList.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setRecord({ ...g, type: 'guest' }); setGuestList([]) }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '12px 16px', marginBottom: 8,
                          background: '#f8fafc', border: '1.5px solid #e2e8f0',
                          borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#0033A0'; e.currentTarget.style.background = '#eff6ff' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc' }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{g.guest_name}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {g.device_brand} · Code: <span style={{ fontFamily: 'monospace' }}>{g.guest_code}</span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                          background: g.is_in_campus ? '#d1fae5' : '#fee2e2',
                          color: g.is_in_campus ? '#065f46' : '#991b1b',
                        }}>
                          {g.is_in_campus ? 'On Campus' : 'Off Campus'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Guest record card ── */}
              {record?.type === 'guest' && (
                <GuestCard guest={record} onRefresh={refreshRecord} />
              )}

              {/* ── Laptop record card ── */}
              {record?.type === 'laptop' && (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Laptop Details</h2>

                  {actionMsg   && <div style={styles.successBox}>{actionMsg}</div>}
                  {actionError && <div style={styles.errorBox}>{actionError}</div>}

                  {status === 'BLOCKED' && (
                    <div style={styles.blockedAlert}>
                      🚫 This laptop is BLOCKED. No entry or exit is permitted.
                    </div>
                  )}

                  <div style={styles.laptopContent}>
                    <div style={styles.photoColumns}>
                      <div style={styles.photoWrap}>
                        {record.photo_url
                          ? <img src={buildPhotoUrl(record.photo_url)} alt={`${record.brand} laptop`} style={styles.photo} />
                          : <div style={styles.noPhoto}>💻</div>}
                        <div style={styles.photoLabel}>Laptop Photo</div>
                      </div>
                      <div style={styles.photoWrap}>
                        {record.student_photo_url
                          ? <img src={buildPhotoUrl(record.student_photo_url)} alt={`${record.owner_name} student`} style={styles.photo} />
                          : <div style={styles.noPhoto}>👤</div>}
                        <div style={styles.photoLabel}>Student Photo</div>
                      </div>
                    </div>
                    <div style={styles.details}>
                      <Row label="Owner"         value={record.student_full_name || record.owner_name} />
                      <Row label="Student ID"    value={record.student_id || 'N/A'} />
                      <Row label="Email"         value={record.owner_email || 'N/A'} />
                      <Row label="Brand"         value={record.brand} />
                      <Row label="Model"         value={record.model} />
                      <Row label="Serial Number" value={record.serial_number} />
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Status</span>
                        <span style={{ ...styles.badge, ...statusStyle(status) }}>{statusLabel(status)}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Campus</span>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: record.is_in_campus ? '#e6ffed' : '#fff0f0',
                          color: record.is_in_campus ? '#2e7d32' : '#c62828',
                        }}>
                          {record.is_in_campus ? '✅ On Campus' : '🏠 Off Campus'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.actions}>
                    {status === 'PENDING' && (
                      <button style={{ ...styles.btnAction, ...styles.btnVerify }}
                        onClick={() => doLaptopAction('verify', verifyLaptop)} disabled={!!actionLoading}>
                        {actionLoading === 'verify' ? 'Verifying…' : '✅ Verify Laptop'}
                      </button>
                    )}
                    {status === 'VERIFIED' && (
                      <>
                        <button style={{ ...styles.btnAction, ...styles.btnEntry }}
                          onClick={() => doLaptopAction('entry', logEntry)} disabled={!!actionLoading}>
                          {actionLoading === 'entry' ? 'Logging…' : '🔵 Allow Entry'}
                        </button>
                        <button style={{ ...styles.btnAction, ...styles.btnExit }}
                          onClick={() => doLaptopAction('exit', logExit)} disabled={!!actionLoading}>
                          {actionLoading === 'exit' ? 'Logging…' : '🟡 Allow Exit'}
                        </button>
                      </>
                    )}
                    {(status === 'PENDING' || status === 'VERIFIED') && (
                      <button style={{ ...styles.btnAction, ...styles.btnBlock }}
                        onClick={() => setBlockReasonModal(true)} disabled={!!actionLoading}>
                        {actionLoading === 'block' ? 'Blocking…' : '🚫 Block Laptop'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Register Guest tab ── */}
          {activeTab === 'register' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Register Guest</h2>
              <GuestRegistrationForm onSuccess={loadLogs} />
            </div>
          )}

          {/* ── Register Laptop tab ── */}
          {activeTab === 'registerLaptop' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Register Laptop for Student</h2>
              <GuardRegisterLaptopForm />
            </div>
          )}

          {/* ── Recent logs ── */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Recent Gate Activity</h2>
            {logs.length === 0 ? (
              <p style={styles.empty}>No gate activity yet.</p>
            ) : (
              logs.map((log) => {
                const isGuest = log.type === 'guest'
                const brand  = isGuest ? log.guest_brand  : log.brand
                const serial = isGuest ? log.guest_serial : log.serial_number
                return (
                  <div key={log.id} style={styles.logItem}>
                    <div style={styles.logTop}>
                      <span style={{
                        ...styles.actionBadge,
                        backgroundColor: log.action === 'ENTRY' ? '#e3f2fd' : '#fff8e1',
                        color: log.action === 'ENTRY' ? '#1565c0' : '#e65100',
                      }}>
                        {log.action === 'ENTRY' ? '🔵 ENTRY' : '🟡 EXIT'}
                      </span>
                      {isGuest && <span style={styles.guestBadge}>👤 Guest</span>}
                      <span style={styles.logLaptop}>{brand} — {serial}</span>
                    </div>
                    <div style={styles.logMeta}>
                      <span>{isGuest ? `Guest: ${log.guest_name}` : `Owner: ${log.owner_name}`}</span>
                      <span>Guard: {log.scanned_by_name}</span>
                      <span>{new Date(log.scanned_at).toLocaleString()}</span>
                    </div>
                  </div>
                )
              })
            )}
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
  container: { minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  content: { maxWidth: '860px', margin: '32px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, width: '100%', boxSizing: 'border-box' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  cardTitle: { margin: '0 0 24px', fontSize: '20px', fontWeight: '700', color: '#0033A0', borderLeft: '4px solid #FFD700', paddingLeft: '16px' },

  // Tabs
  tabs: { display: 'flex', gap: '8px' },
  tab: { flex: 1, padding: '14px', backgroundColor: '#fff', border: '2px solid #e0e0e0', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', color: '#555' },
  tabActive: { backgroundColor: '#0033A0', color: '#fff', borderColor: '#0033A0' },

  // Search
  searchForm: { display: 'flex', flexDirection: 'column', gap: '12px' },
  searchTypeRow: { display: 'flex', gap: '24px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' },
  searchRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: '180px', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e0e0e0', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { padding: '12px 24px', background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  btnQR: { padding: '12px 18px', backgroundColor: '#fff8e1', color: '#e65100', border: '1.5px solid #FFD700', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  btnSecondary: { marginTop: '10px', padding: '8px 18px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },

  // QR Scanner
  scannerWrap: { marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  video: { width: '100%', maxWidth: '400px', borderRadius: '12px', border: '2px solid #0033A0' },
  camError: { marginTop: '12px', padding: '14px', backgroundColor: '#fff0f0', borderRadius: '10px', color: '#c62828', fontSize: '14px' },

  // Alerts
  errorBox: { backgroundColor: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '10px', marginTop: '12px', fontSize: '14px' },
  successBox: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' },
  blockedAlert: { backgroundColor: '#ffebee', color: '#c62828', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontWeight: '700', fontSize: '15px', border: '2px solid #ef9a9a' },

  // Laptop card
  laptopContent: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' },
  photoColumns: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  photoWrap: { flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  photo: { width: '160px', height: '160px', objectFit: 'cover', borderRadius: '12px', border: '3px solid #FFD700' },
  noPhoto: { width: '160px', height: '160px', borderRadius: '12px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', border: '2px dashed #ccc' },
  photoLabel: { fontSize: '13px', color: '#555', fontWeight: '600' },
  details: { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' },
  detailRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  detailLabel: { fontWeight: '600', color: '#555', minWidth: '120px', fontSize: '13px' },
  detailValue: { color: '#222', fontSize: '14px' },
  badge: { padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },

  // Action buttons
  actions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  btnAction: { padding: '12px 22px', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  btnVerify: { backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1.5px solid #4caf50' },
  btnEntry: { backgroundColor: '#e3f2fd', color: '#1565c0', border: '1.5px solid #90caf9' },
  btnExit: { backgroundColor: '#fff8e1', color: '#e65100', border: '1.5px solid #FFD700' },
  btnBlock: { backgroundColor: '#ffebee', color: '#c62828', border: '1.5px solid #ef9a9a' },

  // Guest registration form
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  guestCodeBox: { backgroundColor: '#fff8e1', border: '2px solid #FFD700', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '24px' },
  guestCodeLabel: { fontSize: '14px', color: '#e65100', marginBottom: '12px', fontWeight: '500' },
  guestCodeNumber: { fontSize: '52px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '8px', color: '#0033A0', backgroundColor: '#fff', padding: '16px', borderRadius: '10px', marginBottom: '8px' },
  guestCodeHint: { fontSize: '12px', color: '#888' },

  // Logs
  empty: { color: '#888', fontSize: '14px', textAlign: 'center', padding: '32px 0' },
  logItem: { padding: '12px 16px', backgroundColor: '#f8f9fa', borderRadius: '10px', marginBottom: '10px' },
  logTop: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' },
  actionBadge: { padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  guestBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#f3e5f5', color: '#7b1fa2' },
  logLaptop: { fontSize: '14px', color: '#333', fontWeight: '500' },
  logMeta: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', flexWrap: 'wrap', gap: '4px' },
}
