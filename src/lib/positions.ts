// « Où est la famille » : ce qu'on affiche d'une position (depuis quand, où, à quelle distance), sans rien de natif.
import type { Position } from './types'

/** « à l'instant », « il y a 5 min », « il y a 2 h », « hier à 18:30 », « le 12 nov. ». */
export function ilYA(quand: string, maintenant = Date.now()): string {
  const t = new Date(quand).getTime()
  const min = Math.max(0, Math.round((maintenant - t) / 60000))
  if (min < 2) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  const d = new Date(t)
  const auj = new Date(maintenant)
  const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (min < 6 * 60 || memeJour(d, auj)) return `il y a ${h} h`
  const hier = new Date(maintenant - 86400000)
  const heure = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (memeJour(d, hier)) return `hier à ${heure}`
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}

/** Une position qui a plus de 12 h : on la montre plus pâle, elle n'est peut-être plus vraie. */
export const ancienne = (p: Pick<Position, 'updated_at'>, maintenant = Date.now()) => maintenant - new Date(p.updated_at).getTime() > 12 * 3600000

/** « Rue André Lalande, Évry » ; sans rue : la ville ; sans rien : « Position partagée ». */
export function libelle(p: Pick<Position, 'lieu' | 'ville'>): string {
  const l = p.lieu?.trim()
  const v = p.ville?.trim()
  if (l && v && !l.toLowerCase().includes(v.toLowerCase())) return `${l}, ${v}`
  return l || v || 'Position partagée'
}

/** La distance en mètres entre deux points (formule de haversine). */
export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** « à 300 m », « à 2,4 km », « à 35 km ». */
export function texteDistance(m: number): string {
  if (m < 100) return 'tout près'
  if (m < 1000) return `à ${Math.round(m / 50) * 50} m`
  if (m < 10000) return `à ${(Math.round(m / 100) / 10).toLocaleString('fr-FR')} km`
  return `à ${Math.round(m / 1000)} km`
}

/** Le cadre qui montre tout le monde sur la carte (au moins ~1 km de côté). */
export function cadre(points: { lat: number; lon: number }[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  let s = 90, w = 180, n = -90, e = -180
  for (const p of points) {
    s = Math.min(s, p.lat); n = Math.max(n, p.lat)
    w = Math.min(w, p.lon); e = Math.max(e, p.lon)
  }
  const marge = 0.005
  if (n - s < marge * 2) { const c = (n + s) / 2; s = c - marge; n = c + marge }
  if (e - w < marge * 2) { const c = (e + w) / 2; w = c - marge; e = c + marge }
  return [[w, s], [e, n]]
}
