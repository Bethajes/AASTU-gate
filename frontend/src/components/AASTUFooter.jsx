import { theme } from '../styles/theme'

export default function AASTUFooter() {
  const year = new Date().getFullYear()

  return (
    <footer style={styles.footer}>
      <div style={styles.goldBar} aria-hidden />
      <div style={styles.inner}>
        <p style={styles.university}>
          Addis Ababa Science and Technology University
        </p>
        <div style={styles.meta}>
          <span>Laptop Gate Pass System</span>
          <span style={styles.separator} aria-hidden>
            ·
          </span>
          <span>Akaky Kaliti, Addis Ababa, Ethiopia</span>
          <span style={styles.separator} aria-hidden>
            ·
          </span>
          <span>© {year}</span>
        </div>
      </div>
    </footer>
  )
}

const styles = {
  footer: {
    marginTop: 'auto',
    background: theme.footerGradient,
  },
  goldBar: {
    height: '3px',
    background: theme.gold,
    width: '100%',
  },
  inner: {
    padding: '22px clamp(16px, 4vw, 40px) 26px',
    textAlign: 'center',
  },
  university: {
    margin: 0,
    color: 'rgba(255,255,255,0.92)',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    lineHeight: 1.35,
  },
  meta: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px 12px',
    color: 'rgba(255,255,255,0.52)',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  separator: {
    color: theme.gold,
    opacity: 0.75,
    userSelect: 'none',
  },
}
