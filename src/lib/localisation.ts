// « Où est la famille » (Elisa, 21 novembre) : la dernière position de chacun, s'il a choisi de la partager.
// Dans l'appli iPhone, la position vient du téléphone (CoreLocation) et se met à jour en arrière-plan quand on bouge
// (environ 500 m, peu de batterie) ; la rue et la ville viennent du géocodage d'Apple, sur le téléphone.
// Sur le web : une seule position, quand on la demande (navigateur), la rue et la ville par la Géoplateforme (IGN).
// La base ne garde qu'une ligne par personne, jamais d'historique (supabase/migrations/20261121220000_positions.sql).
import type { Position } from './types'
import { NATIF_IOS, pont } from './pont'

/** Ce que le téléphone donne : où, à quelle précision, la rue et la ville, la batterie. */
export type PositionLue = { lat: number; lon: number; precision?: number | null; lieu?: string | null; ville?: string | null; batterie?: number | null }

/** L'autorisation de l'iPhone : jamais demandée, refusée, quand l'appli est ouverte, toujours. */
export type Autorisation = 'inconnue' | 'refusee' | 'active' | 'toujours'

export class PositionErreur extends Error {
  constructor(public raison: 'refusee' | 'indisponible' | 'delai') {
    super(raison === 'refusee' ? 'POSITION_REFUSEE' : raison === 'delai' ? 'POSITION_DELAI' : 'POSITION_INDISPONIBLE')
  }
}

/** Le texte à montrer quand la position n'a pas pu être lue. */
export function messagePosition(e: unknown): string {
  const r = e instanceof PositionErreur ? e.raison : /REFUS|DENIED|denied/i.test(String((e as Error)?.message ?? e)) ? 'refusee' : 'indisponible'
  if (r === 'refusee') return NATIF_IOS ? 'NIDOO n’a pas accès à ta position : Réglages › NIDOO › Position.' : 'Ton navigateur refuse de donner ta position.'
  if (r === 'delai') return 'Ta position met trop de temps à arriver. Réessaie dehors ou près d’une fenêtre.'
  return 'Impossible de trouver ta position pour le moment.'
}

export async function autorisation(): Promise<Autorisation> {
  if (pont) {
    try {
      return (await pont.positionAutorisation()).etat
    } catch {
      return 'inconnue'
    }
  }
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    return p?.state === 'granted' ? 'active' : p?.state === 'denied' ? 'refusee' : 'inconnue'
  } catch {
    return 'inconnue'
  }
}

/** Lire la position maintenant (demande l'autorisation la première fois). */
export async function lirePosition(): Promise<PositionLue> {
  if (pont) {
    try {
      return await pont.positionMaintenant()
    } catch (e) {
      const m = String((e as Error)?.message ?? e)
      throw new PositionErreur(/REFUS/i.test(m) ? 'refusee' : /DELAI/i.test(m) ? 'delai' : 'indisponible')
    }
  }
  if (!navigator.geolocation) throw new PositionErreur('indisponible')
  const p = await new Promise<GeolocationPosition>((ok, ko) =>
    navigator.geolocation.getCurrentPosition(ok, (e) => ko(new PositionErreur(e.code === 1 ? 'refusee' : e.code === 3 ? 'delai' : 'indisponible')), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    }),
  )
  const { latitude: lat, longitude: lon, accuracy } = p.coords
  const [adresse, batterie] = await Promise.all([rueEtVille(lat, lon), batterieNavigateur()])
  return { lat, lon, precision: Math.round(accuracy), ...adresse, batterie }
}

/** En arrière-plan (iPhone) : suivre ses déplacements, ou arrêter. Sur le web : rien (une seule position à la fois). */
export async function suivre(oui: boolean): Promise<Autorisation | null> {
  if (!pont) return null
  try {
    return (await pont.positionSuivre({ oui })).etat
  } catch {
    return null
  }
}

/** La rue et la ville d'un point (Géoplateforme, puis Photon hors de France). */
async function rueEtVille(lat: number, lon: number): Promise<{ lieu: string | null; ville: string | null }> {
  const lire = async <T,>(url: string): Promise<T | null> => {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout?.(6000) })
      return r.ok ? ((await r.json()) as T) : null
    } catch {
      return null
    }
  }
  type Ban = { features?: { properties: { name?: string; street?: string; city?: string; type?: string } }[] }
  const ban = await lire<Ban>(`https://data.geopf.fr/geocodage/reverse?lat=${lat}&lon=${lon}&limit=1`)
  const b = ban?.features?.[0]?.properties
  if (b?.city) return { lieu: b.street ?? (b.type === 'municipality' ? null : (b.name ?? null)), ville: b.city }
  type Photon = { features?: { properties: { name?: string; street?: string; city?: string; town?: string; village?: string } }[] }
  const ph = (await lire<Photon>(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=fr`))?.features?.[0]?.properties
  return { lieu: ph?.street ?? ph?.name ?? null, ville: ph?.city ?? ph?.town ?? ph?.village ?? null }
}

async function batterieNavigateur(): Promise<number | null> {
  try {
    const b = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.()
    return b ? Math.round(b.level * 100) : null
  } catch {
    return null
  }
}

// ce qu'on affiche (sans rien de natif : testé à part)
export { ancienne, cadre, distance, ilYA, libelle, POSITION_DEMO, texteDistance } from './positions'
