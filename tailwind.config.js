/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs système façon iOS, teintées aux couleurs de NIDOO
        fond: '#F2F1F8', // fond groupé : un rien plus gris que le blanc des cartes, pour qu'elles se détachent (Elisa, 25 novembre)
        carte: '#FFFFFF',
        encre: '#1D1A2B', // label
        brume: 'rgba(60, 56, 82, 0.76)', // label secondaire
        pale: 'rgba(60, 56, 82, 0.56)', // label tertiaire (assez foncé pour se lire : heures, indications)
        trait: 'rgba(60, 56, 82, 0.14)', // séparateur
        remplissage: 'rgba(118, 112, 148, 0.12)', // fill
        doux: '#F4F2F9', // le fond d'un champ ou d'une puce posés sur une carte blanche (sans trait)
        teinte: { DEFAULT: '#7050D5', doux: '#EEE8FC', fonce: '#6646CC' },
        peche: { DEFAULT: '#F58B5C', doux: '#FFEDE2', fonce: '#E26F3C' },
        rouge: '#FF453A',
        vert: '#34C759',
        or: '#F5B63B',
      },
      fontFamily: {
        // Nunito partout : des lettres arrondies, comme la maison et le panda (titres 800, textes 400, boutons 700).
        sans: ['"Nunito Variable"', 'Nunito', 'ui-rounded', '-apple-system', 'system-ui', 'sans-serif'],
        rond: ['"Nunito Variable"', 'Nunito', 'ui-rounded', '-apple-system', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Échelle typographique iOS (Dynamic Type, taille par défaut)
        grand: ['34px', { lineHeight: '41px', letterSpacing: '-0.6px', fontWeight: '800' }],
        titre1: ['28px', { lineHeight: '34px', letterSpacing: '-0.3px', fontWeight: '800' }],
        titre2: ['22px', { lineHeight: '28px', letterSpacing: '-0.2px', fontWeight: '800' }],
        titre3: ['20px', { lineHeight: '25px', letterSpacing: '-0.1px', fontWeight: '700' }],
        corps: ['17px', { lineHeight: '22px', letterSpacing: '-0.2px' }],
        appel: ['16px', { lineHeight: '21px', letterSpacing: '-0.15px' }],
        sous: ['15px', { lineHeight: '20px', letterSpacing: '-0.1px' }],
        note: ['13px', { lineHeight: '18px' }],
        legende: ['12px', { lineHeight: '16px' }],
        mini: ['11px', { lineHeight: '13px', letterSpacing: '0.06px' }],
      },
      borderRadius: { groupe: '22px', feuille: '34px' },
      boxShadow: {
        carte: '0 1px 2px rgba(29, 26, 43, 0.04), 0 6px 20px -8px rgba(29, 26, 43, 0.10)',
        verre: '0 8px 32px -6px rgba(29, 26, 43, 0.18), inset 0 0 0 0.5px rgba(255, 255, 255, 0.7)',
        flottant: '0 10px 30px -8px rgba(102, 70, 204, 0.45)',
      },
    },
  },
  plugins: [],
}
