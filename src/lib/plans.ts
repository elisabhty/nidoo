import { Capacitor } from '@capacitor/core'
import { choisir } from '../components/ui'

// Aller à un lieu : avec Plans, Google Maps, Citymapper ou Waze (Elisa, 21 novembre).
// Ce sont des liens universels : l'appli s'ouvre si elle est installée, sinon le site (rien à installer côté iPhone).

const APPLIS = [
  { cle: 'plans', label: 'Plans', url: (l: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(l)}` },
  { cle: 'google', label: 'Google Maps', url: (l: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l)}` },
  { cle: 'citymapper', label: 'Citymapper', url: (l: string) => `https://citymapper.com/directions?endaddress=${encodeURIComponent(l)}&endname=${encodeURIComponent(l)}` },
  { cle: 'waze', label: 'Waze', url: (l: string) => `https://waze.com/ul?q=${encodeURIComponent(l)}&navigate=yes` },
]
const PREFEREE = 'nidoo.plans'

/** Propose les applis de cartes (la dernière choisie en premier) et ouvre le lieu dans celle qu'on touche. */
export async function ouvrirLieu(lieu: string) {
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
  const w = window.open(app.url(lieu), '_blank')
  if (!w && !Capacitor.isNativePlatform()) location.href = app.url(lieu)
}
