// Les suggestions d'adresse quand on tape le lieu d'un événement (Elisa, 21 novembre : « une liste ? gratuite ? »).
// Deux services gratuits, sans clé :
// • le géocodage de la Géoplateforme (IGN), qui a repris l'API Adresse de la Base Adresse Nationale : les adresses en France ;
// • Photon (Komoot, données OpenStreetMap) : les lieux qui ont un nom (restaurants, gares, parcs, écoles…).
// Seul ce qu'on tape part vers ces services (pas de nom, pas de compte), et seulement à partir de 3 lettres.

export type Suggestion = { texte: string; titre: string; detail: string; genre: 'adresse' | 'lieu' | 'ville'; cp?: string; ville?: string }

type FeatureBan = { properties: { label?: string; name?: string; city?: string; postcode?: string; context?: string; type?: string; score?: number } }

/** Un code postal tapé (5 chiffres) : les suggestions s'y limitent (Elisa, 21 novembre : « détecter les codes postaux,
 *  pour ne pas se tromper avec la même adresse dans deux villes différentes »). */
export const codePostal = (q: string) => /(?:^|\D)(\d{5})(?:\D|$)/.exec(q)?.[1] ?? null
/** Le département, pris dans le contexte de la Géoplateforme (« 91, Essonne, Île-de-France » → « Essonne »). */
const departement = (context?: string) => context?.split(',')[1]?.trim() ?? ''
/** Ça ressemble à une adresse (un numéro, ou un mot de rue), pas juste à « chez Mamie ». */
export const ressembleAdresse = (q: string) => /\d/.test(q) || /(?:^|[\s,])(rue|avenue|av|bd|boulevard|chemin|allée|allee|place|impasse|route|quai|cours|square|résidence|residence|lotissement|lieu-dit|voie|sentier|passage)(?=$|[\s,.])/i.test(q)

const sansAccents = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
/** Ajoute le code postal à une adresse tapée, sans rien perdre de ce qu'on a écrit (résidence, appartement…) :
 *  « 15 rue André Lalande, Evry » → « 15 rue André Lalande, 91000 Evry » ; sans la ville : « …, 91000 Évry-Courcouronnes ». */
export function avecCodePostal(texte: string, cp: string, ville: string): string {
  const base = texte.trim().replace(/[,\s]+$/, '')
  const mot = sansAccents(ville).split(/[\s-]/)[0]
  let norm = ''
  const pos: number[] = []
  for (let i = 0; i < base.length; i++) for (const c of sansAccents(base[i])) {
    norm += c
    pos.push(i)
  }
  const m = mot.length >= 3 ? new RegExp(`(^|[\\s,])${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,-])`).exec(norm) : null
  if (m) {
    const debut = pos[m.index + m[1].length]
    return `${base.slice(0, debut).replace(/[,\s]+$/, '')}, ${cp} ${base.slice(debut)}`
  }
  return `${base}, ${cp} ${ville}`
}
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
  const cp = codePostal(t)
  const [ban, photon] = await Promise.all([
    json<{ features?: FeatureBan[] }>(`https://data.geopf.fr/geocodage/search?q=${enc}&autocomplete=1&limit=5${cp ? `&postcode=${cp}` : ''}`, signal),
    json<{ features?: FeaturePhoton[] }>(`https://photon.komoot.io/api/?q=${enc}&lang=fr&limit=6&lat=46.6&lon=2.4`, signal),
  ])
  const lieux: Suggestion[] = (photon?.features ?? [])
    .map((f) => f.properties)
    .filter((p) => p.name && p.osm_key && LIEUX.has(p.osm_key) && (!cp || p.postcode === cp))
    .slice(0, 3)
    .map((p) => {
      const rue = [p.housenumber, p.street].filter(Boolean).join(' ')
      const ville = [p.postcode, p.city].filter(Boolean).join(' ')
      const detail = [rue, ville].filter(Boolean).join(', ') || p.country || ''
      // le code postal reste dans l'adresse : deux villes peuvent avoir le même nom de rue
      return { titre: p.name!, detail, texte: [p.name, rue, ville].filter(Boolean).join(', '), genre: 'lieu' as const, cp: p.postcode, ville: p.city }
    })
  const adresses: Suggestion[] = (ban?.features ?? [])
    .map((f) => f.properties)
    .filter((p) => p.label)
    .map((p) => {
      const ville = p.type === 'municipality'
      return {
        titre: ville ? (p.city ?? p.label!) : (p.name ?? p.label!),
        detail: ville ? (p.context ?? '') : [p.city, departement(p.context)].filter(Boolean).join(' · '),
        texte: ville ? p.label! : [p.name, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || p.label!,
        genre: ville ? ('ville' as const) : ('adresse' as const),
        cp: p.postcode,
        ville: p.city,
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

/** Une adresse tapée sans code postal : on cherche à quoi elle correspond. Une seule ville possible : l'adresse complète
 *  (avec son code postal) ; plusieurs : les villes, pour choisir ; rien de sûr : null. */
export async function verifierAdresse(q: string, signal?: AbortSignal): Promise<{ sure: Suggestion | null; choix: Suggestion[] } | null> {
  const t = q.trim()
  if (t.length < 5 || codePostal(t) || !ressembleAdresse(t)) return null
  const ban = await json<{ features?: FeatureBan[] }>(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(t)}&limit=6`, signal ?? new AbortController().signal)
  const bons = (ban?.features ?? []).map((f) => f.properties).filter((p) => p.label && p.postcode && p.type !== 'municipality' && (p.score ?? 0) >= 0.45)
  if (!bons.length) return null
  const parCp = new Map<string, FeatureBan['properties']>()
  for (const p of bons) if (!parCp.has(`${p.postcode} ${p.city}`)) parCp.set(`${p.postcode} ${p.city}`, p)
  const vers = (p: FeatureBan['properties']): Suggestion => ({
    titre: p.name ?? p.label!,
    detail: [p.city, departement(p.context)].filter(Boolean).join(' · '),
    texte: [p.name, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    genre: 'adresse',
    cp: p.postcode,
    ville: p.city,
  })
  const liste = [...parCp.values()]
  // les villes vraiment possibles (à 0,15 près de la meilleure)
  const proches = liste.filter((p) => (p.score ?? 0) >= (liste[0].score ?? 0) - 0.15).slice(0, 4)
  // une seule, et bien reconnue : on complète
  if (proches.length === 1) return (proches[0].score ?? 0) >= 0.6 ? { sure: vers(proches[0]), choix: [] } : null
  // plusieurs villes : on demande laquelle
  return { sure: null, choix: proches.map(vers) }
}
