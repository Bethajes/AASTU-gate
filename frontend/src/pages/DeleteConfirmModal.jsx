import { useState } from 'react'
import API from '../api/axios'

export default function DeleteConfirmModal({ student, onSuccess, onClose }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState(null)

  const handleConfirm = async () => {
    setDeleting(true)
    setError(null)
    try {
      await API.delete(`/students/${student.id}`)
      onSuccess(student.id)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to delete student. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 id="delete-confirm-title" style={styles.modalTitle}>Delete Student</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={deleting}>✕</button>
        </div>

        <p style={styles.message}>
          Are you sure you want to delete{' '}
          <strong>{student.name}</strong>
          {student.id ? ` (${student.id})` : ''}?
          This action cannot be undone.
        </p>

        {error && (
          <div style={styles.errorBox} role="alert">{error}</div>
        )}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button style={styles.deleteBtn} onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay:     { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle:  { margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  closeBtn:    { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888', padding: '4px 8px', borderRadius: '4px' },
  message:     { fontSize: '14px', color: '#444', marginBottom: '20px', lineHeight: 1.6 },
  errorBox:    { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '14px', color: '#856404' },
  actions:     { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  cancelBtn:   { padding: '9px 20px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  deleteBtn:   { padding: '9px 20px', backgroundColor: '#e53935', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
}
