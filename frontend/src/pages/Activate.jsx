import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AuthPageLayout from '../components/AuthPageLayout'
import { buildPhotoUrl } from '../utils/photoUrl'

const INSTITUTIONAL_EMAIL_RE = /^[a-zA-Z]+\.[a-zA-Z]+@aastustudents?\.edu\.et$/

// Step 1: Enter student ID + institutional email, sends OTP
function StepIdAndEmail({ onSuccess }) {
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Email availability state: null | 'checking' | 'available' | 'taken' | 'not_institutional'
  const [emailStatus, setEmailStatus] = useState(null)
  const debounceRef = useRef(null)

  const handleEmailChange = (e) => {
    const val = e.target.value
    setEmail(val)
    setEmailStatus(null)

    clearTimeout(debounceRef.current)

    if (!val || !INSTITUTIONAL_EMAIL_RE.test(val)) {
      if (val && !INSTITUTIONAL_EMAIL_RE.test(val)) setEmailStatus('not_institutional')
      return
    }

    setEmailStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await API.get('/auth/check-email', { params: { email: val } })
        setEmailStatus(res.data.available ? 'available' : (res.data.reason || 'taken'))
      } catch {
        setEmailStatus(null)
      }
    }, 600)
  }

  const emailHint = () => {
    if (emailStatus === 'checking') return { text: 'Checking availability…', color: '#888' }
    if (emailStatus === 'available') return { text: '✓ Email is available', color: '#276749' }
    if (emailStatus === 'taken') return { text: '✗ Email is already in use', color: '#e53e3e' }
    if (emailStatus === 'not_institutional') return { text: 'Must be an @aastustudent.edu.et or @aastustudents.edu.et address', color: '#e53e3e' }
    return null
  }

  const hint = emailHint()
  const submitBlocked = loading || emailStatus === 'taken' || emailStatus === 'not_institutional' || emailStatus === 'checking'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await API.post('/auth/send-otp', { student_id: studentId, email })
      onSuccess({ student_id: studentId, email })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 style={styles.title}>Activate Account</h1>
      <p style={styles.subtitle}>Enter your student ID and institutional email to get started</p>

      {error && <div style={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Student ID</label>
          <input
            className="auth-input"
            style={styles.input}
            type="text"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            placeholder="e.g. ETS023/15"
            required
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Institutional Email</label>
          <input
            className="auth-input"
            style={{
              ...styles.input,
              borderColor: emailStatus === 'available' ? '#38a169'
                : (emailStatus === 'taken' || emailStatus === 'not_institutional') ? '#e53e3e'
                : undefined,
            }}
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="firstname.fathername@aastustudent(s).edu.et"
            required
          />
          {hint && (
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: hint.color }}>
              {hint.text}
            </p>
          )}
        </div>
        <button style={{ ...styles.button, opacity: submitBlocked ? 0.6 : 1 }} type="submit" disabled={submitBlocked}>
          {loading ? 'Sending code...' : 'Send Verification Code'}
        </button>
      </form>

      <p style={styles.link}>
        Already activated? <Link to="/login">Sign in</Link>
      </p>
    </>
  )
}

