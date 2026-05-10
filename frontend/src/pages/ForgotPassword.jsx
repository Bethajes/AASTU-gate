import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AuthPageLayout from '../components/AuthPageLayout'

export default function ForgotPassword() {
  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSendCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await API.post('/auth/forgot-password', { email })
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (newPassword !== confirm) return setError('Passwords do not match')
    setLoading(true)
    setError('')
    try {
      await API.post('/auth/reset-password', { email, code, newPassword })
      navigate('/login', { state: { message: 'Password reset successfully. You can now log in.' } })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <AASTULogo orientation="stacked" showText tone="onLight" />
        </div>

        {step === 'email' ? (
          <>
            <h1 style={styles.title}>Forgot Password</h1>
            <p style={styles.subtitle}>Enter your personal email to receive a reset code</p>
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleSendCode}>
              <div style={styles.field}>
                <label style={styles.label}>Personal Email</label>
                <input
                  className="auth-input"
                  style={styles.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.personal@email.com"
                  required
                />
              </div>
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 style={styles.title}>Enter Reset Code</h1>
            <p style={styles.subtitle}>Check your personal email for the 6-digit code</p>
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleReset}>
              <div style={styles.field}>
                <label style={styles.label}>Reset Code</label>
                <input
                  className="auth-input"
                  style={styles.input}
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={6}
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <input
                  className="auth-input"
                  style={styles.input}
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  className="auth-input"
                  style={styles.input}
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
            <p style={styles.link}>
              <button style={styles.textBtn} onClick={() => { setStep('email'); setError('') }}>
                ← Resend code
              </button>
            </p>
          </>
        )}

        <p style={styles.link}>
          <Link to="/login">← Back to Login</Link>
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
    boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
    width: '100%',
    maxWidth: '420px',
    borderTop: '4px solid #D4A017',
  },
  logoContainer: { display: 'flex', justifyContent: 'center', marginBottom: '28px' },
  title: { margin: '0 0 8px', fontSize: '26px', fontWeight: '700', color: '#0033A0', textAlign: 'center' },
  subtitle: { margin: '0 0 28px', fontSize: '14px', color: '#5c6570', textAlign: 'center', lineHeight: 1.45 },
  error: { backgroundColor: '#fff0f0', color: '#e53e3e', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' },
  field: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  button: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  link: { textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#666' },
  textBtn: { background: 'none', border: 'none', color: '#0033A0', cursor: 'pointer', fontSize: '14px', padding: 0 },
}
