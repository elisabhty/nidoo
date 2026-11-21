// Les suggestions d'adresse quand on tape le lieu d'un événement (Elisa, 21 novembre : « une liste ? gratuite ? »).
// Deux services gratuits, sans clé :
// • le géocodage de la Géoplateforme (IGN), qui a repris l'API Adresse de la Base Adresse Nationale : les adresses en France ;
// • Photon (Komoot, données OpenStreetMap) : les lieux qui ont un nom (restaurants, gares, parcs, écoles…).
// Seul ce qu'on tape part vers ces services (pas de nom, pas de compte), et seulement à partir de 3 lettres.

export type Suggestion = { texte: string; titre: string; detail: string; genre: 'adresse' | 'lieu' | 'ville' }

type FeatureBan = { properties: { label?: string; name?: string; city?: string; postcode?: string; context?: string; type?: string } }
type FeaturePhoton = { properties: { name?: string; housenumber?: string; street?: string; postcode?: string; city?: string; country?: string; osm_key?: string; osm_value?: string; type?: string } }

const LIEUX = new Set(['amenity', 'shop', 'tourism', 'leisure', 'railway', 'aeroway', 'historic', 'office', 'healthcare', 'craft', 'public_transport', 'sport'])

async function json<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

export async function chercherAdresses(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const t = q.trim()
  if (t.length < 3) return []
  const enc = encodeURIComponent(t)
  const [ban, photon] = await Promise.all([
    json<{ features?: FeatureBan[] }>(`https://data.geopf.fr/geocodage/search?q=${enc}&autocomplete=1&limit=4`, signal),
    json<{ features?: FeaturePhoton[] }>(`https://photon.komoot.io/api/?q=${enc}&lang=fr&limit=6&lat=46.6&lon=2.4`, signal),
  ])
  const lieux: Suggestion[] = (photon?.features ?? [])
    .map((f) => f.properties)
    .filter((p) => p.name && p.osm_key && LIEUX.has(p.osm_key))
    .slice(0, 3)
    .map((p) => {
      const rue = [p.housenumber, p.street].filter(Boolean).join(' ')
      const ville = [p.postcode, p.city].filter(Boolean).join(' ')
      const detail = [rue, ville].filter(Boolean).join(', ') || p.country || ''
      return { titre: p.name!, detail, texte: [p.name, rue, p.city].filter(Boolean).join(', '), genre: 'lieu' as const }
    })
  const adresses: Suggestion[] = (ban?.features ?? [])
    .map((f) => f.properties)
    .filter((p) => p.label)
    .map((p) => {
      const ville = p.type === 'municipality'
      return {
        titre: ville ? (p.city ?? p.label!) : (p.name ?? p.label!),
        detail: ville ? (p.context ?? '') : [p.postcode, p.city].filter(Boolean).join(' '),
        texte: p.label!,
        genre: ville ? ('ville' as const) : ('adresse' as const),
      }
    })
  const vus = new Set<string>()
  return [...lieux, ...adresses].filter((s) => {
    const k = s.texte.toLowerCase()
    if (vus.has(k)) return false
    vus.add(k)
    return true
  }).slice(0, 6)
}
