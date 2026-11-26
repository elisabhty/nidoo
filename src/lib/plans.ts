import { Capacitor } from '@capacitor/core'
import { choisir } from '../components/ui'

// Aller à un lieu : avec Plans, Google Maps, Citymapper ou Waze (Elisa, 21 novembre).
// Ce sont des liens universels : l'appli s'ouvre si elle est installée, sinon le site (rien à installer côté iPhone).

/** Le point exact d'une de nos adresses (« École ») : son nom seul ne dirait rien à une appli de cartes. */
type Vers = { lat: number; lon: number }
const pt = (p: Vers) => `${p.lat},${p.lon}`
const APPLIS = [
  { cle: 'plans', label: 'Plans', url: (l: string, p?: Vers) => `https://maps.apple.com/?daddr=${p ? pt(p) : encodeURIComponent(l)}` },
  { cle: 'google', label: 'Google Maps', url: (l: string, p?: Vers) => `https://www.google.com/maps/dir/?api=1&destination=${p ? pt(p) : encodeURIComponent(l)}` },
  { cle: 'citymapper', label: 'Citymapper', url: (l: string, p?: Vers) => `https://citymapper.com/directions?${p ? `endcoord=${pt(p)}` : `endaddress=${encodeURIComponent(l)}`}&endname=${encodeURIComponent(l)}` },
  { cle: 'waze', label: 'Waze', url: (l: string, p?: Vers) => `https://waze.com/ul?${p ? `ll=${pt(p)}` : `q=${encodeURIComponent(l)}`}&navigate=yes` },
]
const PREFEREE = 'nidoo.plans'

/** Propose les applis de cartes (la dernière choisie en premier) et ouvre le lieu dans celle qu'on touche.
 *  `vers` : le point exact, pour une de nos adresses. */
export async function ouvrirLieu(lieu: string, vers?: Vers) {
  let pref = ''
  try {
    pref = localStorage.getItem(PREFEREE) ?? ''
  } catch {
    /* rien */
  }
  const ordre = [...APPLIS].sort((a, b) => Number(b.cle === pref) - Number(a.cle === pref))
  const i = await choisir({ title: 'Y aller avec…', message: lieu, actions: ordre.map((a) => ({ label: a.label })) })
  if (i < 0) return
  const app = ordre[i]
  try {
    localStorage.setItem(PREFEREE, app.cle)
  } catch {
    /* rien */
  }
  // dans l'appli iPhone, une adresse d'ailleurs s'ouvre dans l'appli concernée (ou Safari)
  const w = window.open(app.url(lieu, vers), '_blank')
  if (!w && !Capacitor.isNativePlatform()) location.href = app.url(lieu, vers)
}
