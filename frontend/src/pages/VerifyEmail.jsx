import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AuthPageLayout from '../components/AuthPageLayout'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await API.post('/auth/verify-email', { email, code })
      setSuccess('Email verified! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setError('')
    setSuccess('')
    try {
      await API.post('/auth/resend-code', { email })
      setSuccess('A new verification code has been sent to your email.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <AuthPageLayout>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <AASTULogo orientation="stacked" showText tone="onLight" />
        </div>
        <h1 style={styles.title}>Verify your email</h1>
        <p style={styles.subtitle}>
          We sent a 6-digit code to<br />
          <strong style={{ color: '#0033A0' }}>{email || 'your email'}</strong>
        </p>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Verification Code</label>
            <input
              className="auth-input"
              style={{ ...styles.input, letterSpacing: '6px', textAlign: 'center', fontSize: '22px' }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>
          <button style={styles.button} type="submit" disabled={loading || code.length !== 6}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <button style={styles.resendButton} onClick={handleResend} disabled={resendLoading}>
          {resendLoading ? 'Sending...' : 'Resend code'}
        </button>

        <p style={styles.link}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </AuthPageLayout>
  )
}

const styles = {
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: '40px 36px 36px',
    borderRadius: '20px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.08)',
    width: '100%',
    maxWidth: '460px',
    animation: 'fadeIn 0.5s ease-out',
    borderTop: '4px solid #D4A017',
  },
  logoContainer: { display: 'flex', justifyContent: 'center', marginBottom: '28px' },
  title: {
    margin: '0 0 8px',
    fontSize: '26px',
    fontWeight: '700',
    color: '#0033A0',
    textAlign: 'center',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '0 0 28px',
    fontSize: '14px',
    color: '#5c6570',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  error: {
    backgroundColor: '#fff0f0',
    color: '#e53e3e',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #ffcdd2',
  },
  successBox: {
    backgroundColor: '#f0fff4',
    color: '#276749',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #c6f6d5',
  },
  field: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '2px solid #e0e0e0',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.3s',
    boxSizing: 'border-box',
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
    marginTop: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  resendButton: {
    width: '100%',
    padding: '12px',
    background: 'transparent',
    color: '#0033A0',
    border: '2px solid #0033A0',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
  },
  link: { textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#666' },
}
