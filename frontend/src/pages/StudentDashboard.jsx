import { useState, useEffect } from 'react'
import API from '../api/axios'
import AASTUHeader from '../components/AASTUHeader'
import AASTUFooter from '../components/AASTUFooter'

const BASE_URL = 'http://localhost:5001'

/* ─── brand tokens ─── */
const C = {
  navy:    '#0033A0',
  navyDk:  '#002080',
  gold:    '#F9A825',
  goldLt:  '#FFF8E1',
  green:   '#2E7D32',
  red:     '#C62828',
  orange:  '#E65100',
  surface: '#F4F6FB',
  white:   '#FFFFFF',
  border:  '#E2E8F4',
  text:    '#1A2340',
  muted:   '#6B7A99',
}

/* ─── helpers ─── */
function vBadge(s) {
  const map = {
    VERIFIED: { bg:'#E6FFF0', color:C.green,  icon:'✔', label:'Verified'  },
    BLOCKED:  { bg:'#FFF0F0', color:C.red,    icon:'✖', label:'Blocked'   },
  }
  return map[s] ?? { bg:'#FFF8E1', color:C.orange, icon:'⏳', label:'Pending' }
}

function sBadge(s) {
  const map = {
    STOLEN: { bg:'#FFEBEE', color:C.red,    border:'#FFCDD2', icon:'🚨', label:'Stolen'  },
    LOST:   { bg:'#FFF8E1', color:'#8A5A00', border:C.gold,  icon:'⚠️', label:'Lost'    },
  }
  return map[s] ?? { bg:'#E8F5E9', color:C.green, border:'#A5D6A7', icon:'●', label:'Active' }
}

/* ─── tiny sub-components ─── */
function Chip({ bg, color, border, icon, label }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700,
      background:bg, color, border:`1px solid ${border ?? bg}`,
      letterSpacing:.3, whiteSpace:'nowrap',
    }}>
      <span style={{fontSize:10}}>{icon}</span>{label}
    </span>
  )
}

function Alert({ type, children }) {
  const cfg = type === 'error'
    ? { bg:'#FFF0F0', color:C.red,   border:'#FFCDD2', icon:'✖' }
    : { bg:'#E8F5E9', color:C.green, border:'#A5D6A7', icon:'✔' }
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:10,
      background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
      borderRadius:10, padding:'12px 16px', fontSize:13.5, fontWeight:500,
      marginBottom:18, lineHeight:1.5,
      animation:'fadeSlide .3s ease',
    }}>
      <span style={{
        width:22, height:22, borderRadius:'50%', background:cfg.color, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, flexShrink:0, marginTop:1,
      }}>{cfg.icon}</span>
      <span>{children}</span>
    </div>
  )
}

function ActionBtn({ onClick, disabled, variant='default', children }) {
  const vars = {
    default: { bg:'#EEF2FF', color:C.navy,    border:`1px solid #C7D2FE` },
    gold:    { bg:C.goldLt,  color:C.orange,  border:`1px solid #FFD700` },
    danger:  { bg:'#FFF0F0', color:C.red,     border:`1px solid #FFCDD2` },
    success: { bg:'#E8F5E9', color:C.green,   border:`1px solid #A5D6A7` },
  }
  const v = vars[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:'7px 13px', borderRadius:8, fontSize:12, fontWeight:700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        transition:'all .18s',
        background: v.bg, color: v.color, border: v.border,
        whiteSpace:'nowrap',
      }}
    >{children}</button>
  )
}

/* ─── drag-drop upload zone ─── */
function PhotoUpload({ preview, onChange, onRemove, label='Laptop Photo (Mandatory)' }) {
  const [drag, setDrag] = useState(false)
  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onChange(file)
  }
  return (
    <div style={{ marginBottom:18 }}>
      <label style={ls.label}>{label}</label>
      {preview ? (
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:C.surface, borderRadius:12, border:`1px solid ${C.border}` }}>
          <img src={preview} alt="preview" style={{ width:72, height:72, objectFit:'cover', borderRadius:10, border:`2px solid ${C.border}` }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Photo selected</div>
            <div style={{ fontSize:12, color:C.muted }}>Looking good! Ready to register.</div>
          </div>
          <button onClick={onRemove} style={{ padding:'6px 14px', background:'#FFEBEE', color:C.red, border:`1px solid #FFCDD2`, borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>Remove</button>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
            padding:'28px 20px', borderRadius:14,
            border:`2px dashed ${drag ? C.navy : C.border}`,
            background: drag ? '#EEF2FF' : C.surface,
            cursor:'pointer', transition:'all .2s', textAlign:'center',
          }}
        >
          <div style={{ fontSize:32, lineHeight:1 }}>💻</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Drag & drop a photo here</div>
          <div style={{ fontSize:12, color:C.muted }}>or click to browse — JPG, PNG accepted</div>
          <input type="file" accept="image/*" style={{ display:'none' }}
            onChange={(e) => { const f = e.target.files[0]; if (f) onChange(f) }} />
        </label>
      )}
    </div>
  )
}

