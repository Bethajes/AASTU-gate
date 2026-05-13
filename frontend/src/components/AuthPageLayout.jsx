import { Link } from 'react-router-dom'
import AASTULogo from './AASTULogo'
import AASTUFooter from './AASTUFooter'
import { theme } from '../styles/theme'
import { useTranslation } from 'react-i18next'

/**
 * Auth routes: top bar uses horizontal logo; main area centers the card.
 */
export default function AuthPageLayout({ children }) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language?.startsWith('am') ? 'am' : 'en'

  return (
    <div className="auth-shell" style={styles.shell}>
      <header style={styles.topBar}>
        <Link
          to="/login"
          className="auth-brand-link"
          style={styles.brandLink}
          aria-label="AASTU Gate Pass — home"
        >
          <AASTULogo orientation="horizontal" showText={false} tone="onDark" />
        </Link>
        <div style={styles.topBarMeta}>
          <span style={styles.topBarTitle}>Laptop Gate Pass</span>
          <span style={styles.topBarSub}>AASTU campus access</span>
        </div>
        <div style={styles.langSwitcher}>
          <button
            type="button"
            style={{ ...styles.langBtn, ...(currentLang === 'en' ? styles.langBtnActive : {}) }}
            onClick={() => i18n.changeLanguage('en')}
            aria-label="Switch to English"
          >
            EN
          </button>
          <button
            type="button"
            style={{ ...styles.langBtn, ...(currentLang === 'am' ? styles.langBtnActive : {}) }}
            onClick={() => i18n.changeLanguage('am')}
            aria-label="Switch to Amharic"
          >
            አማ
          </button>
        </div>
      </header>

      <main className="auth-shell-main" style={styles.main}>
        {children}
      </main>

      <AASTUFooter />
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: `linear-gradient(160deg, ${theme.blueDeep} 0%, #0a1628 45%, #0f2847 100%)`,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
    padding: '16px clamp(20px, 4vw, 40px)',
    borderBottom: `3px solid ${theme.gold}`,
    background: theme.headerGradient,
    boxShadow: '0 8px 32px rgba(0, 24, 80, 0.35)',
  },
  brandLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    borderRadius: 8,
    outlineOffset: 4,
  },
  topBarMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    textAlign: 'right',
    gap: 2,
  },
  topBarTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  topBarSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: 500,
  },
  langSwitcher: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  langBtn: {
    padding: '5px 10px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)',
    border: '1.5px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  langBtnActive: {
    backgroundColor: theme.gold,
    color: '#0033A0',
    border: `1.5px solid ${theme.gold}`,
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px 40px',
  },
}
