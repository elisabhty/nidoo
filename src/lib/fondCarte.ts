// Le fond de carte et MapLibre, chargés à la demande : la carte de « Où sont mes proches ? » et l'aperçu d'un de nos
// lieux dans sa fiche partagent le même fond et le même travailleur.

/** Le fond de carte (Elisa, 26 novembre : « il y a pas une autre carte ? j'aime pas celle-là », puis « rétro ») :
 *  « Bright » d'OpenFreeMap, rangé avec l'appli (scripts/carte/style_nidoo.py) ; les tuiles, les noms et les icônes
 *  viennent toujours d'OpenFreeMap. */
export const STYLE_CARTE = 'carte/nidoo.json'
export const urlStyleCarte = () => new URL(STYLE_CARTE, window.location.href).href

/** MapLibre, sa feuille de style et son travailleur (rangé à côté par Vite : sinon MapLibre le cherche là où il n'est pas). */
export async function chargerMapLibre() {
  const [maplibre, travailleur] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ])
  maplibre.setWorkerUrl(new URL(travailleur.default, window.location.href).href)
  return maplibre
}

/** Le zoom où un cercle de ce rayon (en mètres) occupe à peu près `part` de la hauteur de la carte. */
export function zoomPourRayon(rayon: number, lat: number, hauteur: number, part = 0.56): number {
  const metresParPixelAuZoom0 = 78271.517 * Math.max(0.05, Math.cos((lat * Math.PI) / 180))
  return Math.min(18, Math.max(3, Math.log2((metresParPixelAuZoom0 * part * hauteur) / (2 * rayon))))
}
