import { useRef, useState } from 'react'
import API from '../api/axios'

const ACCEPTED_TYPES = '.zip'

export default function BulkPhotoUploadModal({ onSuccess, onClose }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    setSummary(null)
    setError(null)
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.zip')) {
      setFile(null)
      setError('Only .zip files are supported.')
      return
    }
    setFile(selected)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Choose a ZIP file first.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('photos', file)
      const res = await API.post('/students/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSummary(res.data)
      onSuccess()
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to upload student photos.')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setError(null)
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="bulk-photo-title">
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 id="bulk-photo-title" style={styles.modalTitle}>Upload Student Photos</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={uploading}>✕</button>
        </div>

        <p style={styles.hint}>
          Upload a <strong>.zip</strong> containing image files named by username:
          <code style={styles.code}> ETS02315.jpg</code>
        </p>

        <label style={styles.fileLabel} htmlFor="bulk-photo-input">
          🖼️ Choose ZIP
        </label>
        <input
          id="bulk-photo-input"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          style={styles.fileInput}
          aria-label="Choose student photo ZIP"
        />

        {file && <p style={styles.fileName}>{file.name}</p>}
        {error && <div style={styles.errorBox} role="alert">{error}</div>}

        {summary && (
          <div style={styles.summaryBox} role="status">
            <p style={styles.summaryLine}><strong>{summary.matched}</strong> photo{summary.matched !== 1 ? 's' : ''} matched and saved</p>
            <p style={styles.summaryLine}>{summary.skippedUnmatched} unmatched, {summary.skippedNonImage} non-image, {summary.skippedDuplicate} duplicate, {summary.failed} failed</p>
            {summary.skipped?.length > 0 && (
              <p style={styles.smallNote}>
                First skipped: {summary.skipped.slice(0, 5).map(item => `${item.file} (${item.reason})`).join(', ')}
              </p>
            )}
          </div>
        )}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={summary ? reset : onClose} disabled={uploading}>
            {summary ? 'Upload Another' : 'Cancel'}
          </button>
          <button style={styles.submitBtn} onClick={summary ? onClose : handleUpload} disabled={uploading || (!file && !summary)}>
            {summary ? 'Done' : uploading ? 'Uploading...' : 'Upload Photos'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay:     { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '560px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:  { margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  closeBtn:    { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888', padding: '4px 8px', borderRadius: '4px' },
  hint:        { fontSize: '14px', color: '#555', marginBottom: '16px', lineHeight: 1.6 },
  code:        { backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' },
  fileLabel:   { display: 'inline-block', padding: '9px 18px', backgroundColor: '#1a1a2e', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', marginBottom: '12px' },
  fileInput:   { display: 'none' },
  fileName:    { margin: '0 0 12px', fontSize: '13px', color: '#444' },
  errorBox:    { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '14px', color: '#856404' },
  summaryBox:  { backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px', marginTop: '12px' },
  summaryLine: { margin: '4px 0', fontSize: '14px', color: '#333' },
  smallNote:   { margin: '8px 0 0', fontSize: '12px', color: '#777', lineHeight: 1.5 },
  actions:     { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
  cancelBtn:   { padding: '9px 20px', backgroundColor: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  submitBtn:   { padding: '9px 20px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
}
