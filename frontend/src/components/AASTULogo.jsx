import { useState } from 'react'
import { BRAND_LOGO, BRAND_LOGO_LAYOUT } from '../config/brand'
import { theme } from '../styles/theme'

/**
 * @param {'horizontal' | 'stacked' | 'mark'} orientation — layout of the official asset
 * @param {boolean} showText — when the image fails to load, show text next to the fallback mark
 * @param {'onDark' | 'onLight'} tone — fallback colors for header (dark) vs card (light)
 * @param {string} [className] — optional class for layout/responsive sizing
 */
export default function AASTULogo({
  orientation = 'stacked',
  showText = true,
  tone = 'onLight',
  className,
  style: outerStyle,
}) {
  const [failed, setFailed] = useState(false)
  const src = BRAND_LOGO[orientation]
  const layout = BRAND_LOGO_LAYOUT[orientation]

  if (failed) {
    return (
      <FallbackLogo
        orientation={orientation}
        showText={showText}
        tone={tone}
        className={className}
        style={outerStyle}
      />
    )
  }

  const imgStyle = {
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
    width: 'auto',
    height: 'auto',
    // When a className is supplied the stylesheet owns the height so it can
    // respond to breakpoints; keep a width cap as a safety net either way.
    ...(className
      ? { maxWidth: layout.maxWidth }
      : { maxHeight: layout.maxHeight, maxWidth: layout.maxWidth }),
    ...outerStyle,
  }

  return (
    <img
      src={src}
      alt="Addis Ababa Science and Technology University logo"
      className={className}
      style={imgStyle}
      onError={() => setFailed(true)}
    />
  )
}

function FallbackLogo({ orientation, showText, tone, className, style: outerStyle }) {
  const gold = theme.gold
  const onDark = tone === 'onDark'
  const titleColor = onDark ? theme.white : theme.blueBright
  const subColor = onDark ? gold : theme.darkGold
  const circleBorder = onDark ? `2px solid ${theme.white}` : `2px solid ${theme.blueBright}`

  const mark = (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: gold,
        border: circleBorder,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
        boxShadow: onDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,51,160,0.15)',
      }}
    >
      🎓
    </div>
  )

  if (orientation === 'mark' || !showText) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', ...outerStyle }}>
        {mark}
      </div>
    )
  }

  const row = orientation === 'horizontal'

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: row ? 12 : 14,
        flexDirection: row ? 'row' : 'column',
        textAlign: row ? 'left' : 'center',
        ...outerStyle,
      }}
    >
      {mark}
      <div>
        <div style={{ fontSize: row ? 15 : 18, fontWeight: 700, color: titleColor, lineHeight: 1.2 }}>
          AASTU
        </div>
        <div style={{ fontSize: row ? 11 : 12, color: subColor, fontWeight: 600, lineHeight: 1.2, marginTop: 2 }}>
          ICT & Campus Security
        </div>
      </div>
    </div>
  )
}
