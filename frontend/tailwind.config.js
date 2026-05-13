export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aastu: {
          blue: '#0033A0',
          deep: '#071D3C',
          gold: '#D4A017',
          slate: '#0B1F34',
        },
      },
      boxShadow: {
        glow: '0 30px 70px rgba(0, 59, 175, 0.18)',
      },
      backgroundImage: {
        'hero-glow': 'radial-gradient(circle at top left, rgba(56, 116, 255, 0.18), transparent 35%), radial-gradient(circle at bottom right, rgba(212, 160, 23, 0.16), transparent 30%)',
      },
    },
  },
  plugins: [],
}
