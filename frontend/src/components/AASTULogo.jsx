import { useState } from 'react'
import { BRAND_LOGO, BRAND_LOGO_LAYOUT } from '../config/brand'
import { theme } from '../styles/theme'

/**
 * @param {'horizontal' | 'stacked' | 'mark'} orientation — layout of the official asset
 * @param {boolean} showText — when the image fails to load, show text next to the fallback mark
 * @param {'onDark' | 'onLight'} tone — fallback colors for header (dark) vs card (light)
 */
export default function AASTULogo({
  orientation = 'stacked',
  showText = true,
  tone = 'onLight',
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
        style={outerStyle}
      />
    )
  }

  const imgStyle = {
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
    maxHeight: layout.maxHeight,
    maxWidth: layout.maxWidth,
    width: 'auto',
    height: 'auto',
    ...outerStyle,
  }

  return (
    <img
      src={src}
      alt="Addis Ababa Science and Technology University logo"
      style={imgStyle}
      onError={() => setFailed(true)}
    />
  )
}

function FallbackLogo({ orientation, showText, tone, style: outerStyle }) {
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
      <div style={{ display: 'flex', alignItems: 'center', ...outerStyle }}>
        {mark}
      </div>
    )
  }

  const row = orientation === 'horizontal'

  return (
    <div
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
          Laptop Gate Pass
        </div>
      </div>
    </div>
  )
}
