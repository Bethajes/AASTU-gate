import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AuthPageLayout from '../components/AuthPageLayout'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await API.post('/auth/login', { email, password })
      login(res.data.user, res.data.token)
      if (res.data.user.role === 'STUDENT') navigate('/student')
      else if (res.data.user.role === 'GUARD') navigate('/guard')
      else if (res.data.user.role === 'ADMIN') navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
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
        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.subtitle}>Sign in with your university email</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              className="auth-input"
              style={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              className="auth-input"
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={styles.link}>
          No account? <Link to="/register">Create one</Link>
        </p>
        <p style={styles.link}>
          <Link to="/forgot-password">Forgot password?</Link>
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
    maxWidth: '420px',
    animation: 'fadeIn 0.5s ease-out',
    borderTop: '4px solid #D4A017',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '28px',
  },
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
    lineHeight: 1.45,
  },
  error: {
    backgroundColor: '#fff0f0',
    color: '#e53e3e',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  field: { marginBottom: '20px' },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
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
  link: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '14px',
    color: '#666',
  },
}