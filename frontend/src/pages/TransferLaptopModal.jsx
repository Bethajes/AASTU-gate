import { useState, useEffect, useMemo } from 'react'
import API from '../api/axios'

/**
 * TransferLaptopModal
 *
 * Props:
 *   laptop    – current laptop object (id, brand, model, serial_number, owner_name, student_id)
 *   onClose   – called when the modal should close without a transfer
 *   onSuccess – called after a successful transfer
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export default function TransferLaptopModal({ laptop, onClose, onSuccess }) {
  const [students, setStudents]       = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [apiError, setApiError]       = useState(null)
  const [success, setSuccess]         = useState(false)

  // Fetch the full student list once on mount (Requirement 2.2)
  useEffect(() => {
    let cancelled = false
    setLoadingStudents(true)
    API.get('/students')
      .then(res => {
        if (!cancelled) setStudents(res.data?.students ?? [])
      })
      .catch(() => {
        if (!cancelled) setStudents([])
      })
      .finally(() => {
        if (!cancelled) setLoadingStudents(false)
      })
    return () => { cancelled = true }
  }, [])

  // Filter students by name or student ID (Requirement 2.2)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return students.filter(s => {
      const name = (s.full_name ?? s.name ?? '').toLowerCase()
      const sid  = (s.student_id ?? s.id ?? '').toLowerCase()
      return name.includes(q) || sid.includes(q)
    })
  }, [students, searchQuery])

  const handleSelectStudent = (student) => {
    setSelectedStudent(student)
    setSearchQuery(student.full_name ?? student.name ?? '')
    setApiError(null)
  }

  // Execute the transfer (Requirement 2.3)
  const handleConfirm = async () => {
    if (!selectedStudent) return
    setSubmitting(true)
    setApiError(null)
    try {
      await API.post(`/laptops/${laptop.id}/transfer`, {
        targetStudentId: selectedStudent.student_id ?? selectedStudent.id,
      })
      setSuccess(true)
      onSuccess()
    } catch (err) {
      // Display error inline without closing the modal (Requirement 2.4)
      setApiError(err?.response?.data?.message ?? 'Transfer failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <h2 id="transfer-modal-title" style={s.title}>Transfer Laptop</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close" disabled={submitting}>✕</button>
        </div>

        {/* Laptop info (Requirement 2.1) */}
        <div style={s.laptopInfo}>
          <div style={s.laptopInfoRow}>
            <span style={s.infoLabel}>Device</span>
            <span style={s.infoValue}>{laptop.brand} {laptop.model}</span>
          </div>
          <div style={s.laptopInfoRow}>
            <span style={s.infoLabel}>Serial</span>
            <span style={{ ...s.infoValue, fontFamily: 'monospace' }}>{laptop.serial_number}</span>
          </div>
          <div style={s.laptopInfoRow}>
            <span style={s.infoLabel}>Current owner</span>
            <span style={s.infoValue}>
              {laptop.owner_name}
              {laptop.student_id ? <span style={s.studentIdBadge}>{laptop.student_id}</span> : null}
            </span>
          </div>
        </div>

        {/* Error banner (Requirement 2.4) */}
        {apiError && (
          <div style={s.apiError} role="alert">{apiError}</div>
        )}

        {/* Success message */}
        {success && (
          <div style={s.successMsg} role="status">
            ✅ Laptop transferred successfully.
          </div>
        )}

        {!success && (
          <>
            {/* Student search (Requirement 2.2) */}
            <div style={s.fieldGroup}>
              <label htmlFor="transfer-search" style={s.label}>Search for new owner</label>
              <input
                id="transfer-search"
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setSelectedStudent(null)
                  setApiError(null)
                }}
                placeholder="Type name or student ID…"
                style={s.input}
                autoComplete="off"
                disabled={submitting}
              />

              {/* Dropdown list of matching students */}
              {searchQuery.trim() && !selectedStudent && (
                <div style={s.dropdown} role="listbox" aria-label="Matching students">
                  {loadingStudents && (
                    <div style={s.dropdownItem}>Loading students…</div>
                  )}
                  {!loadingStudents && filteredStudents.length === 0 && (
                    <div style={s.dropdownItem}>No matching students found.</div>
                  )}
                  {!loadingStudents && filteredStudents.map(student => {
                    const sid  = student.student_id ?? student.id
                    const name = student.full_name ?? student.name
                    return (
                      <button
                        key={sid}
                        style={s.dropdownOption}
                        role="option"
                        onClick={() => handleSelectStudent(student)}
                        type="button"
                      >
                        <span style={s.optionName}>{name}</span>
                        <span style={s.optionId}>{sid}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected student confirmation */}
            {selectedStudent && (
              <div style={s.selectedBadge}>
                <span>Transferring to: </span>
                <strong>{selectedStudent.full_name ?? selectedStudent.name}</strong>
                <span style={s.studentIdBadge}>{selectedStudent.student_id ?? selectedStudent.id}</span>
                <button
                  type="button"
                  style={s.clearBtn}
                  onClick={() => { setSelectedStudent(null); setSearchQuery('') }}
                  disabled={submitting}
                  aria-label="Clear selection"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Actions */}
            <div style={s.actions}>
              <button style={s.cancelBtn} type="button" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                style={{ ...s.confirmBtn, opacity: (!selectedStudent || submitting) ? 0.6 : 1 }}
                type="button"
                onClick={handleConfirm}
                disabled={!selectedStudent || submitting}
              >
                {submitting ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 12, padding: '28px',
    width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    maxHeight: '90vh', overflowY: 'auto', position: 'relative',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: '#1a1a2e' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#888', padding: '4px 8px', borderRadius: 4,
  },
  laptopInfo: {
    backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '14px 16px', marginBottom: 20,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  laptopInfoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 12, color: '#64748b', minWidth: 100, fontWeight: 500 },
  infoValue: { fontSize: 13, color: '#1a1a2e', fontWeight: 500 },
  studentIdBadge: {
    display: 'inline-block', marginLeft: 8,
    backgroundColor: '#e2e8f0', color: '#475569',
    borderRadius: 20, padding: '1px 8px', fontSize: 11, fontFamily: 'monospace',
  },
  apiError: {
    backgroundColor: '#fff3cd', border: '1px solid #ffc107',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16,
    fontSize: 13, color: '#856404',
  },
  successMsg: {
    backgroundColor: '#d1fae5', border: '1px solid #6ee7b7',
    borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#065f46',
  },
  fieldGroup: { marginBottom: 16, position: 'relative' },
  label: { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#444' },
  input: {
    display: 'block', width: '100%', padding: '9px 12px',
    border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 14,
    outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
    color: '#1a1a2e',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    zIndex: 10, maxHeight: 220, overflowY: 'auto', marginTop: 2,
  },
  dropdownItem: {
    padding: '10px 14px', fontSize: 13, color: '#94a3b8',
  },
  dropdownOption: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontSize: 13,
    borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s',
  },
  optionName: { color: '#1a1a2e', fontWeight: 500 },
  optionId: { color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 },
  selectedBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 8, padding: '10px 14px', marginBottom: 20,
    fontSize: 13, color: '#1e40af',
  },
  clearBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 4px',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: {
    padding: '9px 20px', backgroundColor: '#fff', color: '#444',
    border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 14,
  },
  confirmBtn: {
    padding: '9px 20px', backgroundColor: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
}
