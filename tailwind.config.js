/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // FES brand (blue primary)
        fes: {
          blue: '#0A38F5',        // primary CTA / active states
          'blue-hover': '#0930D4',
          'blue-soft': '#E8EDFF', // light bg for active tool tile
          'blue-50': '#F2F5FF',   // even lighter wash
        },
        // Admitly brand (yellow — used only for Admitly-tied UI)
        admitly: {
          yellow: '#FFD43B',
          'yellow-hover': '#FFCC00',
          black: '#0A0A0A',
          'off-black': '#1A1A1A',
          mint: '#DFF5E5',
          green: '#0FA968',
          coral: '#FF6B5E',
          cream: '#FAFAFB',       // neutral canvas
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        display: ['"DM Sans"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        'score': ['5rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '900' }],
        'score-xl': ['7rem', { lineHeight: '1', letterSpacing: '-0.05em', fontWeight: '900' }],
        'watermark': ['9rem', { lineHeight: '0.9', letterSpacing: '-0.06em', fontWeight: '900' }],
      },
    },
  },
  plugins: [],
}
