import { useState, useEffect } from 'react'
import API from '../api/axios'
import AASTUHeader from '../components/AASTUHeader'
import AASTUFooter from '../components/AASTUFooter'

export default function GuardScanner() {
  const [qrCode, setQrCode] = useState('')
  const [scanType, setScanType] = useState('IN')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentLogs, setRecentLogs] = useState([])
  const [laptopDetails, setLaptopDetails] = useState(null)
  const [searching, setSearching] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const fetchRecentLogs = async () => {
    try {
      const res = await API.get('/gate/logs')
      setRecentLogs(res.data.slice(0, 10))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchRecentLogs()
  }, [])

  // Search laptop when QR code is entered (debounced)
  useEffect(() => {
    if (qrCode.length === 8) {
      searchLaptop()
    } else if (qrCode.length === 0) {
      setLaptopDetails(null)
    }
  }, [qrCode])

  const searchLaptop = async () => {
    setSearching(true)
    setError('')
    setMessage('')
    try {
      const res = await API.get(`/gate/lookup?code=${qrCode}`)
      setLaptopDetails(res.data)
      setError('')
    } catch (err) {
      setLaptopDetails(null)
      setError('❌ No laptop found with this code')
    } finally {
      setSearching(false)
    }
  }

  const handleScan = async (e) => {
    e.preventDefault()
    if (!laptopDetails) {
      setError('Please enter a valid 8-digit code first')
      return
    }

    // Check verification status
    if (laptopDetails.verification_status === 'BLOCKED') {
      setError('❌ This laptop is BLOCKED and cannot enter/exit campus')
      return
    }

    if (laptopDetails.verification_status === 'PENDING') {
      setError('⚠️ This laptop must be verified first before entry/exit')
      return
    }
    
    setLoading(true)
    setMessage('')
    setError('')
    try {
      // Use new entry/exit endpoints
      if (scanType === 'IN') {
        await API.post(`/gate/entry/${laptopDetails.id}`)
        setMessage('✅ Entry logged successfully')
      } else {
        await API.post(`/gate/exit/${laptopDetails.id}`)
        setMessage('✅ Exit logged successfully')
      }
      setQrCode('')
      setLaptopDetails(null)
      fetchRecentLogs()
    } catch (err) {
      setError(err.response?.data?.message || 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!laptopDetails) return
    
    setVerifying(true)
    setMessage('')
    setError('')
    try {
      await API.post(`/gate/verify/${laptopDetails.id}`)
      setMessage('✅ Laptop verified successfully')
      // Refresh laptop details
      await searchLaptop()
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={styles.container}>
      <AASTUHeader subtitle="Security scanner" />

      <div style={styles.main} className="fade-in">
      <div style={styles.content}>
        {/* Scan Form */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Scan Laptop</h2>
          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <form onSubmit={handleScan}>
            <div style={styles.field}>
              <label style={styles.label}>Enter 8-Digit Code</label>
              <input
                style={styles.input}
                placeholder="Example: 48271935"
                value={qrCode}
                onChange={e => setQrCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength="8"
                autoFocus
              />
              <div style={styles.hint}>
                💡 Student will show you an 8-digit number or QR code
              </div>
            </div>

            {searching && <div style={styles.loading}>Searching...</div>}

            {/* Laptop Details Card - Shows when laptop is found */}
            {laptopDetails && (
              <div style={styles.laptopCard}>
                <h3 style={styles.laptopTitle}>✅ Laptop Found</h3>
                <div style={styles.laptopContent}>
                  {laptopDetails.photo_url ? (
                    <div style={styles.photoContainer}>
                      <img 
                        src={`http://localhost:5000${laptopDetails.photo_url}`} 
                        alt={laptopDetails.brand}
                        style={styles.laptopPhotoLarge}
                      />
                    </div>
                  ) : (
                    <div style={{...styles.photoContainer, ...styles.noPhotoBox}}>
                      <span style={{fontSize:'40px'}}>💻</span>
                      <span style={{fontSize:'11px', color:'#888', marginTop:'4px'}}>No photo</span>
                    </div>
                  )}
                  <div style={styles.detailsContainer}>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Owner:</span>
                      <span style={styles.detailValue}>{laptopDetails.owner_name}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Student ID:</span>
                      <span style={styles.detailValue}>{laptopDetails.student_id || 'N/A'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Brand:</span>
                      <span style={styles.detailValue}>{laptopDetails.brand}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Model:</span>
                      <span style={styles.detailValue}>{laptopDetails.model}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Serial Number:</span>
                      <span style={styles.detailValue}>{laptopDetails.serial_number}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Verification Status:</span>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: 
                          laptopDetails.verification_status === 'VERIFIED' ? '#e6ffed' :
                          laptopDetails.verification_status === 'BLOCKED' ? '#ffebee' : '#fff3e0',
                        color: 
                          laptopDetails.verification_status === 'VERIFIED' ? '#2e7d32' :
                          laptopDetails.verification_status === 'BLOCKED' ? '#c62828' : '#e65100',
                      }}>
                        {laptopDetails.verification_status === 'VERIFIED' && '✅ VERIFIED'}
                        {laptopDetails.verification_status === 'PENDING' && '⏳ PENDING'}
                        {laptopDetails.verification_status === 'BLOCKED' && '🚫 BLOCKED'}
                      </span>
                    </div>
                    {laptopDetails.verification_status === 'VERIFIED' && laptopDetails.verified_by_name && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Verified By:</span>
                        <span style={styles.detailValue}>{laptopDetails.verified_by_name}</span>
                      </div>
                    )}
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Current Status:</span>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: laptopDetails.is_in_campus ? '#e6ffed' : '#fff0f0',
                        color: laptopDetails.is_in_campus ? '#2e7d32' : '#c62828',
                      }}>
                        {laptopDetails.is_in_campus ? 'On Campus' : 'Off Campus'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verification Button - Only show for PENDING laptops */}
                {laptopDetails.verification_status === 'PENDING' && (
                  <div style={{marginTop: '16px'}}>
                    <button 
                      style={{...styles.button, background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)'}} 
                      onClick={handleVerify}
                      disabled={verifying}
                    >
                      {verifying ? 'Verifying...' : '✅ Verify This Laptop'}
                    </button>
                    <div style={styles.hint}>
                      ⚠️ Please physically check the laptop matches the photo and serial number before verifying
                    </div>
                  </div>
                )}

                {/* Blocked Alert */}
                {laptopDetails.verification_status === 'BLOCKED' && (
                  <div style={{...styles.error, marginTop: '16px', fontWeight: 'bold'}}>
                    🚫 This laptop is BLOCKED and cannot be allowed entry or exit
                  </div>
                )}
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Scan Type</label>
              <div style={styles.radioGroup}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    value="IN"
                    checked={scanType === 'IN'}
                    onChange={() => setScanType('IN')}
                  />
                  <span>🔵 IN (Entering campus)</span>
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    value="OUT"
                    checked={scanType === 'OUT'}
                    onChange={() => setScanType('OUT')}
                  />
                  <span>🟡 OUT (Leaving campus)</span>
                </label>
              </div>
            </div>

            <button 
              style={styles.button} 
              type="submit" 
              disabled={
                loading || 
                !laptopDetails || 
                laptopDetails.verification_status === 'PENDING' ||
                laptopDetails.verification_status === 'BLOCKED'
              }
            >
              {loading ? 'Processing...' : `Confirm ${scanType}`}
            </button>
            {laptopDetails && laptopDetails.verification_status === 'PENDING' && (
              <div style={{...styles.hint, color: '#e65100', marginTop: '8px'}}>
                ⚠️ Laptop must be verified before entry/exit
              </div>
            )}
          </form>
        </div>

        {/* Recent Scan Logs */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Recent Scans</h2>
          {recentLogs.length === 0 ? (
            <p style={styles.empty}>No scans yet.</p>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} style={styles.logItem}>
                <div>
                  <span style={styles.logType}>
                    {log.scan_type === 'IN' ? '🔵 IN' : '🟡 OUT'}
                  </span>
                  <span style={styles.logLaptop}>
                    {log.brand} - {log.serial_number}
                  </span>
                </div>
                <div style={styles.logMeta}>
                  <span>Student: {log.owner_name || 'N/A'}</span>
                  <span>Scanned by: {log.scanned_by_name}</span>
                  <span style={styles.logTime}>
                    {new Date(log.scanned_at).toLocaleTimeString()}
                  </span>
                </div>
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
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    display: 'flex',
    flexDirection: 'column',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  content: {
    maxWidth: '800px',
    margin: '32px auto',
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  cardTitle: { 
    margin: '0 0 24px', 
    fontSize: '20px', 
    fontWeight: '700', 
    color: '#0033A0',
    borderLeft: '4px solid #FFD700',
    paddingLeft: '16px',
  },
  error: { 
    backgroundColor: '#fff0f0', 
    color: '#e53e3e', 
    padding: '12px 16px', 
    borderRadius: '10px', 
    marginBottom: '20px' 
  },
  success: { 
    backgroundColor: '#e8f5e9', 
    color: '#2e7d32', 
    padding: '12px 16px', 
    borderRadius: '10px', 
    marginBottom: '20px' 
  },
  field: { marginBottom: '24px' },
  label: { 
    display: 'block', 
    marginBottom: '8px', 
    fontSize: '14px', 
    fontWeight: '600', 
    color: '#333' 
  },
  input: { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '10px', 
    border: '2px solid #e0e0e0', 
    fontSize: '18px', 
    textAlign: 'center',
    letterSpacing: '4px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    outline: 'none',
    boxSizing: 'border-box' 
  },
  hint: { 
    fontSize: '12px', 
    color: '#888', 
    marginTop: '8px',
    textAlign: 'center',
  },
  loading: { 
    textAlign: 'center', 
    padding: '10px', 
    color: '#0033A0' 
  },
  laptopCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    border: '2px solid #4caf50',
  },
  laptopTitle: { 
    margin: '0 0 16px', 
    fontSize: '16px', 
    fontWeight: '600', 
    color: '#2e7d32' 
  },
  laptopContent: { 
    display: 'flex', 
    gap: '20px', 
    flexWrap: 'wrap' 
  },
  photoContainer: { 
    flex: '0 0 auto' 
  },
  noPhotoBox: {
    width: '150px',
    height: '150px',
    backgroundColor: '#f0f0f0',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed #ccc',
  },
  laptopPhotoLarge: { 
    width: '150px', 
    height: '150px', 
    objectFit: 'cover', 
    borderRadius: '10px',
    border: '3px solid #FFD700',
  },
  detailsContainer: { 
    flex: 1 
  },
  detailRow: { 
    marginBottom: '10px', 
    display: 'flex', 
    alignItems: 'center', 
    flexWrap: 'wrap', 
    gap: '8px' 
  },
  detailLabel: { 
    fontWeight: '600', 
    color: '#555', 
    minWidth: '100px' 
  },
  detailValue: { 
    color: '#333' 
  },
  statusBadge: { 
    padding: '4px 12px', 
    borderRadius: '20px', 
    fontSize: '12px', 
    fontWeight: '500', 
    display: 'inline-block' 
  },
  radioGroup: { 
    display: 'flex', 
    gap: '24px', 
    marginTop: '8px' 
  },
  radioLabel: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    fontSize: '14px', 
    cursor: 'pointer' 
  },
  button: { 
    width: '100%', 
    padding: '14px', 
    background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '10px', 
    fontSize: '16px', 
    fontWeight: '600', 
    cursor: 'pointer', 
    marginTop: '8px' 
  },
  empty: { 
    color: '#888', 
    fontSize: '14px', 
    textAlign: 'center', 
    padding: '40px 0' 
  },
  logItem: { 
    padding: '12px', 
    backgroundColor: '#f8f9fa', 
    borderRadius: '10px', 
    marginBottom: '10px' 
  },
  logType: { 
    display: 'inline-block', 
    fontWeight: '600', 
    marginRight: '12px', 
    fontSize: '14px' 
  },
  logLaptop: { 
    fontSize: '14px', 
    color: '#333' 
  },
  logMeta: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    marginTop: '6px', 
    fontSize: '12px', 
    color: '#888', 
    flexWrap: 'wrap', 
    gap: '8px' 
  },
  logTime: { 
    fontSize: '12px' 
  },
}