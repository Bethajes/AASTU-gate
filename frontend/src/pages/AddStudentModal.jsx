import { useState, useMemo, useRef } from 'react'
import API from '../api/axios'

export const REQUIRED_FIELDS = ['id', 'name', 'department']

function deriveUsername(studentId) {
  return String(studentId || '').trim().replace(/\//g, '')
}

export function validateStudentForm(data) {
  const errs = {}
  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || data[field].trim() === '') {
      errs[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`
    }
  }
  return errs
}

export default function AddStudentModal({ onSuccess, onClose }) {
  const [form, setForm] = useState({ id: '', name: '', department: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedPath, setUploadedPath] = useState(null)
  const fileInputRef = useRef(null)

  const derivedUsername = useMemo(() => deriveUsername(form.id), [form.id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setUploadedPath(null)
  }

  const handleRemovePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    setUploadedPath(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadPhoto = async () => {
    if (!photoFile) return null
    if (uploadedPath) return uploadedPath
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo', photoFile)
      const res = await API.post('/students/upload-photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadedPath(res.data.photo)
      return res.data.photo
    } catch (err) {
      throw new Error(err?.response?.data?.message ?? 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError(null)
    const errs = validateStudentForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    try {
      let photoPath = null
      if (photoFile) photoPath = await uploadPhoto()
      await API.post('/students', {
        id: form.id.trim(),
        name: form.name.trim(),
        department: form.department.trim(),
        ...(photoPath ? { photo: photoPath } : {}),
      })
      onSuccess()
      onClose()
    } catch (err) {
      if (err?.response?.status === 409) {
        setApiError('A student with this ID already exists')
      } else {
        setApiError(err?.message ?? err?.response?.data?.message ?? 'Failed to add student.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || uploading

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-labelledby="add-student-title">
      <div style={s.modal}>
        <div style={s.header}>
          <h2 id="add-student-title" style={s.title}>Add Student</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {apiError && (
            <div style={s.apiError} role="alert">{apiError}</div>
          )}

          <div style={s.fieldGroup}>
            <label style={s.label}>Photo (optional)</label>
            <div style={s.photoArea}>
              {photoPreview ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoPreview} alt="Preview" style={s.previewImg} />
                  <button
                    type="button"
                    style={s.removeBtn}
                    onClick={handleRemovePhoto}
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  style={s.pickerBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span style={{ fontSize: 26, display: 'block', marginBottom: 4 }}>📷</span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Click to upload photo</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'block' }}>
                    JPG, PNG or WEBP · max 5 MB
                  </span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
              aria-label="Upload student photo"
            />
          </div>

          {[
            { field: 'id', label: 'Student ID *', placeholder: 'e.g. ETS0001/15' },
            { field: 'name', label: 'Full Name *', placeholder: 'e.g. John Doe' },
            { field: 'department', label: 'Department *', placeholder: 'e.g. Computer Science' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} style={s.fieldGroup}>
              <label htmlFor={`as-${field}`} style={s.label}>{label}</label>
              <input
                id={`as-${field}`}
                name={field}
                value={form[field]}
                onChange={handleChange}
                placeholder={placeholder}
                style={{ ...s.input, ...(errors[field] ? s.inputErr : {}) }}
                aria-invalid={!!errors[field]}
              />
              {errors[field] && (
                <span style={s.fieldErr} role="alert">{errors[field]}</span>
              )}
            </div>
          ))}

          {derivedUsername && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Username (auto-generated)</label>
              <div style={s.derived}>{derivedUsername}</div>
            </div>
          )}

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              style={{ ...s.submitBtn, opacity: busy ? 0.7 : 1 }}
              disabled={busy}
            >
              {uploading ? 'Uploading photo…' : submitting ? 'Adding…' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '28px',
    width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888', padding: '4px 8px', borderRadius: '4px' },
  apiError: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '14px', color: '#856404' },
  fieldGroup: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#444' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  inputErr: { borderColor: '#e53935' },
  fieldErr: { display: 'block', marginTop: '4px', fontSize: '12px', color: '#e53935' },
  derived: { padding: '9px 12px', border: '1px solid #eee', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f7f7f7', color: '#666', fontFamily: 'monospace' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
  cancelBtn: { padding: '9px 20px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  submitBtn: { padding: '9px 20px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  photoArea: { border: '2px dashed #e2e8f0', borderRadius: '10px', overflow: 'hidden' },
  pickerBtn: { width: '100%', padding: '22px 16px', background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'center', display: 'block' },
  previewImg: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' },
  removeBtn: {
    position: 'absolute', top: 8, right: 8,
    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
    borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
