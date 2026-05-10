import { useState, useEffect, useCallback } from 'react'
import API from '../api/axios'

const API_ORIGIN = (API.defaults?.baseURL || '').replace(/\/api\/?$/, '')

function laptopPhotoUrl(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`
}

const STATUS_STYLE = {
  VERIFIED: { bg: '#e6ffed', color: '#2e7d32', label: '✅ Verified' },
  PENDING:  { bg: '#fff8e1', color: '#e65100', label: '⏳ Pending' },
  BLOCKED:  { bg: '#fdecea', color: '#c62828', label: '🚫 Blocked' },
}

// ─── Register Laptop Form ─────────────────────────────────────────────────────

function RegisterLaptopForm({ studentId, onSuccess, onCancel }) {
  const [form, setForm]         = useState({ serialNumber: '', brand: '', model: '' })
  const [photo, setPhoto]       = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [errors, setErrors]     = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handlePhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setApiError(null)
    const errs = {}
    if (!form.serialNumber.trim()) errs.serialNumber = 'Serial number is required'
    if (!form.brand.trim())        errs.brand        = 'Brand is required'
    if (!form.model.trim())        errs.model        = 'Model is required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('studentId',    studentId)
      fd.append('serialNumber', form.serialNumber.trim())
      fd.append('brand',        form.brand.trim())
      fd.append('model',        form.model.trim())
      if (photo) fd.append('photo', photo)

      await API.post('/laptops/admin-register', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onSuccess()
    } catch (err) {
      setApiError(err?.response?.data?.message ?? 'Failed to register laptop.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={s.regForm}>
      <p style={s.regTitle}>Register Laptop on Behalf of Student</p>
      {apiError && <div style={s.apiError} role="alert">{apiError}</div>}

      {[
        { name: 'serialNumber', label: 'Serial Number', placeholder: 'e.g. SN123456' },
        { name: 'brand',        label: 'Brand',         placeholder: 'e.g. Dell' },
        { name: 'model',        label: 'Model',         placeholder: 'e.g. XPS 15' },
      ].map(({ name, label, placeholder }) => (
        <div key={name} style={s.fieldGroup}>
          <label style={s.label}>{label} *</label>
          <input
            name={name}
            value={form[name]}
            onChange={handleChange}
            placeholder={placeholder}
            style={{ ...s.input, ...(errors[name] ? s.inputError : {}) }}
          />
          {errors[name] && <span style={s.fieldError}>{errors[name]}</span>}
        </div>
      ))}

      {/* Photo upload */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Laptop Photo (optional)</label>
        <label style={s.photoUploadLabel}>
          {photoPreview ? (
            <img src={photoPreview} alt="preview" style={s.photoPreview} />
          ) : (
            <span style={s.photoUploadPlaceholder}>📷 Click to upload photo</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />
        </label>
        {photoPreview && (
          <button
            type="button"
            style={s.removePhotoBtn}
            onClick={() => { setPhoto(null); setPhotoPreview(null) }}
          >
            Remove photo
          </button>
        )}
      </div>

      <div style={s.formActions}>
        <button type="button" style={s.cancelBtn} onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" style={s.submitBtn} disabled={submitting}>
          {submitting ? 'Registering…' : 'Register Laptop'}
        </button>
      </div>
    </form>
  )
}

// ─── StudentLaptopsPanel ──────────────────────────────────────────────────────

export default function StudentLaptopsPanel({ student, onClose }) {
  const [laptops, setLaptops]         = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [showRegForm, setShowRegForm] = useState(false)
  const [confirmId, setConfirmId]     = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null)

  const studentId = student.student_id || student.id
  const studentName = student.full_name || student.name

  const fetchLaptops = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await API.get(`/laptops/by-student/${encodeURIComponent(studentId)}`)
      setLaptops(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load laptops.')
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => { fetchLaptops() }, [fetchLaptops])

  const handleDelete = async () => {
    if (!confirmId) return
    setDeleting(true)
    try {
      await API.delete(`/laptops/${confirmId}`)
      setConfirmId(null)
      await fetchLaptops()
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to delete laptop.')
      setConfirmId(null)
    } finally {
      setDeleting(false)
    }
  }

  const handlePhotoUpload = async (laptopId, file) => {
    if (!file) return
    setUploadingPhotoId(laptopId)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      await API.post(`/laptops/${laptopId}/admin-update-photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchLaptops()
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to upload photo.')
    } finally {
      setUploadingPhotoId(null)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div style={s.backdrop} onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <aside style={s.panel} role="dialog" aria-label={`Laptops for ${studentName}`}>
        {/* Header */}
        <div style={s.panelHeader}>
          <div>
            <div style={s.panelTitle}>💻 Laptops</div>
            <div style={s.panelSub}>{studentName} · {studentId}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        {/* Register button */}
        {!showRegForm && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
            <button style={s.addBtn} onClick={() => setShowRegForm(true)}>
              ➕ Register Laptop for Student
            </button>
          </div>
        )}

        {/* Register form */}
        {showRegForm && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
            <RegisterLaptopForm
              studentId={studentId}
              onSuccess={() => { setShowRegForm(false); fetchLaptops() }}
              onCancel={() => setShowRegForm(false)}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={s.errorBanner} role="alert">
            ⚠️ {error}
            <button style={s.retryBtn} onClick={fetchLaptops}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && <p style={s.empty}>Loading laptops…</p>}

        {/* Empty */}
        {!loading && !error && laptops.length === 0 && (
          <p style={s.empty}>No laptops registered for this student.</p>
        )}

        {/* Laptop list */}
        {!loading && laptops.length > 0 && (
          <ul style={s.list}>
            {laptops.map(laptop => {
              const st = STATUS_STYLE[laptop.verification_status] ?? STATUS_STYLE.PENDING
              const photo = laptopPhotoUrl(laptop.photo_url)
              return (
                <li key={laptop.id} style={s.laptopCard}>
                  <div style={s.laptopLeft}>
                    <label style={{ cursor: 'pointer', flexShrink: 0, position: 'relative' }} title="Click to update photo">
                      {photo ? (
                        <img src={photo} alt={laptop.brand} style={s.laptopPhoto} />
                      ) : (
                        <div style={s.laptopPhotoPlaceholder}>💻</div>
                      )}
                      <div style={s.photoOverlay}>
                        {uploadingPhotoId === laptop.id ? '…' : '📷'}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploadingPhotoId === laptop.id}
                        onChange={e => handlePhotoUpload(laptop.id, e.target.files?.[0])}
                      />
                    </label>
                    <div>
                      <div style={s.laptopName}>{laptop.brand} {laptop.model}</div>
                      <div style={s.laptopSerial}>{laptop.serial_number}</div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{ ...s.badge, backgroundColor: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                        {laptop.is_in_campus && (
                          <span style={{ ...s.badge, backgroundColor: '#e3f2fd', color: '#1565c0', marginLeft: 6 }}>
                            🏛 On Campus
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    style={s.deleteBtn}
                    onClick={() => setConfirmId(laptop.id)}
                    disabled={deleting}
                    aria-label={`Delete ${laptop.brand} ${laptop.model}`}
                    title="Delete laptop"
                  >
                    🗑
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      {/* Confirm delete dialog */}
      {confirmId && (
        <div style={s.confirmOverlay} role="dialog" aria-modal="true">
          <div style={s.confirmBox}>
            <p style={s.confirmMsg}>
              Delete this laptop? All associated gate logs will be unlinked. This cannot be undone.
            </p>
            <div style={s.confirmActions}>
              <button style={s.cancelBtn} onClick={() => setConfirmId(null)} disabled={deleting}>Cancel</button>
              <button style={s.confirmDeleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  backdrop:      { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 200 },
  panel:         { position: 'fixed', top: 0, right: 0, height: '100vh', width: 420, maxWidth: '95vw', backgroundColor: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 201, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  panelHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 16px', borderBottom: '1px solid #eee' },
  panelTitle:    { fontSize: 16, fontWeight: 700, color: '#1a1a2e' },
  panelSub:      { fontSize: 12, color: '#888', marginTop: 3 },
  closeBtn:      { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', padding: '2px 6px', borderRadius: 4 },
  addBtn:        { padding: '8px 16px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  errorBanner:   { margin: '12px 20px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  retryBtn:      { padding: '4px 10px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  empty:         { textAlign: 'center', color: '#aaa', padding: '40px 20px', fontSize: 14 },
  list:          { listStyle: 'none', margin: 0, padding: '8px 0' },
  laptopCard:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f5f5f5', gap: 12 },
  laptopLeft:    { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  laptopPhoto:   { width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #eee', flexShrink: 0, display: 'block' },
  laptopPhotoPlaceholder: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  photoOverlay:  { position: 'absolute', inset: 0, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, opacity: 0, transition: 'opacity 0.15s' },
  laptopName:    { fontSize: 14, fontWeight: 600, color: '#1a1a2e' },
  laptopSerial:  { fontSize: 12, color: '#888', fontFamily: 'monospace', marginTop: 2 },
  badge:         { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  deleteBtn:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#e53935', padding: '4px 6px', borderRadius: 6, flexShrink: 0 },
  // register form
  regForm:       { display: 'flex', flexDirection: 'column', gap: 0 },
  regTitle:      { fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 },
  apiError:      { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#856404' },
  fieldGroup:    { marginBottom: 12 },
  label:         { display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#555' },
  input:         { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  inputError:    { borderColor: '#e53935' },
  fieldError:    { display: 'block', marginTop: 3, fontSize: 11, color: '#e53935' },
  photoUploadLabel:    { display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ddd', borderRadius: 8, padding: 8, cursor: 'pointer', minHeight: 72, overflow: 'hidden' },
  photoUploadPlaceholder: { fontSize: 13, color: '#aaa' },
  photoPreview:        { width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6 },
  removePhotoBtn:      { marginTop: 4, background: 'none', border: 'none', color: '#e53935', fontSize: 12, cursor: 'pointer', padding: 0 },
  formActions:   { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn:     { padding: '7px 16px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  submitBtn:     { padding: '7px 16px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  // confirm dialog
  confirmOverlay:  { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  confirmBox:      { backgroundColor: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  confirmMsg:      { fontSize: 14, color: '#1a1a2e', marginBottom: 20, lineHeight: 1.5 },
  confirmActions:  { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  confirmDeleteBtn:{ padding: '8px 20px', backgroundColor: '#e53935', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
}
