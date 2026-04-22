import { useState, useEffect } from 'react'
import API from '../api/axios'
import AASTUHeader from '../components/AASTUHeader'
import AASTUFooter from '../components/AASTUFooter'

const BASE_URL = 'http://localhost:5000'

function verificationBadgeStyle(status) {
  switch (status) {
    case 'VERIFIED': return { backgroundColor: '#e6ffed', color: '#2e7d32' }
    case 'BLOCKED':  return { backgroundColor: '#fff0f0', color: '#c62828' }
    default:         return { backgroundColor: '#fff8e1', color: '#e65100' }
  }
}

function verificationBadgeLabel(status) {
  switch (status) {
    case 'VERIFIED': return '✅ Verified'
    case 'BLOCKED':  return '🚫 Blocked'
    default:         return '⏳ Pending Verification'
  }
}

export default function StudentDashboard() {
  const [laptops, setLaptops] = useState([])
  const [form, setForm] = useState({ serialNumber: '', brand: '', model: '', photo: null })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrImage, setQrImage] = useState(null)
  const [qrCodeNumber, setQrCodeNumber] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [regenerating, setRegenerating] = useState(null)
  const [regenResult, setRegenResult] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editPhotoPreview, setEditPhotoPreview] = useState(null)

  useEffect(() => { fetchLaptops() }, [])

  const fetchLaptops = async () => {
    try {
      const res = await API.get('/laptops/my')
      setLaptops(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setQrImage(null)
    setQrCodeNumber('')
    try {
      const formData = new FormData()
      formData.append('serialNumber', form.serialNumber)
      formData.append('brand', form.brand)
      formData.append('model', form.model)
      if (form.photo) formData.append('photo', form.photo)
      const res = await API.post('/laptops/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSuccess('Laptop registered successfully!')
      setQrImage(res.data.qrImage)
      setQrCodeNumber(res.data.qrCodeNumber)
      setForm({ serialNumber: '', brand: '', model: '', photo: null })
      setPhotoPreview(null)
      fetchLaptops()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register laptop')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateCode = async (laptopId) => {
    setRegenerating(laptopId)
    try {
      const res = await API.post(`/laptops/${laptopId}/regenerate-code`)
      setRegenResult(prev => ({ ...prev, [laptopId]: res.data }))
      fetchLaptops()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regenerate code')
    } finally {
      setRegenerating(null)
    }
  }

  const startEdit = (laptop) => {
    setEditingId(laptop.id)
    setEditForm({ serialNumber: laptop.serial_number, brand: laptop.brand, model: laptop.model, photo: null })
    setEditPhotoPreview(null)
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPhotoPreview(null)
    setEditError('')
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const formData = new FormData()
      formData.append('serialNumber', editForm.serialNumber)
      formData.append('brand', editForm.brand)
      formData.append('model', editForm.model)
      if (editForm.photo) formData.append('photo', editForm.photo)
      await API.put(`/laptops/${editingId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setEditingId(null)
      setEditPhotoPreview(null)
      fetchLaptops()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update laptop')
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <AASTUHeader subtitle="Student Portal" />

      <div style={styles.main} className="fade-in">
        <div style={styles.content}>

          {/* ── Register form ── */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Register a Laptop</h2>
            {error && <div style={styles.error}>{error}</div>}
            {success && <div style={styles.success}>{success}</div>}

            <form onSubmit={handleRegister}>
              <div style={styles.field}>
                <label style={styles.label}>Serial Number</label>
                <input style={styles.input} placeholder="e.g. SN-DELL-001"
                  value={form.serialNumber}
                  onChange={e => setForm({ ...form, serialNumber: e.target.value })} required />
              </div>
              <div style={styles.row}>
                <div style={{ ...styles.field, flex: 1 }}>
                  <label style={styles.label}>Brand</label>
                  <input style={styles.input} placeholder="e.g. Dell"
                    value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })} required />
                </div>
                <div style={{ ...styles.field, flex: 1 }}>
                  <label style={styles.label}>Model</label>
                  <input style={styles.input} placeholder="e.g. Latitude 5520"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })} required />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Laptop Photo (Mandatory)</label>
                <input type="file" accept="image/*" style={styles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) { setForm({ ...form, photo: file }); setPhotoPreview(URL.createObjectURL(file)) }
                  }} />
                {photoPreview && (
                  <div style={styles.photoPreview}>
                    <img src={photoPreview} alt="Preview" style={styles.previewImage} />
                    <button type="button" style={styles.removePhotoBtn}
                      onClick={() => { setForm({ ...form, photo: null }); setPhotoPreview(null) }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Register Laptop'}
              </button>
            </form>

            {qrImage && (
              <div style={styles.qrContainer}>
                <p style={styles.qrText}>📱 Print this QR code and stick it on your laptop</p>
                <img src={qrImage} alt="QR Code" style={styles.qrImage} />
                <div style={styles.numberBox}>
                  <div style={styles.numberLabel}>📢 If scanner doesn't work, tell guard this number:</div>
                  <div style={styles.bigNumber}>{qrCodeNumber}</div>
                  <div style={styles.numberHint}>Guard can type these 8 digits into the system</div>
                </div>
                <a href={qrImage} download="laptop-qr.png">
                  <button style={styles.downloadBtn}>Download QR Code</button>
                </a>
              </div>
            )}
          </div>

          {/* ── My Laptops ── */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>My Laptops ({laptops.length})</h2>
            {laptops.length === 0 ? (
              <p style={styles.empty}>No laptops registered yet.</p>
            ) : (
              laptops.map(laptop => (
                <div key={laptop.id}>
                  {/* ── Laptop row ── */}
                  <div style={styles.laptopItem}>
                    <div style={styles.laptopPhotoWrap}>
                      {laptop.photo_url
                        ? <img src={`${BASE_URL}${laptop.photo_url}`} alt={laptop.brand} style={styles.laptopPhoto} />
                        : <div style={styles.noPhoto}>📷</div>}
                    </div>

                    <div style={styles.laptopInfo}>
                      <span style={styles.laptopName}>{laptop.brand} {laptop.model}</span>
                      <span style={styles.laptopSerial}>Serial: {laptop.serial_number}</span>
                      {regenResult[laptop.id] ? (
                        <div style={styles.regenBox}>
                          <span style={styles.laptopCode}>New Code: {regenResult[laptop.id].qrCodeNumber}</span>
                          <img src={regenResult[laptop.id].qrImage} alt="QR" style={styles.miniQr} />
                          <a href={regenResult[laptop.id].qrImage} download="laptop-qr.png" style={styles.dlLink}>Download QR</a>
                        </div>
                      ) : (
                        laptop.qr_code && <span style={styles.laptopCode}>Code: {laptop.qr_code}</span>
                      )}
                      <div style={styles.actionRow}>
                        <button style={styles.regenBtn}
                          onClick={() => handleRegenerateCode(laptop.id)}
                          disabled={regenerating === laptop.id}>
                          {regenerating === laptop.id ? 'Regenerating...' : '🔄 Lost code? Get new one'}
                        </button>
                        <button style={styles.editBtn}
                          onClick={() => editingId === laptop.id ? cancelEdit() : startEdit(laptop)}>
                          {editingId === laptop.id ? '✕ Cancel' : '✏️ Edit Laptop'}
                        </button>
                      </div>
                    </div>

                    <div style={styles.badgeGroup}>
                      <span style={{ ...styles.badge, ...verificationBadgeStyle(laptop.verification_status) }}>
                        {verificationBadgeLabel(laptop.verification_status)}
                      </span>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: laptop.is_in_campus ? '#e6ffed' : '#fff0f0',
                        color: laptop.is_in_campus ? '#2e7d32' : '#c62828',
                      }}>
                        {laptop.is_in_campus ? '✅ On Campus' : '🏠 Off Campus'}
                      </span>
                    </div>
                  </div>

                  {/* ── Inline edit form ── */}
                  {editingId === laptop.id && (
                    <div style={styles.editPanel}>
                      <p style={styles.editWarning}>
                        ⚠️ Editing this laptop will reset its verification status to <strong>Pending</strong>. A guard will need to re-verify it before campus entry is allowed.
                      </p>
                      {editError && <div style={styles.error}>{editError}</div>}
                      <form onSubmit={handleEdit}>
                        <div style={styles.row}>
                          <div style={{ ...styles.field, flex: 1 }}>
                            <label style={styles.label}>Serial Number</label>
                            <input style={styles.input} value={editForm.serialNumber}
                              onChange={e => setEditForm({ ...editForm, serialNumber: e.target.value })} required />
                          </div>
                          <div style={{ ...styles.field, flex: 1 }}>
                            <label style={styles.label}>Brand</label>
                            <input style={styles.input} value={editForm.brand}
                              onChange={e => setEditForm({ ...editForm, brand: e.target.value })} required />
                          </div>
                          <div style={{ ...styles.field, flex: 1 }}>
                            <label style={styles.label}>Model</label>
                            <input style={styles.input} value={editForm.model}
                              onChange={e => setEditForm({ ...editForm, model: e.target.value })} required />
                          </div>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Replace Photo (optional)</label>
                          <input type="file" accept="image/*" style={styles.fileInput}
                            onChange={(e) => {
                              const file = e.target.files[0]
                              if (file) { setEditForm({ ...editForm, photo: file }); setEditPhotoPreview(URL.createObjectURL(file)) }
                            }} />
                          {editPhotoPreview && (
                            <div style={styles.photoPreview}>
                              <img src={editPhotoPreview} alt="Preview" style={styles.previewImage} />
                            </div>
                          )}
                        </div>
                        <div style={styles.editActions}>
                          <button type="submit" style={styles.saveBtn} disabled={editLoading}>
                            {editLoading ? 'Saving...' : '💾 Save Changes'}
                          </button>
                          <button type="button" style={styles.cancelBtn} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      <AASTUFooter />
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  content: { maxWidth: '900px', margin: '32px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  cardTitle: { margin: '0 0 24px', fontSize: '20px', fontWeight: '700', color: '#0033A0', borderLeft: '4px solid #FFD700', paddingLeft: '16px' },
  error: { backgroundColor: '#fff0f0', color: '#e53e3e', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' },
  success: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' },
  field: { marginBottom: '16px' },
  row: { display: 'flex', gap: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  fileInput: { width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid #e0e0e0', fontSize: '14px' },
  button: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  qrContainer: { marginTop: '24px', textAlign: 'center', padding: '24px', backgroundColor: '#f8f9fa', borderRadius: '12px' },
  qrText: { margin: '0 0 16px', fontSize: '14px', color: '#555' },
  qrImage: { width: '200px', height: '200px', display: 'block', margin: '0 auto 16px' },
  downloadBtn: { padding: '10px 24px', background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  empty: { color: '#888', fontSize: '14px', textAlign: 'center', padding: '40px 0' },
  laptopItem: { display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '12px', marginBottom: '8px' },
  laptopPhotoWrap: { marginRight: '16px', flexShrink: 0 },
  laptopPhoto: { width: '60px', height: '60px', objectFit: 'cover', borderRadius: '10px' },
  noPhoto: { width: '60px', height: '60px', borderRadius: '10px', backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' },
  laptopInfo: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  laptopName: { fontSize: '16px', fontWeight: '600', color: '#0033A0' },
  laptopSerial: { fontSize: '13px', color: '#666' },
  laptopCode: { fontSize: '12px', color: '#f57c00', fontFamily: 'monospace', fontWeight: 'bold' },
  actionRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' },
  regenBtn: { padding: '6px 12px', backgroundColor: '#fff8e1', color: '#e65100', border: '1px solid #FFD700', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  editBtn: { padding: '6px 12px', backgroundColor: '#e8f0fe', color: '#0033A0', border: '1px solid #0033A0', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  badgeGroup: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 },
  badge: { padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  regenBox: { display: 'flex', flexDirection: 'column', gap: '4px' },
  miniQr: { width: '80px', height: '80px' },
  dlLink: { fontSize: '11px', color: '#0033A0' },
  numberBox: { marginTop: '20px', padding: '20px', backgroundColor: '#fff8e1', borderRadius: '12px', textAlign: 'center', border: '2px solid #FFD700' },
  numberLabel: { fontSize: '13px', color: '#e65100', marginBottom: '12px', fontWeight: '500' },
  bigNumber: { fontSize: '56px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', letterSpacing: '8px', color: '#0033A0', marginBottom: '10px' },
  numberHint: { fontSize: '12px', color: '#666' },
  photoPreview: { marginTop: '12px', textAlign: 'center' },
  previewImage: { maxWidth: '200px', maxHeight: '200px', borderRadius: '10px', marginBottom: '8px' },
  removePhotoBtn: { padding: '6px 14px', backgroundColor: '#ff4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  editPanel: { backgroundColor: '#f0f4ff', border: '1px solid #c5d3f5', borderRadius: '12px', padding: '20px', marginBottom: '12px' },
  editWarning: { backgroundColor: '#fff8e1', border: '1px solid #FFD700', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#7a5c00', marginBottom: '16px' },
  editActions: { display: 'flex', gap: '12px' },
  saveBtn: { padding: '10px 24px', background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  cancelBtn: { padding: '10px 24px', backgroundColor: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
}
