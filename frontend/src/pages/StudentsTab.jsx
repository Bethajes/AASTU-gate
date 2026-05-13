import { useState, useEffect, useMemo, useCallback } from 'react'
import API from '../api/axios'
import StudentLaptopsPanel from './StudentLaptopsPanel'

const PAGE_SIZE = 20
const API_ORIGIN = (API.defaults?.baseURL || '').replace(/\/api\/?$/, '')

function studentPhotoUrl(photo) {
  if (!photo) return null
  if (/^https?:\/\//i.test(photo)) return photo
  const normalized = photo.startsWith('/') ? photo : `/${photo}`
  return `${API_ORIGIN}${normalized}`
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.confirmBox}>
        <p style={styles.confirmMsg}>{message}</p>
        <div style={styles.confirmActions}>
          <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={styles.deleteBtn} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null
  return (
    <div style={styles.pagination}>
      <span style={{ color: '#888', fontSize: 13 }}>
        {total} result{total !== 1 ? 's' : ''}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={styles.pageBtn} disabled={page === 1} onClick={() => onPage(p => p - 1)}>‹</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            style={{ ...styles.pageBtn, ...(n === page ? styles.pageBtnActive : {}) }}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button style={styles.pageBtn} disabled={page === totalPages} onClick={() => onPage(p => p + 1)}>›</button>
      </div>
    </div>
  )
}

// ─── StudentsTab ──────────────────────────────────────────────────────────────