// Step 2: Enter OTP — on success returns student identity data
function StepOtpInput({ studentId, email, onSuccess }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [cooldown, setCooldown] = useState(0) // seconds remaining
  const cooldownRef = useRef(null)

  // Start countdown timer
  const startCooldown = (seconds) => {
    setCooldown(seconds)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Kick off a 60s cooldown when the component mounts (OTP was just sent)
  useEffect(() => {
    startCooldown(60)
    return () => clearInterval(cooldownRef.current)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await API.post('/auth/verify-otp', { student_id: studentId, code })
      onSuccess(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResendMsg('')
    setError('')
    try {
      await API.post('/auth/send-otp', { student_id: studentId, email })
      setResendMsg('A new code has been sent to your email.')
      startCooldown(60)
    } catch (err) {
      const retryAfter = err.response?.data?.retryAfter
      if (retryAfter) {
        startCooldown(retryAfter)
      }
      setError(err.response?.data?.message || 'Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <h1 style={styles.title}>Enter Verification Code</h1>
      <p style={styles.subtitle}>
        We sent a 6-digit code to <strong>{email}</strong>
      </p>

      {error && <div style={styles.error} role="alert">{error}</div>}
      {resendMsg && <div style={styles.success}>{resendMsg}</div>}

      <form onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Verification Code</label>
          <input
            className="auth-input"
            style={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
          />
        </div>
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Submit'}
        </button>
      </form>

      <button
        style={styles.resendButton}
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        type="button"
      >
        {resending ? 'Resending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
      </button>
    </>
  )
}

// Step 3: Confirm identity — shows photo, name, department
function StepConfirmIdentity({ student, onConfirm }) {
  const photoSrc = buildPhotoUrl(student.photo)

  return (
    <>
      <h1 style={styles.title}>Confirm Your Identity</h1>
      <p style={styles.subtitle}>Is this you? Review your details before continuing.</p>

      <div style={styles.identityCard}>
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={`${student.name} profile`}
            style={styles.photo}
          />
        ) : (
          <div style={styles.photoPlaceholder} aria-label="No photo available">
            <span style={styles.photoInitial}>
              {student.name ? student.name.charAt(0).toUpperCase() : '?'}
            </span>
          </div>
        )}
        <div style={styles.identityDetails}>
          <p style={styles.identityName}>{student.name}</p>
          <p style={styles.identityMeta}>{student.department}</p>
        </div>
      </div>

      <button style={styles.button} onClick={onConfirm}>
        Confirm &amp; Continue
      </button>
    </>
  )
}

// Step 4: Set password
function StepSetPassword({ student, otpToken }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      await API.post('/auth/set-password', {
        student_id: student.student_id,
        otpToken,
        password,
      })
      const loginRes = await API.post('/auth/login', {
        username: student.username,
        password,
      })
      login(loginRes.data.user, loginRes.data.token)
      navigate('/student')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 style={styles.title}>Set Your Password</h1>
      <p style={styles.subtitle}>Choose a secure password for your account</p>

      {error && <div style={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit}>
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
        <div style={styles.field}>
          <label style={styles.label}>Confirm Password</label>
          <input
            className="auth-input"
            style={styles.input}
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Activating...' : 'Activate Account'}
        </button>
      </form>
    </>
  )
}

// Wizard steps:
// 1 = student ID + email input (sends OTP)
// 2 = OTP verification
// 3 = identity confirmation
// 4 = password creation
export default function Activate() {
  const [step, setStep] = useState(1)
  const [credentials, setCredentials] = useState(null)   // { student_id, email }
  const [studentData, setStudentData] = useState(null)   // { name, photo, department, username, otpToken }

  const handleStep1Success = ({ student_id, email }) => {
    setCredentials({ student_id, email })
    setStep(2)
  }

  const handleOtpSuccess = (data) => {
    // data = { otpToken, name, photo, department, username }
    setStudentData({ ...data, student_id: credentials.student_id })
    setStep(3)
  }

  const handleConfirm = () => {
    setStep(4)
  }

  return (
    <AuthPageLayout>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <AASTULogo orientation="stacked" showText tone="onLight" />
        </div>

        {/* 4-dot step indicator */}
        <div style={styles.stepIndicator}>
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              style={{
                ...styles.stepDot,
                ...(step === n ? styles.stepDotActive : {}),
                ...(step > n ? styles.stepDotDone : {}),
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <StepIdAndEmail onSuccess={handleStep1Success} />
        )}
        {step === 2 && (
          <StepOtpInput
            studentId={credentials.student_id}
            email={credentials.email}
            onSuccess={handleOtpSuccess}
          />
        )}
        {step === 3 && (
          <StepConfirmIdentity student={studentData} onConfirm={handleConfirm} />
        )}
        {step === 4 && (
          <StepSetPassword student={studentData} otpToken={studentData.otpToken} />
        )}
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
    marginBottom: '20px',
  },
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '28px',
  },
  stepDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#e0e0e0',
    transition: 'background-color 0.3s',
  },
  stepDotActive: {
    backgroundColor: '#0033A0',
  },
  stepDotDone: {
    backgroundColor: '#D4A017',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '24px',
    fontWeight: '700',
    color: '#0033A0',
    textAlign: 'center',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '0 0 24px',
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
  success: {
    backgroundColor: '#f0fff4',
    color: '#276749',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #c6f6d5',
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
    transition: 'background 0.2s',
  },
  link: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '14px',
    color: '#666',
  },
  identityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#f8f9ff',
    border: '2px solid #e8ecff',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
  },
  photo: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    border: '3px solid #0033A0',
  },
  photoPlaceholder: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: '#0033A0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  photoInitial: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: '700',
  },
  identityDetails: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    margin: '0 0 4px',
    fontSize: '16px',
    fontWeight: '700',
    color: '#0033A0',
  },
  identityMeta: {
    margin: '0 0 2px',
    fontSize: '13px',
    color: '#5c6570',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
