// La carte en 3D (Elisa, 26 novembre : « est-ce possible d'améliorer la carte en mode 3D ? ») : la carte inclinée,
// les bâtiments en relief (leur hauteur vient des tuiles OpenFreeMap, schéma OpenMapTiles), une lumière douce.
// Ce qui ne dépend pas de MapLibre est ici, testé à part (tests/relief.test.mjs) : la couche des bâtiments, et le
// cadrage en perspective (MapLibre sait faire tenir des points sur une carte à plat, pas sur une carte inclinée).
import type { ExpressionSpecification, FillExtrusionLayerSpecification, LightSpecification } from 'maplibre-gl'

/** L'inclinaison de la vue 3D, en degrés (0 : à plat ; MapLibre va jusqu'à 60). */
export const PENTE = 55
/** Au-delà, on est « en 3D » : le bouton propose de revenir à plat. */
export const SEUIL_3D = 10
export const COUCHE_BATIMENTS = 'nidoo-batiments-3d'

/** Les bâtiments en relief : leur vraie hauteur (5 m quand OpenStreetMap ne la connaît pas), dans le beige du fond
 *  « Rétro », un peu plus soutenu pour les tours. Les tuiles ne donnent la hauteur qu'à partir du zoom 14 : les bâtiments y poussent
 *  en douceur au lieu d'apparaître d'un coup. Les parties d'un bâtiment déjà dessinées à part (hide_3d) sont sautées. */
export function coucheBatiments(source: string): FillExtrusionLayerSpecification {
  const haut: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 5]
  const bas: ExpressionSpecification = ['coalesce', ['get', 'render_min_height'], 0]
  return {
    id: COUCHE_BATIMENTS,
    type: 'fill-extrusion',
    source,
    'source-layer': 'building',
    minzoom: 14,
    filter: ['!', ['has', 'hide_3d']],
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], haut, 0, '#EDE6DA', 30, '#E6DFD2', 80, '#DDD5C7'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.8, haut],
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.8, bas],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, 0.95],
      'fill-extrusion-vertical-gradient': true,
    },
  }
}

/** Où glisser les bâtiments en relief : juste avant les noms (le dernier bloc de couches de texte), après toutes les
 *  rues, ponts et bâtiments à plat ; sinon ceux-là seraient peints par-dessus le relief. Certains fonds glissent une
 *  couche de texte au milieu des rues (les flèches des sens uniques) : ce n'est pas encore « les noms ». */
export function avantLesNoms(couches: readonly { id: string; type: string }[]): string | undefined {
  let i = couches.length
  while (i > 0 && couches[i - 1].type === 'symbol') i--
  return couches[i]?.id
}

/** Une lumière douce venue de l'avant (liée à l'écran : les façades restent lisibles quand on tourne la carte). */
export const LUMIERE: LightSpecification = { anchor: 'viewport', color: '#FFFFFF', intensity: 0.2, position: [1.5, 165, 50] }

// ───── Le cadrage en perspective ─────

export type Vue = { lon: number; lat: number; zoom: number; pitch: number; bearing: number }
/** Ce dont le cadrage a besoin d'une carte. `poser` doit changer la vue tout de suite (MapLibre : jumpTo). */
export interface Camera {
  taille(): { w: number; h: number }
  lire(): Vue
  poser(v: Partial<Vue>): void
  projeter(lon: number, lat: number): { x: number; y: number }
  deprojeter(x: number, y: number): { lon: number; lat: number }
}
export type Marges = { top: number; bottom: number; left: number; right: number }
type LieuGeo = { lat: number; lon: number }

/**
 * La vue où tous les points tiennent dans la carte, marges comprises, à cette inclinaison (et à l'orientation
 * actuelle). Sur une carte inclinée, ce qui est loin est plus petit que ce qui est près : on essaie, on regarde où
 * tombent les points, on corrige le zoom et le centre, et ainsi de suite (quelques essais suffisent). La carte
 * revient ensuite où elle était : c'est à l'appelant de s'y rendre (en glissant ou d'un coup). Une personne seule (ou
 * des points très proches) : au milieu de la place, au zoom le plus serré permis (maxZoom).
 * `depart` : une première idée (le cadrage à plat de MapLibre). null : rien à cadrer, ou pas la place.
 */
export function cadrer(cam: Camera, points: readonly LieuGeo[], o: { depart: { lon: number; lat: number; zoom: number }; pitch: number; marges: Marges; maxZoom: number; minZoom?: number }): Vue | null {
  if (!points.length) return null
  const { w, h } = cam.taille()
  const g = o.marges.left
  const d = w - o.marges.right
  const t = o.marges.top
  const b = h - o.marges.bottom
  if (d - g < 20 || b - t < 20) return null
  const minZoom = o.minZoom ?? 1
  const borne = (z: number) => Math.min(o.maxZoom, Math.max(minZoom, z))
  const avant = cam.lire()
  try {
    cam.poser({ lon: o.depart.lon, lat: o.depart.lat, zoom: borne(o.depart.zoom), pitch: o.pitch, bearing: avant.bearing })
    // la boîte des points à l'écran (null : un point qu'on ne sait pas placer)
    const boite = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const p of points) {
        const e = cam.projeter(p.lon, p.lat)
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return null
        x0 = Math.min(x0, e.x); x1 = Math.max(x1, e.x)
        y0 = Math.min(y0, e.y); y1 = Math.max(y1, e.y)
      }
      return { x0, x1, y0, y1 }
    }
    const cx = (g + d) / 2
    const cy = (t + b) / 2
    for (let essai = 0; essai < 24; essai++) {
      // 1. on glisse la carte au sol : ce qui est sous le milieu des points vient sous le milieu de la place (sur une
      //    carte inclinée, un pixel ne vaut pas la même distance en haut et en bas : on compte en mètres)
      let e = boite()
      if (!e) return null
      const mx = (e.x0 + e.x1) / 2
      const my = (e.y0 + e.y1) / 2
      const decale = Math.abs(mx - cx) >= 0.5 || Math.abs(my - cy) >= 0.5
      if (decale) {
        const sous = cam.deprojeter(mx, my)
        const vise = cam.deprojeter(cx, cy)
        const ici = cam.lire()
        const lon = ici.lon + (sous.lon - vise.lon)
        const lat = ici.lat + (sous.lat - vise.lat)
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
        cam.poser({ lon, lat })
        e = boite()
        if (!e) return null
      }
      // 2. puis le zoom : ce que les points débordent (ou flottent) dans la place qu'on leur laisse
      const echelle = Math.max((e.x1 - e.x0) / (d - g), (e.y1 - e.y0) / (b - t))
      const z0 = cam.lire().zoom
      const z = borne(echelle > 1e-6 ? z0 - Math.log2(echelle) : o.maxZoom)
      if (Math.abs(z - z0) < 0.003 && !decale) break
      cam.poser({ zoom: z })
    }
    return cam.lire()
  } finally {
    cam.poser(avant)
  }
}

// ───── Le choix 3D ou à plat, gardé sur le téléphone ─────

const CLE = 'nidoo.carte.relief'
/** En 3D sauf si on a choisi la carte à plat. */
export function reliefChoisi(): boolean {
  try {
    return localStorage.getItem(CLE) !== '0'
  } catch {
    return true
  }
}
export function choisirRelief(oui: boolean) {
  try {
    localStorage.setItem(CLE, oui ? '1' : '0')
  } catch {
    /* pas de stockage : on reviendra en 3D */
  }
}