export default function StudentsTab({ onUploadFile, onUploadPhotos }) {
  const [students, setStudents]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [selected, setSelected]   = useState(new Set())
  const [deleting, setDeleting]   = useState(false)
  const [confirm, setConfirm]     = useState(null) // { ids: Set, message: string }
  const [activeStudent, setActiveStudent] = useState(null) // student whose laptops panel is open

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await API.get('/students')
      setStudents(Array.isArray(res.data) ? res.data : (res.data.students ?? []))
      setSelected(new Set())
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return students
    return students.filter(s =>
      (s.student_id || s.id)?.toLowerCase().includes(q) ||
      s.username?.toLowerCase().includes(q) ||
      (s.full_name || s.name)?.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q)
    )
  }, [students, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearch = e => { setSearch(e.target.value); setPage(1) }

  // ── Selection helpers ──
  const toggleOne = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const allPageIds    = paginated.map(s => s.id)
  const allPageChecked = allPageIds.length > 0 && allPageIds.every(id => selected.has(id))
  const somePageChecked = allPageIds.some(id => selected.has(id))

  const togglePage = () => {
    if (allPageChecked) {
      setSelected(prev => { const n = new Set(prev); allPageIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); allPageIds.forEach(id => n.add(id)); return n })
    }
  }

  // ── Delete logic ──
  const executeDelete = async (ids) => {
    setDeleting(true)
    setConfirm(null)
    try {
      await Promise.all([...ids].map(id => API.delete(`/students/${encodeURIComponent(id)}`)))
      await fetchStudents()
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to delete student(s).')
    } finally {
      setDeleting(false)
    }
  }

  const askDeleteOne = (student) => {
    const name = student.full_name || student.name || student.id
    setConfirm({
      ids: new Set([student.id]),
      message: `Delete "${name}"? This cannot be undone.`,
    })
  }

  const askDeleteSelected = () => {
    setConfirm({
      ids: new Set(selected),
      message: `Delete ${selected.size} selected student${selected.size !== 1 ? 's' : ''}? This cannot be undone.`,
    })
  }

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>All Students</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={styles.searchInput}
            placeholder="Search by student ID, username, name, department…"
            value={search}
            onChange={handleSearch}
            aria-label="Search students"
          />
          {onUploadFile && (
            <button style={styles.secondaryBtn} onClick={onUploadFile}>
              📂 Upload File
            </button>
          )}
          {onUploadPhotos && (
            <button style={styles.secondaryBtn} onClick={onUploadPhotos}>
              🖼️ Upload Photos
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={styles.bulkBar}>
          <span style={{ fontSize: 13, color: '#555' }}>
            {selected.size} student{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={styles.clearBtn} onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
            <button
              style={styles.deleteBulkBtn}
              onClick={askDeleteSelected}
              disabled={deleting}
            >
              🗑 Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner} role="alert">
          <span>⚠️ {error}</span>
          <button style={styles.retryBtn} onClick={fetchStudents}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <p style={styles.empty}>Loading students…</p>}

      {/* Empty state */}
      {!loading && !error && students.length === 0 && (
        <p style={styles.empty}>No students have been added yet.</p>
      )}

      {/* No search results */}
      {!loading && !error && students.length > 0 && filtered.length === 0 && (
        <p style={styles.empty}>No results match your search.</p>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allPageChecked}
                      ref={el => { if (el) el.indeterminate = somePageChecked && !allPageChecked }}
                      onChange={togglePage}
                      aria-label="Select all on this page"
                    />
                  </th>
                  {['Photo', 'Student ID', 'Username', 'Name', 'Department', 'Status', 'Laptops', ''].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(student => (
                  <tr
                    key={student.id}
                    style={{
                      ...styles.tr,
                      backgroundColor: selected.has(student.id) ? '#f0f4ff' : undefined,
                    }}
                  >
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selected.has(student.id)}
                        onChange={() => toggleOne(student.id)}
                        aria-label={`Select ${student.full_name || student.name}`}
                      />
                    </td>
                    <td style={styles.td}>
                      {student.photo ? (
                        <img
                          src={studentPhotoUrl(student.photo)}
                          alt={`${student.full_name || student.name} profile`}
                          style={styles.photo}
                        />
                      ) : (
                        <span style={styles.photoPlaceholder}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>{student.student_id || student.id}</td>
                    <td style={styles.td}>{student.username}</td>
                    <td style={styles.td}>{student.full_name || student.name}</td>
                    <td style={styles.td}>{student.department}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: student.isActivated ? '#e6ffed' : '#fff8e1',
                        color:           student.isActivated ? '#2e7d32' : '#e65100',
                      }}>
                        {student.isActivated ? '✅ Activated' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button
                        style={styles.laptopBtn}
                        onClick={() => setActiveStudent(student)}
                        title="View & manage laptops"
                        aria-label={`View laptops for ${student.full_name || student.name}`}
                      >
                        💻
                      </button>
                      <button
                        style={styles.rowDeleteBtn}
                        onClick={() => askDeleteOne(student)}
                        disabled={deleting}
                        aria-label={`Delete ${student.full_name || student.name}`}
                        title="Delete student"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
        </>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => executeDelete(confirm.ids)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Student laptops panel */}
      {activeStudent && (
        <StudentLaptopsPanel
          student={activeStudent}
          onClose={() => setActiveStudent(null)}
        />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  card:           { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  cardHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: 12 },
  cardTitle:      { margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  searchInput:    { padding: '7px 12px', border: '1.5px solid #94a3b8', borderRadius: '8px', fontSize: '13px', outline: 'none', minWidth: 260, background: '#fff', color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  secondaryBtn:   { padding: '8px 16px', backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' },
  bulkBar:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f4ff', border: '1px solid #c7d7ff', borderRadius: '8px', padding: '10px 16px', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  clearBtn:       { padding: '6px 12px', backgroundColor: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  deleteBulkBtn:  { padding: '6px 14px', backgroundColor: '#e53935', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  errorBanner:    { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  retryBtn:       { padding: '6px 12px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tableWrapper:   { overflowX: 'auto' },
  table:          { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th:             { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #eee', color: '#555', fontWeight: '600', fontSize: '13px' },
  tr:             { borderBottom: '1px solid #f0f0f0' },
  td:             { padding: '10px 12px', color: '#333' },
  photo:          { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '1px solid #eee', backgroundColor: '#f7f7f7' },
  photoPlaceholder: { color: '#aaa', fontSize: '14px' },
  badge:          { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', display: 'inline-block' },
  rowDeleteBtn:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px 6px', borderRadius: '6px', opacity: 0.6, transition: 'opacity 0.15s' },
  laptopBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px 6px', borderRadius: '6px', opacity: 0.7, marginRight: 4 },
  empty:          { textAlign: 'center', color: '#888', padding: '40px 0' },
  pagination:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' },
  pageBtn:        { padding: '5px 10px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', backgroundColor: '#fff', color: '#444' },
  pageBtnActive:  { backgroundColor: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  // confirm dialog
  overlay:        { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  confirmBox:     { backgroundColor: '#fff', borderRadius: '12px', padding: '28px 32px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  confirmMsg:     { fontSize: '15px', color: '#1a1a2e', marginBottom: 24, lineHeight: 1.5 },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn:      { padding: '8px 20px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  deleteBtn:      { padding: '8px 20px', backgroundColor: '#e53935', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
}
