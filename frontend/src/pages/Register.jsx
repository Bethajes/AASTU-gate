import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AuthPageLayout from '../components/AuthPageLayout'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', studentId: '', role: 'STUDENT' })
  // role is always STUDENT for public registration
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await API.post('/auth/register', form)
      navigate('/verify-email', { state: { email: form.email } })
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
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
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.subtitle}>Register for laptop registration and gate check-in</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Full Name</label>
            <input className="auth-input" style={styles.input} type="text" placeholder="Bethel Tadesse"
              value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input className="auth-input" style={styles.input} type="email" placeholder="firstname.fathername@aastustudent.edu.et"
              value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input className="auth-input" style={styles.input} type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Student ID</label>
            <input className="auth-input" style={styles.input} type="text" placeholder="ETS0001"
              value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} />
          </div>
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p style={styles.link}>
          Already have an account? <Link to="/login">Sign in</Link>
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
    border: '1px solid #ffcdd2',
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
  select: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '2px solid #e0e0e0',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fff',
    cursor: 'pointer',
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