import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AASTULogo from './AASTULogo'
import { theme } from '../styles/theme'
import { useTranslation } from 'react-i18next'

export default function AASTUHeader({ subtitle = 'Portal' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleLabel = {
    STUDENT: 'Student',
    GUARD: 'Security',
    ADMIN: 'Administrator',
  }

  const currentLang = i18n.language?.startsWith('am') ? 'am' : 'en'

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <AASTULogo orientation="horizontal" showText={false} tone="onDark" />
      </div>

      <div style={styles.center}>
        <span style={styles.brandLine}>{t('nav.brandLine')}</span>
        <span style={styles.pageSubtitle}>{subtitle}</span>
      </div>

      <div style={styles.right}>
        {/* Language switcher */}
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

        <div style={styles.userInfo}>
          <span style={styles.userName}>{user?.name}</span>
          <span style={styles.userRole}>{roleLabel[user?.role]}</span>
        </div>
        <button type="button" style={styles.logoutBtn} onClick={handleLogout}>
          {t('nav.logout')}
        </button>
      </div>
    </header>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '14px clamp(16px, 4vw, 40px)',
    minHeight: '72px',
    boxSizing: 'border-box',
    background: theme.headerGradient,
    borderBottom: `3px solid ${theme.gold}`,
    boxShadow: '0 4px 24px rgba(0, 32, 128, 0.22)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '160px',
    textAlign: 'center',
  },
  brandLine: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 'clamp(14px, 2.2vw, 16px)',
    fontWeight: 700,
    letterSpacing: '0.03em',
  },
  pageSubtitle: {
    color: theme.gold,
    fontSize: '11px',
    fontWeight: 600,
    marginTop: '4px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  right: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  userName: {
    color: theme.white,
    fontSize: '14px',
    fontWeight: 600,
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '11px',
    fontWeight: 500,
    marginTop: '2px',
  },
  logoutBtn: {
    padding: '8px 18px',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: theme.white,
    border: `1.5px solid ${theme.gold}`,
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
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
    transition: 'all 0.15s',
  },
  langBtnActive: {
    backgroundColor: theme.gold,
    color: '#0033A0',
    border: `1.5px solid ${theme.gold}`,
  },
}