/* ─── step progress ─── */
function StepBar({ step }) {
  const steps = ['Details','Photo','Confirm']
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:28 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display:'flex', alignItems:'center', flex: i < steps.length-1 ? 1 : 'none' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{
              width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:800,
              background: i < step ? C.green : i === step ? C.navy : '#E2E8F4',
              color: i <= step ? '#fff' : C.muted,
              transition:'all .3s',
              boxShadow: i === step ? `0 0 0 4px #C7D2FE` : 'none',
            }}>{i < step ? '✓' : i+1}</div>
            <span style={{ fontSize:11, fontWeight:600, color: i <= step ? C.navy : C.muted, whiteSpace:'nowrap' }}>{s}</span>
          </div>
          {i < steps.length-1 && (
            <div style={{ flex:1, height:2, background: i < step ? C.navy : '#E2E8F4', margin:'0 6px', marginBottom:18, transition:'all .3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── main ─── */
export default function StudentDashboard() {
  const [laptops,       setLaptops]       = useState([])
  const [form,          setForm]          = useState({ serialNumber:'', brand:'', model:'', photo:null })
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')
  const [loading,       setLoading]       = useState(false)
  const [qrImage,       setQrImage]       = useState(null)
  const [qrCodeNumber,  setQrCodeNumber]  = useState('')
  const [photoPreview,  setPhotoPreview]  = useState(null)
  const [regenerating,  setRegenerating]  = useState(null)
  const [regenResult,   setRegenResult]   = useState({})
  const [editingId,     setEditingId]     = useState(null)
  const [editForm,      setEditForm]      = useState({})
  const [editLoading,   setEditLoading]   = useState(false)
  const [editError,     setEditError]     = useState('')
  const [editPhotoPreview, setEditPhotoPreview] = useState(null)
  const [reportPanel,   setReportPanel]   = useState(null)
  const [reportComment, setReportComment] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [filter,        setFilter]        = useState('ALL')

  /* derive register step */
  const regStep = form.photo ? 2 : (form.serialNumber || form.brand || form.model) ? 1 : 0

  useEffect(() => { fetchLaptops() }, [])

  const fetchLaptops = async () => {
    try { const res = await API.get('/laptops/my'); setLaptops(res.data) }
    catch (err) { console.error(err) }
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess(''); setQrImage(null); setQrCodeNumber('')
    try {
      const fd = new FormData()
      fd.append('serialNumber', form.serialNumber)
      fd.append('brand', form.brand)
      fd.append('model', form.model)
      if (form.photo) fd.append('photo', form.photo)
      const res = await API.post('/laptops/register', fd, { headers:{'Content-Type':'multipart/form-data'} })
      setSuccess('Laptop registered successfully!')
      setQrImage(res.data.qrImage); setQrCodeNumber(res.data.qrCodeNumber)
      setForm({ serialNumber:'', brand:'', model:'', photo:null }); setPhotoPreview(null)
      fetchLaptops()
    } catch (err) { setError(err.response?.data?.message || 'Failed to register laptop') }
    finally { setLoading(false) }
  }

  const handleRegenerateCode = async (laptopId) => {
    setRegenerating(laptopId)
    try {
      const res = await API.post(`/laptops/${laptopId}/regenerate-code`)
      setRegenResult(prev => ({ ...prev, [laptopId]: res.data })); fetchLaptops()
    } catch (err) { alert(err.response?.data?.message || 'Failed to regenerate code') }
    finally { setRegenerating(null) }
  }

  const openReportPanel = (laptop, status) => { setReportPanel({ laptop, status }); setReportComment(''); setError(''); setSuccess('') }
  const closeReportPanel = () => { setReportPanel(null); setReportComment('') }

  const submitReportPanel = async (e) => {
    e.preventDefault()
    if (!reportPanel || !reportComment.trim()) return
    const { laptop, status } = reportPanel
    setReportSubmitting(true); setError(''); setSuccess('')
    try {
      if (status === 'FOUND') {
        await API.post(`/laptops/${laptop.id}/found`, { note: reportComment.trim() })
        setSuccess('Laptop marked active. Admins have been notified.')
      } else {
        await API.post(`/laptops/${laptop.id}/report-security-status`, { status, reason: reportComment.trim() })
        setSuccess(`${laptop.brand} ${laptop.model} marked as ${status.toLowerCase()}.`)
      }
      closeReportPanel(); fetchLaptops()
    } catch (err) { setError(err.response?.data?.message || 'Failed to submit report') }
    finally { setReportSubmitting(false) }
  }

  const startEdit = (laptop) => {
    setEditingId(laptop.id)
    setEditForm({ serialNumber: laptop.serial_number, brand: laptop.brand, model: laptop.model, photo: null })
    setEditPhotoPreview(null); setEditError('')
  }
  const cancelEdit = () => { setEditingId(null); setEditPhotoPreview(null); setEditError('') }

  const handleEdit = async (e) => {
    e.preventDefault(); setEditLoading(true); setEditError('')
    try {
      const fd = new FormData()
      fd.append('serialNumber', editForm.serialNumber)
      fd.append('brand', editForm.brand)
      fd.append('model', editForm.model)
      if (editForm.photo) fd.append('photo', editForm.photo)
      await API.put(`/laptops/${editingId}`, fd, { headers:{'Content-Type':'multipart/form-data'} })
      setEditingId(null); setEditPhotoPreview(null); fetchLaptops()
    } catch (err) { setEditError(err.response?.data?.message || 'Failed to update laptop') }
    finally { setEditLoading(false) }
  }

  /* filter */
  const filterOptions = ['ALL','ACTIVE','LOST','STOLEN','ON CAMPUS','OFF CAMPUS']
  const visibleLaptops = laptops.filter(l => {
    if (filter === 'ALL') return true
    if (filter === 'ACTIVE')     return (l.security_status || 'ACTIVE') === 'ACTIVE'
    if (filter === 'LOST')       return l.security_status === 'LOST'
    if (filter === 'STOLEN')     return l.security_status === 'STOLEN'
    if (filter === 'ON CAMPUS')  return l.is_in_campus
    if (filter === 'OFF CAMPUS') return !l.is_in_campus
    return true
  })

  return (
    <div style={{ minHeight:'100vh', background:C.surface, display:'flex', flexDirection:'column', fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@500&display=swap');
        @keyframes fadeSlide { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }
        @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.45} }
        .card-hover:hover { box-shadow: 0 8px 32px rgba(0,51,160,.12) !important; transform: translateY(-1px); }
        .btn-primary:hover { background: linear-gradient(135deg,${C.navyDk} 0%,${C.navy} 100%) !important; box-shadow: 0 6px 20px rgba(0,51,160,.35) !important; transform:translateY(-1px); }
        .btn-primary:active { transform:translateY(0); }
        .filter-chip:hover { background:${C.navy} !important; color:#fff !important; }
        input:focus,textarea:focus { border-color:${C.navy} !important; box-shadow:0 0 0 3px rgba(0,51,160,.12) !important; outline:none; }
        @media(max-width:640px){
          .reg-row { flex-direction:column !important; }
          .laptop-card-inner { flex-direction:column !important; align-items:stretch !important; }
          .badge-group { flex-direction:row !important; flex-wrap:wrap !important; justify-content:flex-start !important; }
          .action-row { display:grid !important; grid-template-columns:1fr 1fr !important; }
          .found-btn { grid-column:1/-1 !important; }
        }
      `}</style>

      <AASTUHeader subtitle="Student Portal" />

      <div style={{ flex:1, maxWidth:900, margin:'32px auto', padding:'0 20px', width:'100%', boxSizing:'border-box', display:'flex', flexDirection:'column', gap:24 }}>

        {/* ── Register form ── */}
        <div style={{ ...ls.card, animation:'fadeSlide .4s ease' }}>
          {/* header */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${C.navy},${C.navyDk})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>💻</div>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.navy }}>Register a Laptop</h2>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>Add your laptop to the campus security system</div>
            </div>
          </div>

          <StepBar step={regStep} />

          {error   && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <form onSubmit={handleRegister}>
            {/* Serial */}
            <div style={ls.field}>
              <label style={ls.label}>Serial Number</label>
              <input style={ls.input} placeholder="e.g. SN-DELL-001"
                value={form.serialNumber}
                onChange={e => setForm({...form, serialNumber:e.target.value})} required />
            </div>
            {/* Brand + Model */}
            <div style={{ display:'flex', gap:16 }} className="reg-row">
              <div style={{ ...ls.field, flex:1 }}>
                <label style={ls.label}>Brand</label>
                <input style={ls.input} placeholder="e.g. Dell, HP, Lenovo…"
                  value={form.brand}
                  onChange={e => setForm({...form, brand:e.target.value})} required />
              </div>
              <div style={{ ...ls.field, flex:1 }}>
                <label style={ls.label}>Model</label>
                <input style={ls.input} placeholder="e.g. Latitude 5520"
                  value={form.model}
                  onChange={e => setForm({...form, model:e.target.value})} required />
              </div>
            </div>
            {/* Photo */}
            <PhotoUpload
              preview={photoPreview}
              onChange={(file) => { setForm({...form, photo:file}); setPhotoPreview(URL.createObjectURL(file)) }}
              onRemove={() => { setForm({...form, photo:null}); setPhotoPreview(null) }}
            />
            <button type="submit" disabled={loading} className="btn-primary" style={ls.btnPrimary}>
              {loading
                ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <span style={{ width:16, height:16, border:`2px solid rgba(255,255,255,.4)`, borderTopColor:'#fff', borderRadius:'50%', animation:'spin 1s linear infinite', display:'inline-block' }} />
                    Registering…
                  </span>
                : '💾 Register Laptop'}
            </button>
          </form>

          {/* QR result */}
          {qrImage && (
            <div style={{ marginTop:24, background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:28, textAlign:'center', animation:'fadeSlide .4s ease' }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:4 }}>📱 Print & stick this QR on your laptop</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Guard will scan it at the gate for quick entry</div>
              <img src={qrImage} alt="QR Code" style={{ width:180, height:180, borderRadius:12, border:`3px solid ${C.border}`, display:'block', margin:'0 auto 20px' }} />
              <div style={{ background:C.goldLt, border:`2px solid ${C.gold}`, borderRadius:14, padding:'20px 24px', marginBottom:18 }}>
                <div style={{ fontSize:12, color:C.orange, fontWeight:600, marginBottom:10 }}>📢 If QR scanner fails, read out this code to the guard:</div>
                <div style={{ fontSize:48, fontWeight:800, fontFamily:"'DM Mono', monospace", color:C.navy, letterSpacing:10, margin:'4px 0 8px' }}>{qrCodeNumber}</div>
                <div style={{ fontSize:12, color:C.muted }}>Guard types these 8 digits into the system</div>
              </div>
              <a href={qrImage} download="laptop-qr.png">
                <button className="btn-primary" style={{ ...ls.btnPrimary, width:'auto', padding:'10px 28px', fontSize:14 }}>⬇ Download QR Code</button>
              </a>
            </div>
          )}
        </div>

        {/* ── My Laptops ── */}
        <div style={ls.card}>
          {/* header + filter */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${C.navy},${C.navyDk})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🗂</div>
              <div>
                <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.navy }}>My Laptops</h2>
                <div style={{ fontSize:13, color:C.muted }}>{laptops.length} device{laptops.length !== 1 ? 's' : ''} registered</div>
              </div>
            </div>
            {/* filter chips */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {filterOptions.map(f => (
                <button key={f} className="filter-chip" onClick={() => setFilter(f)} style={{
                  padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .18s',
                  background: filter === f ? C.navy : C.surface,
                  color:       filter === f ? '#fff'  : C.muted,
                  border:      filter === f ? `1px solid ${C.navy}` : `1px solid ${C.border}`,
                }}>{f}</button>
              ))}
            </div>
          </div>

          {visibleLaptops.length === 0 ? (
            <div style={{ textAlign:'center', padding:'50px 20px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:6 }}>
                {laptops.length === 0 ? 'No laptops registered yet' : 'No laptops match this filter'}
              </div>
              <div style={{ fontSize:13, color:C.muted }}>
                {laptops.length === 0 ? 'Use the form above to register your first device.' : 'Try a different filter above.'}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {visibleLaptops.map(laptop => {
                const vb = vBadge(laptop.verification_status)
                const sb = sBadge(laptop.security_status || 'ACTIVE')
                const rr = regenResult[laptop.id]
                return (
                  <div key={laptop.id}>
                    {/* ── card ── */}
                    <div className="card-hover" style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 20px', transition:'all .22s', overflow:'hidden' }}>
                      <div className="laptop-card-inner" style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
                        {/* photo */}
                        <div style={{ flexShrink:0 }}>
                          {laptop.photo_url
                            ? <img src={`${BASE_URL}${laptop.photo_url}`} alt={laptop.brand}
                                style={{ width:72, height:72, objectFit:'cover', borderRadius:12, border:`2px solid ${C.border}` }} />
                            : <div style={{ width:72, height:72, borderRadius:12, background:C.surface, border:`2px dashed ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>💻</div>
                          }
                        </div>

                        {/* info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:2 }}>{laptop.brand} {laptop.model}</div>
                          <div style={{ fontSize:12.5, color:C.muted, marginBottom:4 }}>Serial: {laptop.serial_number}</div>
                          {laptop.report_reason && laptop.security_status !== 'ACTIVE' && (
                            <div style={{ fontSize:12, color:'#8A5A00', fontWeight:600, background:C.goldLt, padding:'4px 10px', borderRadius:6, display:'inline-block', marginBottom:6 }}>
                              Reason: {laptop.report_reason}
                            </div>
                          )}
                          {/* QR code display */}
                          {rr ? (
                            <div style={{ background:C.goldLt, border:`1px solid ${C.gold}`, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
                              <img src={rr.qrImage} alt="QR" style={{ width:52, height:52, borderRadius:8 }} />
                              <div>
                                <div style={{ fontSize:11, color:C.orange, fontWeight:700 }}>New Code</div>
                                <div style={{ fontSize:20, fontWeight:800, fontFamily:"'DM Mono',monospace", color:C.navy, letterSpacing:4 }}>{rr.qrCodeNumber}</div>
                                <a href={rr.qrImage} download="laptop-qr.png" style={{ fontSize:11, color:C.navy, fontWeight:700 }}>⬇ Download QR</a>
                              </div>
                            </div>
                          ) : laptop.qr_code && (
                            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:C.goldLt, border:`1px solid ${C.gold}`, padding:'4px 12px', borderRadius:8, marginBottom:6 }}>
                              <span style={{ fontSize:11, color:C.muted, fontWeight:600 }}>Code</span>
                              <span style={{ fontSize:15, fontWeight:800, fontFamily:"'DM Mono',monospace", color:C.navy, letterSpacing:3 }}>{laptop.qr_code}</span>
                            </div>
                          )}
                          {/* actions */}
                          <div className="action-row" style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:10 }}>
                            <ActionBtn variant="gold" onClick={() => handleRegenerateCode(laptop.id)} disabled={regenerating === laptop.id}>
                              {regenerating === laptop.id ? '⏳ Regenerating…' : '🔄 Lost code?'}
                            </ActionBtn>
                            <ActionBtn variant="default" onClick={() => editingId === laptop.id ? cancelEdit() : startEdit(laptop)}>
                              {editingId === laptop.id ? '✕ Cancel' : '✏️ Edit'}
                            </ActionBtn>
                            <ActionBtn variant="gold" onClick={() => openReportPanel(laptop,'LOST')} disabled={laptop.security_status === 'LOST'}>
                              ⚠️ Lost
                            </ActionBtn>
                            <ActionBtn variant="danger" onClick={() => openReportPanel(laptop,'STOLEN')} disabled={laptop.security_status === 'STOLEN'}>
                              🚨 Stolen
                            </ActionBtn>
                            {['LOST','STOLEN'].includes(laptop.security_status) && (
                              <ActionBtn variant="success" onClick={() => openReportPanel(laptop,'FOUND')} className="found-btn">
                                ✅ Found it!
                              </ActionBtn>
                            )}
                          </div>
                        </div>

                        {/* badges */}
                        <div className="badge-group" style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
                          <Chip {...vb} />
                          <Chip
                            bg={laptop.is_in_campus ? '#E8F5E9' : '#FFF0F0'}
                            color={laptop.is_in_campus ? C.green : C.red}
                            icon={laptop.is_in_campus ? '📍' : '🏠'}
                            label={laptop.is_in_campus ? 'On Campus' : 'Off Campus'}
                          />
                          <Chip {...sb} />
                        </div>
                      </div>
                    </div>

                    {/* ── report panel ── */}
                    {reportPanel?.laptop.id === laptop.id && (
                      <div style={{ background:'#FFFDF4', border:`1px solid ${C.gold}`, borderRadius:14, padding:'18px 20px', marginTop:4, animation:'fadeSlide .25s ease' }}>
                        <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                          {reportPanel.status === 'FOUND' ? '✅ Found laptop? Notify admins' : `🚨 Report as ${reportPanel.status.toLowerCase()}`}
                        </div>
                        <form onSubmit={submitReportPanel}>
                          <label style={ls.label}>{reportPanel.status === 'FOUND' ? 'Comment for admins' : 'Reason / description'}</label>
                          <textarea style={{ ...ls.input, resize:'vertical', fontFamily:'inherit', marginBottom:12 }}
                            value={reportComment} onChange={e => setReportComment(e.target.value)}
                            placeholder={reportPanel.status === 'FOUND'
                              ? 'Where was it found? Any details admins should verify?'
                              : 'Describe what happened and where/when you last had it.'}
                            rows={3} required />
                          <div style={{ display:'flex', gap:10 }}>
                            <button type="submit" disabled={reportSubmitting || !reportComment.trim()} className="btn-primary"
                              style={{ ...ls.btnPrimary, width:'auto', padding:'10px 24px', fontSize:14, opacity: !reportComment.trim() ? .5 : 1 }}>
                              {reportSubmitting ? 'Submitting…' : reportPanel.status === 'FOUND' ? 'Notify Admins' : 'Submit Report'}
                            </button>
                            <button type="button" onClick={closeReportPanel} style={{ padding:'10px 20px', background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:'pointer', fontWeight:600 }}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* ── edit panel ── */}
                    {editingId === laptop.id && (
                      <div style={{ background:'#F0F4FF', border:`1px solid #C7D2FE`, borderRadius:14, padding:'20px', marginTop:4, animation:'fadeSlide .25s ease' }}>
                        <div style={{ background:C.goldLt, border:`1px solid ${C.gold}`, borderRadius:10, padding:'10px 14px', fontSize:13, color:'#7A5C00', marginBottom:16, fontWeight:500 }}>
                          ⚠️ Editing will reset verification to <strong>Pending</strong>. A guard will need to re-verify before campus entry is allowed.
                        </div>
                        {editError && <Alert type="error">{editError}</Alert>}
                        <form onSubmit={handleEdit}>
                          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                            {[['Serial Number','serialNumber'],['Brand','brand'],['Model','model']].map(([lbl,key]) => (
                              <div key={key} style={{ flex:'1 1 160px' }}>
                                <label style={ls.label}>{lbl}</label>
                                <input style={ls.input} value={editForm[key]} onChange={e => setEditForm({...editForm,[key]:e.target.value})} required />
                              </div>
                            ))}
                          </div>
                          <PhotoUpload
                            label="Replace Photo (optional)"
                            preview={editPhotoPreview}
                            onChange={(file) => { setEditForm({...editForm, photo:file}); setEditPhotoPreview(URL.createObjectURL(file)) }}
                            onRemove={() => { setEditForm({...editForm, photo:null}); setEditPhotoPreview(null) }}
                          />
                          <div style={{ display:'flex', gap:10, marginTop:4 }}>
                            <button type="submit" disabled={editLoading} className="btn-primary" style={{ ...ls.btnPrimary, width:'auto', padding:'10px 24px', fontSize:14 }}>
                              {editLoading ? 'Saving…' : '💾 Save Changes'}
                            </button>
                            <button type="button" onClick={cancelEdit} style={{ padding:'10px 20px', background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:'pointer', fontWeight:600 }}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <AASTUFooter />
    </div>
  )
}

/* ─── shared style objects ─── */
const ls = {
  card: {
    background: C.white, borderRadius:18, padding:32,
    boxShadow:'0 2px 16px rgba(0,51,160,.07)',
    border:`1px solid ${C.border}`,
  },
  field: { marginBottom:16 },
  label: { display:'block', marginBottom:7, fontSize:13, fontWeight:700, color:C.text, letterSpacing:.2 },
  input: {
    width:'100%', padding:'12px 16px', borderRadius:10,
    border:`2px solid ${C.border}`, fontSize:14, color:C.text,
    background:C.white, boxSizing:'border-box',
    transition:'border-color .18s, box-shadow .18s',
    fontFamily:"inherit",
  },
  btnPrimary: {
    width:'100%', padding:14, marginTop:4,
    background:`linear-gradient(135deg,${C.navy} 0%,${C.navyDk} 100%)`,
    color:'#fff', border:'none', borderRadius:12,
    fontSize:15, fontWeight:800, cursor:'pointer',
    transition:'all .2s', letterSpacing:.3,
    boxShadow:`0 4px 14px rgba(0,51,160,.25)`,
  },
}