import { useState } from 'react'
import API from '../api/axios'

export const REQUIRED_FIELDS = ['id', 'username', 'name', 'department']

const INITIAL_FORM = { id: '', username: '', name: '', department: '', photo: '' }

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
  const [form, setForm]     = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const validate = validateStudentForm

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    // Clear field error on change
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError(null)

    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        id:         form.id.trim(),
        username:   form.username.trim(),
        name:       form.name.trim(),
        department: form.department.trim(),
        ...(form.photo.trim() ? { photo: form.photo.trim() } : {}),
      }
      await API.post('/students', payload)
      onSuccess()
      onClose()
    } catch (err) {
      if (err?.response?.status === 409) {
        setApiError('Student ID or username already exists')
      } else {
        setApiError(err?.response?.data?.message ?? 'Failed to add student. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="add-student-title">
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 id="add-student-title" style={styles.modalTitle}>Add Student</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {apiError && (
            <div style={styles.apiError} role="alert">{apiError}</div>
          )}

          {[
            { field: 'id',         label: 'Student ID',  placeholder: 'e.g. ETS0001/15' },
            { field: 'username',   label: 'Username',    placeholder: 'e.g. john.doe' },
            { field: 'name',       label: 'Full Name',   placeholder: 'e.g. John Doe' },
            { field: 'department', label: 'Department',  placeholder: 'e.g. Computer Science' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} style={styles.fieldGroup}>
              <label htmlFor={`add-student-${field}`} style={styles.label}>{label} *</label>
              <input
                id={`add-student-${field}`}
                name={field}
                value={form[field]}
                onChange={handleChange}
                placeholder={placeholder}
                style={{ ...styles.input, ...(errors[field] ? styles.inputError : {}) }}
                aria-invalid={!!errors[field]}
                aria-describedby={errors[field] ? `add-student-${field}-error` : undefined}
              />
              {errors[field] && (
                <span id={`add-student-${field}-error`} style={styles.fieldError} role="alert">
                  {errors[field]}
                </span>
              )}
            </div>
          ))}

          <div style={styles.fieldGroup}>
            <label htmlFor="add-student-photo" style={styles.label}>Photo URL (optional)</label>
            <input
              id="add-student-photo"
              name="photo"
              value={form.photo}
              onChange={handleChange}
              placeholder="https://..."
              style={styles.input}
            />
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay:     { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:  { margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  closeBtn:    { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888', padding: '4px 8px', borderRadius: '4px' },
  apiError:    { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '14px', color: '#856404' },
  fieldGroup:  { marginBottom: '16px' },
  label:       { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#444' },
  input:       { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  inputError:  { borderColor: '#e53935' },
  fieldError:  { display: 'block', marginTop: '4px', fontSize: '12px', color: '#e53935' },
  actions:     { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
  cancelBtn:   { padding: '9px 20px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  submitBtn:   { padding: '9px 20px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
}
