import { useState, useRef } from 'react'
import API from '../api/axios'
import { parseFile } from '../utils/parseStudentFile'

const ACCEPTED_TYPES = '.csv,.xlsx'

// ─── Pure import logic (exported for testing) ─────────────────────────────────

/**
 * Sends one POST /students request per valid row.
 * Returns { succeeded, failed, failedIds }.
 *
 * @param {object[]} rows - valid student rows from parseFile
 * @param {function} postFn - async (row) => void, throws on failure
 * @returns {Promise<{ succeeded: number, failed: number, failedIds: string[] }>}
 */
export async function importRows(rows, postFn) {
  let succeeded = 0
  const failedIds = []
  for (const row of rows) {
    try {
      await postFn(row)
      succeeded++
    } catch {
      failedIds.push(row.id)
    }
  }
  return { succeeded, failed: failedIds.length, failedIds }
}

// ─── BulkUploadModal ──────────────────────────────────────────────────────────

export default function BulkUploadModal({ onSuccess, onClose }) {
  const [step, setStep]         = useState('pick')   // 'pick' | 'preview' | 'summary'
  const [parsedRows, setParsedRows] = useState([])
  const [skipped, setSkipped]   = useState(0)
  const [parseError, setParseError] = useState(null)
  const [importing, setImporting]   = useState(false)
  const [summary, setSummary]   = useState(null)     // { succeeded, failed, failedIds }
  const fileInputRef = useRef(null)

  // ── Step 1: file selected ──────────────────────────────────────────────────

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      setParseError('Only .csv and .xlsx files are supported.')
      return
    }

    setParseError(null)
    try {
      const { rows, skipped: sk } = await parseFile(file)
      setParsedRows(rows)
      setSkipped(sk)
      setStep('preview')
    } catch {
      setParseError('Could not parse file. Check the format and try again.')
    }
  }

  // ── Step 2: confirm import ─────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true)
    const result = await importRows(parsedRows, (row) => API.post('/students', row))
    setSummary(result)
    setStep('summary')
    setImporting(false)
    onSuccess()
  }

  // ── Step 3: reset ──────────────────────────────────────────────────────────

  const handleReset = () => {
    setParsedRows([])
    setSkipped(0)
    setParseError(null)
    setSummary(null)
    setStep('pick')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="bulk-upload-title">
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 id="bulk-upload-title" style={styles.modalTitle}>Bulk Upload Students</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={importing}>✕</button>
        </div>

        {/* ── Step: pick ── */}
        {step === 'pick' && (
          <div>
            <p style={styles.hint}>
              Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file with columns:
              <code style={styles.code}> student_id, full_name, department, photo (optional)</code>
            </p>

            <label style={styles.fileLabel} htmlFor="bulk-file-input">
              📂 Choose File
            </label>
            <input
              id="bulk-file-input"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileChange}
              style={styles.fileInput}
              aria-label="Choose CSV or Excel file"
            />

            {parseError && (
              <div style={styles.errorBox} role="alert">{parseError}</div>
            )}

            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Step: preview ── */}
        {step === 'preview' && (
          <div>
            <p style={styles.hint}>
              <strong>{parsedRows.length}</strong> row{parsedRows.length !== 1 ? 's' : ''} ready to import.
              {skipped > 0 && (
                <span style={styles.skippedNote}> {skipped} row{skipped !== 1 ? 's' : ''} skipped (missing required fields).</span>
              )}
            </p>

            {parsedRows.length > 0 && (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Student ID', 'Username', 'Full Name', 'Department', 'Photo'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} style={styles.tr}>
                        <td style={styles.td}>{row.id}</td>
                        <td style={styles.td}>{row.username}</td>
                        <td style={styles.td}>{row.name}</td>
                        <td style={styles.td}>{row.department}</td>
                        <td style={styles.td}>{row.photo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && (
                  <p style={styles.moreNote}>…and {parsedRows.length - 10} more rows</p>
                )}
              </div>
            )}

            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={handleReset} disabled={importing}>Back</button>
              <button
                style={styles.submitBtn}
                onClick={handleImport}
                disabled={importing || parsedRows.length === 0}
              >
                {importing ? 'Importing…' : `Import ${parsedRows.length} Student${parsedRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: summary ── */}
        {step === 'summary' && summary && (
          <div>
            <div style={styles.summaryBox} role="status">
              <p style={styles.summaryLine}>
                ✅ <strong>{summary.succeeded}</strong> student{summary.succeeded !== 1 ? 's' : ''} added
              </p>
              {summary.failed > 0 && (
                <>
                  <p style={styles.summaryLine}>
                    ❌ <strong>{summary.failed}</strong> failed
                  </p>
                  <p style={{ ...styles.summaryLine, fontSize: 12, color: '#888' }}>
                    Failed IDs: {summary.failedIds.join(', ')}
                  </p>
                </>
              )}
            </div>

            <div style={styles.actions}>
              <button style={styles.submitBtn} onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay:      { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '560px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  closeBtn:     { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888', padding: '4px 8px', borderRadius: '4px' },
  hint:         { fontSize: '14px', color: '#555', marginBottom: '16px', lineHeight: 1.6 },
  code:         { backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' },
  fileLabel:    { display: 'inline-block', padding: '9px 18px', backgroundColor: '#1a1a2e', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', marginBottom: '12px' },
  fileInput:    { display: 'none' },
  errorBox:     { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '14px', color: '#856404' },
  skippedNote:  { color: '#e65100', marginLeft: '4px' },
  tableWrapper: { overflowX: 'auto', marginBottom: '16px', border: '1px solid #eee', borderRadius: '8px' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:           { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #eee', color: '#555', fontWeight: '600', backgroundColor: '#fafafa' },
  tr:           { borderBottom: '1px solid #f0f0f0' },
  td:           { padding: '8px 10px', color: '#333', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  moreNote:     { textAlign: 'center', color: '#888', fontSize: '12px', padding: '8px 0', margin: 0 },
  actions:      { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
  cancelBtn:    { padding: '9px 20px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  submitBtn:    { padding: '9px 20px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  summaryBox:   { backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px', marginBottom: '8px' },
  summaryLine:  { margin: '4px 0', fontSize: '15px', color: '#333' },
}
