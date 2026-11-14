/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        creme: '#FFF8F0',
        lin: '#F6EDE3',
        encre: '#2F2A44',
        brume: '#7A748F',
        lavande: { 50: '#F6F2FD', 100: '#ECE4FA', 200: '#DACBF5', 300: '#C2ACEC', 400: '#A88CE0', 500: '#8E6FD1', 600: '#7556B8' },
        peche: { 50: '#FFF3EA', 100: '#FFE4D2', 200: '#FFCDAE', 300: '#FFB088', 400: '#F99263', 500: '#EE7A4B' },
        roux: '#E2702F',
        mousse: '#8DBF9A',
      },
      fontFamily: {
        titre: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Nunito Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        doux: '0 8px 24px -10px rgba(117, 86, 184, 0.28)',
        carte: '0 2px 10px -4px rgba(47, 42, 68, 0.12)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
