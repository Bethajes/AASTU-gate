import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AASTUFooter from '../components/AASTUFooter'
import { theme } from '../styles/theme'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n } = useTranslation()
  const successMessage = location.state?.message || ''
  const currentLang = i18n.language?.startsWith('am') ? 'am' : 'en'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await API.post('/auth/login', { username, password })
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
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <AASTULogo orientation="horizontal" showText={false} tone="onDark" style={{ maxHeight: 44 }} />
        <div style={s.headerCenter}>
          <span style={s.headerTitle}>AASTU Campus Asset & Security Registry</span>
          <span style={s.headerSub}>Laptop Gate Pass System</span>
        </div>
        <div style={s.langSwitcher}>
          <button
            type="button"
            style={{ ...s.langBtn, ...(currentLang === 'en' ? s.langBtnActive : {}) }}
            onClick={() => i18n.changeLanguage('en')}
            aria-label="Switch to English"
          >EN</button>
          <button
            type="button"
            style={{ ...s.langBtn, ...(currentLang === 'am' ? s.langBtnActive : {}) }}
            onClick={() => i18n.changeLanguage('am')}
            aria-label="Switch to Amharic"
          >አማ</button>
        </div>
      </header>

      {/* ── Body: hero + form ── */}
      <div style={s.body}>
        {/* Left hero */}
        <div className="login-hero" style={s.hero}>
          <div style={s.heroContent}>
            <h1 style={s.heroTitle}>Campus Laptop<br />Gate Pass System</h1>
            <p style={s.heroDesc}>
              Official asset verification and campus access management platform for AASTU students, security staff, and administrators.
            </p>

            {/* Student guide */}
            <div style={s.guideSection}>
              <div style={s.guideHeading}>
                <span style={s.guideIcon}>📖</span>
                <span style={s.guideHeadingText}>How to get started as a student</span>
              </div>
              <div style={s.guideSteps}>
                {[
                  {
                    step: '1',
                    title: 'Activate your account',
                    desc: 'Click "Activate your account" below and enter your student ID (e.g. ETS02315/14) and set a password.',
                  },
                  {
                    step: '2',
                    title: 'Verify your email',
                    desc: 'Check your university email for a verification link and confirm your address.',
                  },
                  {
                    step: '3',
                    title: 'Sign in & register your laptop',
                    desc: 'Log in with your credentials, then go to your dashboard to add your laptop details.',
                  },
                  {
                    step: '4',
                    title: 'Show your QR at the gate',
                    desc: 'Present the QR code from your dashboard to the security guard when leaving campus with your laptop.',
                  },
                ].map(item => (
                  <div key={item.step} style={s.guideStep}>
                    <div style={s.stepBadge}>{item.step}</div>
                    <div style={s.stepBody}>
                      <span style={s.stepTitle}>{item.title}</span>
                      <span style={s.stepDesc}>{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p style={s.heroFooter}>Addis Ababa Science and Technology University · Akaky Kaliti</p>
        </div>

        {/* Right form */}
        <div style={s.formPanel}>
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardIcon}>🔐</div>
              <h2 style={s.cardTitle}>Sign in to your account</h2>
              <p style={s.cardSub}>Enter your university credentials to continue</p>
            </div>

            {error && (
              <div style={s.alertError} role="alert">⚠️ {error}</div>
            )}
            {!error && successMessage && (
              <div style={s.alertSuccess} role="status">✅ {successMessage}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={s.field}>
                <label style={s.label} htmlFor="username">Username</label>
                <input
                  id="username"
                  className="auth-input"
                  style={s.input}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. ETS02315/14"
                  autoComplete="username"
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="password">Password</label>
                <input
                  id="password"
                  className="auth-input"
                  style={s.input}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div style={s.forgotRow}>
                <Link to="/forgot-password" style={s.forgotLink}>Forgot password?</Link>
              </div>

              <button style={s.submitBtn} type="submit" disabled={loading}>
                {loading
                  ? <span style={s.btnInner}><span style={s.spinner} /> Signing in…</span>
                  : 'Sign In'}
              </button>
            </form>

            <div style={s.divider}>
              <span style={s.dividerLine} />
              <span style={s.dividerText}>New to the system?</span>
              <span style={s.dividerLine} />
            </div>

            <Link to="/activate" style={s.activateBtn}>Activate your account</Link>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <AASTUFooter />
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f0f4ff',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    padding: '14px clamp(16px, 4vw, 40px)',
    background: theme.headerGradient,
    borderBottom: `3px solid ${theme.gold}`,
    boxShadow: '0 4px 24px rgba(0,32,128,0.22)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerCenter: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 2,
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 'clamp(13px, 2vw, 16px)',
    fontWeight: 700,
    letterSpacing: '0.03em',
  },
  headerSub: {
    color: theme.gold,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  langSwitcher: { display: 'flex', gap: 4 },
  langBtn: {
    padding: '5px 10px',
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)',
    border: '1.5px solid rgba(255,255,255,0.25)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  langBtnActive: {
    background: theme.gold,
    color: '#0033A0',
    border: `1.5px solid ${theme.gold}`,
  },

  // Body split
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Hero (left)
  hero: {
    flex: '0 0 44%',
    minWidth: 300,
    background: 'linear-gradient(160deg, #0033A0 0%, #001a6e 55%, #000d3a 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 'clamp(28px, 4vw, 52px)',
    overflow: 'hidden',
  },
  heroContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(22px, 2.8vw, 34px)',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  heroDesc: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.7,
    maxWidth: 380,
  },

  // Student guide
  guideSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 4,
  },
  guideHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  guideIcon: { fontSize: 16 },
  guideHeadingText: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.gold,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  guideSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  guideStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '11px 14px',
  },
  stepBadge: {
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: theme.gold,
    color: '#0033A0',
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  },
  stepDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
  },

  heroFooter: { fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '16px 0 0' },

  // Form panel (right)
  formPanel: {
    flex: 1,
    minWidth: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    background: '#f0f4ff',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 4px 32px rgba(0,51,160,0.10), 0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
    borderTop: `4px solid ${theme.gold}`,
    animation: 'fadeIn 0.4s ease-out',
  },
  cardHeader: { textAlign: 'center', marginBottom: 28 },
  cardIcon: { fontSize: 34, marginBottom: 10 },
  cardTitle: { margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' },
  cardSub: { margin: 0, fontSize: 13, color: '#64748b' },

  alertError: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff5f5', color: '#c53030',
    border: '1px solid #fed7d7',
    padding: '11px 14px', borderRadius: 10, marginBottom: 18, fontSize: 13,
  },
  alertSuccess: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#f0fff4', color: '#276749',
    border: '1px solid #c6f6d5',
    padding: '11px 14px', borderRadius: 10, marginBottom: 18, fontSize: 13,
  },

  field: { marginBottom: 18 },
  label: { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    width: '100%', padding: '11px 14px',
    borderRadius: 10, border: '1.5px solid #e2e8f0',
    fontSize: 14, color: '#0f172a', background: '#f8fafc',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },

  forgotRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: 20, marginTop: -6 },
  forgotLink: { fontSize: 13, color: '#0033A0', fontWeight: 600, textDecoration: 'none' },

  submitBtn: {
    width: '100%', padding: 13,
    background: 'linear-gradient(135deg, #0033A0 0%, #002080 100%)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.01em', transition: 'opacity 0.2s',
  },
  btnInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  spinner: {
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid rgba(255,255,255,0.4)',
    borderTop: '2px solid #fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },

  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 16px' },
  dividerLine: { flex: 1, height: 1, background: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 500 },

  activateBtn: {
    display: 'block', width: '100%', padding: 12,
    background: 'transparent', color: '#0033A0',
    border: '1.5px solid #0033A0', borderRadius: 10,
    fontSize: 14, fontWeight: 600, textAlign: 'center',
    textDecoration: 'none', boxSizing: 'border-box',
  },
}
