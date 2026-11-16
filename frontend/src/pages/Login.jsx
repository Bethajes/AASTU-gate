import { useRef, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import AASTULogo from '../components/AASTULogo'
import AASTUFooter from '../components/AASTUFooter'
import './login.css'

const HERO_IMAGE = {
  desktop: '/hero/campus-hero-1200.jpg',
  mobile: '/hero/campus-hero-mobile.jpg',
  alt:
    'A university student working on a laptop in a modern lecture hall on campus',
}

/* ── Icons (inline SVG — no extra dependency) ─────────────────────────────── */

const ShieldIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2.6 4.5 5.7v5.6c0 4.6 3.1 8.8 7.5 10.1 4.4-1.3 7.5-5.5 7.5-10.1V5.7L12 2.6Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="m8.9 12 2.2 2.2 4-4.4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const UserIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M4.8 19.6a7.2 7.2 0 0 1 14.4 0"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

const LockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const EyeIcon = ({ size = 17, off = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12 18 18.1 12 18.1 2.6 12 2.6 12Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.9" stroke="currentColor" strokeWidth="1.6" />
    {off && (
      <path d="m4.2 4.2 15.6 15.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    )}
  </svg>
)

const AlertIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7.6v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16.1" r="1" fill="currentColor" />
  </svg>
)

const CheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="m8.4 12.2 2.4 2.4 4.8-5.2"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const usernameRef = useRef(null)

  const successMessage = location.state?.message || ''
  const currentLang = i18n.language?.startsWith('am') ? 'am' : 'en'

  const steps = [
    {
      n: '1',
      title: t('login.step1Title'),
      desc: t('login.step1Desc'),
    },
    {
      n: '2',
      title: t('login.step2Title'),
      desc: t('login.step2Desc'),
    },
    {
      n: '3',
      title: t('login.step3Title'),
      desc: t('login.step3Desc'),
    },
    {
      n: '4',
      title: t('login.step4Title'),
      desc: t('login.step4Desc'),
    },
  ]

  const clearFieldError = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    if (error) setError('')
  }

  const validate = () => {
    const errs = {}
    if (!username.trim()) errs.username = t('login.errUsernameRequired')
    if (!password) errs.password = t('login.errPasswordRequired')
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      // Move focus to the first field that needs attention.
      if (errs.username) usernameRef.current?.focus()
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await API.post('/auth/login', { username, password })
      login(res.data.user, res.data.token)
      if (res.data.user.role === 'STUDENT') navigate('/student')
      else if (res.data.user.role === 'GUARD') navigate('/guard')
      else if (res.data.user.role === 'ADMIN') navigate('/admin')
    } catch (err) {
      if (!err.response) {
        setError(t('login.networkError'))
      } else {
        setError(err.response.data?.message || t('login.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* ── Header ── */}
      <header className="login-header">
        <Link to="/login" className="login-header__brand" aria-label="AASTU Gate Pass — home">
          <AASTULogo
            orientation="horizontal"
            showText={false}
            tone="onDark"
            className="login-header__logo"
          />
        </Link>

        <div className="login-header__titles">
          <span className="login-header__title">AASTU Campus Asset &amp; Security Registry</span>
          <span className="login-header__sub">Laptop Gate Pass System</span>
        </div>

        <div className="login-lang" role="group" aria-label="Language">
          <button
            type="button"
            className="login-lang__btn"
            aria-pressed={currentLang === 'en'}
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </button>
          <button
            type="button"
            className="login-lang__btn"
            aria-pressed={currentLang === 'am'}
            onClick={() => i18n.changeLanguage('am')}
          >
            አማ
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="login-body">
        {/* Brand / hero */}
        <section className="login-hero" aria-labelledby="hero-heading">
          <div>
            <span className="login-hero__eyebrow">{t('login.heroEyebrow')}</span>
            <h1 id="hero-heading" className="login-hero__title">
              {t('login.heroTitle')}
            </h1>
            <p className="login-hero__desc">{t('login.heroDesc')}</p>
          </div>

          <figure className="login-hero__figure">
            <picture>
              <source media="(max-width: 768px)" srcSet={HERO_IMAGE.mobile} />
              <img
                src={HERO_IMAGE.desktop}
                alt={HERO_IMAGE.alt}
                className="login-hero__img"
                width="1200"
                height="900"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
            <figcaption className="login-hero__caption">
              <span className="login-hero__captionDot" aria-hidden="true" />
              <span>{t('login.heroTagline')}</span>
            </figcaption>
          </figure>

          {/* Student guide */}
          <div>
            <h2 className="login-guide__title">{t('login.guideTitle')}</h2>
            <ol className="login-guide__grid">
              {steps.map((step) => (
                <li key={step.n} className="login-step">
                  <span className="login-step__num" aria-hidden="true">
                    {step.n}
                  </span>
                  <span>
                    <span className="login-step__title">{step.title}</span>
                    <span className="login-step__desc">{step.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Login */}
        <section className="login-panel">
          <div className="login-card">
            <div className="login-card__head">
              <span className="login-card__shield">
                <ShieldIcon />
              </span>
              <h2 className="login-card__title">{t('login.welcome')}</h2>
              <p className="login-card__sub">{t('login.welcomeSub')}</p>
            </div>

            {error && (
              <div className="login-alert login-alert--error" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}
            {!error && successMessage && (
              <div className="login-alert login-alert--success" role="status">
                <CheckIcon />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-field__label" htmlFor="username">
                  {t('login.username')}
                </label>
                <div className="login-field__control">
                  <span className="login-field__icon">
                    <UserIcon />
                  </span>
                  <input
                    id="username"
                    ref={usernameRef}
                    className="login-field__input"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      clearFieldError('username')
                    }}
                    placeholder={t('login.usernamePlaceholder')}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    aria-invalid={!!fieldErrors.username}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                    required
                  />
                </div>
                {fieldErrors.username && (
                  <p className="login-field__error" id="username-error">
                    <AlertIcon size={13} />
                    {fieldErrors.username}
                  </p>
                )}
              </div>

              <div className="login-field login-field--password">
                <label className="login-field__label" htmlFor="password">
                  {t('login.password')}
                </label>
                <div className="login-field__control">
                  <span className="login-field__icon">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    className="login-field__input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearFieldError('password')
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="login-field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="login-field__error" id="password-error">
                    <AlertIcon size={13} />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="login-row">
                <span className="login-row__hint">{t('login.secureHint')}</span>
                <Link to="/forgot-password" className="login-link">
                  {t('login.forgotPassword')}
                </Link>
              </div>

              <button className="login-btn login-btn--primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    {t('login.loading')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </button>

              <p className="login-sep">{t('login.noAccount')}</p>
              <Link to="/activate" className="login-btn login-btn--secondary">
                {t('login.activate')}
              </Link>
            </form>

            <p className="login-footnote">{t('login.footnote')}</p>
          </div>
        </section>
      </div>

      <AASTUFooter />
    </div>
  )
}
