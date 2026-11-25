// Teindre les cheveux (ou le voile) d'une figurine, pixel par pixel, sans rien d'autre que des tableaux :
// ce fichier ne touche ni au navigateur ni aux images, pour pouvoir être vérifié par les tests.
//
// Avant (jusqu'au 25 novembre 2026), on décalait la couleur moyenne et on multipliait le relief : des cheveux
// noirs passés au bleu voyaient leurs reflets, et surtout leur bord (mêlé au fond blanc d'origine), partir au
// blanc — un liseré blanc tout autour de la tête, des éclats dans les barbes (Elisa : « il y a vraiment un souci
// au niveau des personnages »). Maintenant :
// - le relief est ramené à une amplitude fixée par la couleur d'arrivée (les creux et les reflets des cheveux
//   de départ deviennent les creux et les reflets de la nouvelle couleur, jamais plus) ;
// - le bord extérieur ne peut pas être plus clair que la couleur elle-même ;
// - là où les cheveux se mêlent à la peau (la frange sur le front, une barbe clairsemée), le pixel est traité
//   comme un mélange : sa part de cheveux change de couleur, sa part de peau reste de la peau ;
// - la barbe a ses propres repères (elle est souvent plus claire que les cheveux).

export type Lab = [number, number, number]

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const fl = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
const fi = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)

export function rgb2lab(r: number, g: number, b: number): Lab {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255)
  const x = fl((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047)
  const y = fl(R * 0.2126 + G * 0.7152 + B * 0.0722)
  const z = fl((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
export function lab2rgb(L: number, a: number, b: number): [number, number, number] {
  const y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200
  const X = fi(x) * 0.95047, Y = fi(y), Z = fi(z) * 1.08883
  const R = gam(X * 3.2406 + Y * -1.5372 + Z * -0.4986)
  const G = gam(X * -0.9689 + Y * 1.8758 + Z * 0.0415)
  const B = gam(X * 0.0557 + Y * -0.204 + Z * 1.057)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return [c(R), c(G), c(B)]
}

const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Tout ce qui est à `r` pixels ou moins d'un pixel marqué (carré : bien assez précis pour 2 à 9 pixels). */
export function autour(src: Uint8Array, W: number, H: number, r: number): Uint8Array {
  const a = new Uint8Array(W * H), b = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = -r; x < W; x++) {
      if (x + r < W) n += src[y * W + x + r]
      if (x - r - 1 >= 0) n -= src[y * W + x - r - 1]
      if (x >= 0) b[y * W + x] = n > 0 ? 1 : 0
    }
  }
  for (let x = 0; x < W; x++) {
    let n = 0
    for (let y = -r; y < H; y++) {
      if (y + r < H) n += b[(y + r) * W + x]
      if (y - r - 1 >= 0) n -= b[(y - r - 1) * W + x]
      if (y >= 0) a[y * W + x] = n > 0 ? 1 : 0
    }
  }
  return a
}

/** L'amplitude du relief d'une couleur de cheveux : combien ses reflets sont plus clairs, ses creux plus sombres. */
export function amplitude(T: number): { haut: number; bas: number } {
  return { haut: 6 + 14 * Math.sin((Math.PI * borne(T, 0, 100)) / 100), bas: 4 + 0.22 * T }
}

/** Le relief, de -1 (creux) à 1 (reflet) ; au-delà, il s'écrase vite (jamais plus de ±1,35). */
const doux = (r: number) => {
  const v = Math.abs(r)
  return v <= 1 ? r : Math.sign(r) * (1 + 0.35 * (1 - Math.exp(-(v - 1) / 0.6)))
}

type Zone = { p10: number; p50: number; p90: number; a: number; b: number; n: number }

function reperes(histo: Uint32Array, sa: number, sb: number, n: number): Zone {
  const centile = (f: number) => {
    let k = 0
    const cible = n * f
    for (let L = 0; L <= 100; L++) {
      k += histo[L]
      if (k >= cible) return L
    }
    return 100
  }
  return { p10: centile(0.1), p50: centile(0.5), p90: centile(0.9), a: n ? sa / n : 0, b: n ? sb / n : 0, n }
}

export type Teinture = {
  /** la couleur d'arrivée des cheveux (ou du voile) */
  vers: Lab
  /** la couleur moyenne des cheveux de la figurine (pour écarter serre-têtes, perles, bijoux) */
  cheveux: Lab
  /** la couleur de sa peau */
  peau: Lab
  /** la ligne (en pixels) sous laquelle commence la barbe : sous les yeux */
  ySep: number
  /** la figurine a une barbe : la peau se voit au travers, plus loin du bord */
  barbe: boolean
}

/**
 * Teint les cheveux dans `d` (RGBA, modifié sur place), d'après le masque `m` (RGBA : rouge = peau, vert = cheveux,
 * bleu = traits du visage). Renvoie, pour chaque pixel, ce qui a été teint (0 à 255) : utile aux tests.
 */
export function teindreCheveux(d: Uint8ClampedArray, m: Uint8ClampedArray, W: number, H: number, o: Teinture): Uint8Array {
  const N = W * H
  const L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N)
  const vide = new Uint8Array(N), peau = new Uint8Array(N), chev = new Uint8Array(N)
  const [hL, hA, hB] = o.cheveux
  // les repères de couleur, en haut (les cheveux) et en bas (la barbe, les longueurs)
  const histo = [new Uint32Array(101), new Uint32Array(101)]
  const somme = [[0, 0, 0], [0, 0, 0]]
  for (let k = 0; k < N; k++) {
    const i = k * 4
    if (d[i + 3] < 40) vide[k] = 1
    if (m[i] > 128) peau[k] = 1
    if (m[i + 1] <= 0 || d[i + 3] < 8) continue
    const [l, a, b] = rgb2lab(d[i], d[i + 1], d[i + 2])
    L[k] = l
    A[k] = a
    B[k] = b
    if (m[i + 1] > 128) chev[k] = 1
    if (m[i + 1] > 128 && d[i + 3] > 230 && Math.hypot(a - hA, b - hB) < 22) {
      const z = ((k / W) | 0) >= o.ySep ? 1 : 0
      histo[z][borne(Math.round(l), 0, 100)]++
      somme[z][0] += a
      somme[z][1] += b
      somme[z][2]++
    }
  }
  let haut = reperes(histo[0], somme[0][0], somme[0][1], somme[0][2])
  let bas = reperes(histo[1], somme[1][0], somme[1][1], somme[1][2])
  if (haut.n < 150 && bas.n < 150) haut = bas = { p10: hL - 8, p50: hL, p90: hL + 10, a: hA, b: hB, n: 0 }
  else if (haut.n < 150) haut = bas
  else if (bas.n < 150) bas = haut
  const bord = autour(vide, W, H, 2)
  const presPeau = autour(peau, W, H, 3)
  const presPeauLoin = o.barbe ? autour(peau, W, H, 9) : presPeau
  const presChev = autour(chev, W, H, 2)
  const [tL, tA, tB] = o.vers
  const amp = amplitude(tL)
  const [sL, sA, sB] = o.peau
  const fait = new Uint8Array(N)
  for (let y = 0; y < H; y++) {
    // d'une zone à l'autre en douceur (les cheveux longs passent la ligne sans couture)
    const wz = borne((y - (o.ySep - 6)) / 12, 0, 1)
    const zp10 = haut.p10 + (bas.p10 - haut.p10) * wz, zp50 = haut.p50 + (bas.p50 - haut.p50) * wz, zp90 = haut.p90 + (bas.p90 - haut.p90) * wz
    const zA = haut.a + (bas.a - haut.a) * wz, zB = haut.b + (bas.b - haut.b) * wz
    const axA = sA - zA, axB = sB - zB
    const ax2 = axA * axA + axB * axB
    const monte = Math.max(4, zp90 - zp50), descend = Math.max(4, zp50 - zp10)
    for (let x = 0; x < W; x++) {
      const k = y * W + x
      const i = k * 4
      if (d[i + 3] < 8) continue
      let w = m[i + 1] / 255
      // le dernier rang de pixels du contour, que le masque n'a pas toujours pris : il suit les cheveux, sinon un
      // filet de l'ancienne couleur resterait autour de la tête
      const frange = w < 0.5 && bord[k] && presChev[k] && m[i] <= 128 && m[i + 2] <= 40
      if (frange) {
        const [l, a, b] = rgb2lab(d[i], d[i + 1], d[i + 2])
        L[k] = l
        A[k] = a
        B[k] = b
        if (Math.hypot(a - zA, b - zB) < 16) w = 0.9
      }
      if (w <= 0) continue
      const l = L[k], a = A[k], b = B[k]
      // la part de peau dans ce pixel : là où les cheveux touchent la peau (ou dans une barbe), d'après sa couleur
      // qui glisse de celle des cheveux vers celle de la peau
      let t = 0
      const zone = wz > 0 ? presPeauLoin[k] : presPeau[k]
      if (zone && ax2 > 100) {
        t = borne(((a - zA) * axA + (b - zB) * axB) / ax2, 0, 1)
        if (Math.abs(sL - zp50) > 12) t = Math.min(t, borne(((l - zp50) / (sL - zp50)) * 1.25, 0, 1))
      } else if (zone && Math.abs(sL - zp50) > 18) {
        // des cheveux de la même teinte que la peau (châtains sur peau claire) : seule la clarté les distingue
        t = borne((l - zp50) / (sL - zp50), 0, 1)
        t = t < 0.25 ? 0 : (t - 0.25) / 0.75
      }
      // garde-fou : une raie, un serre-tête, une perle, un nœud, un bijou classés « cheveux » gardent leur couleur.
      // Des cheveux colorés (roux, blonds) restent des cheveux quand ils sont plus ternes (dans l'ombre) ou plus vifs
      // (un reflet) : c'est la teinte qui compte, pas la vivacité. Des cheveux sans couleur (noirs, gris, blancs) :
      // tout ce qui est coloré n'en est pas.
      const da = a - (zA + t * axA), db = b - (zB + t * axB)
      const vif = Math.hypot(zA, zB)
      let garde: number
      if (vif < 8) garde = borne((21 - Math.hypot(da, db)) / 7, 0, 1)
      else {
        const le = (da * zA + db * zB) / vif // le long de la teinte des cheveux : négatif = plus terne
        const travers = Math.abs((da * zB - db * zA) / vif)
        garde = borne((12 + 0.2 * vif - travers) / 6, 0, 1) * borne((le + vif + 10) / 6, 0, 1) * borne((vif * 1.2 + 12 - le) / 8, 0, 1)
      }
      w *= garde
      if (w <= 0) continue
      // le relief : l'écart à la clarté attendue, ramené à l'amplitude de la nouvelle couleur
      const ecart = l - (zp50 + t * (sL - zp50))
      const r = doux(ecart >= 0 ? ecart / monte : ecart / descend)
      let nL = tL + (r >= 0 ? amp.haut : amp.bas) * r
      // au bord de la silhouette (le pixel était mêlé au fond clair d'origine) : jamais plus clair que la couleur
      if (bord[k] || d[i + 3] < 250) nL = Math.min(nL, tL + amp.haut * 0.3)
      const bordure = bord[k] ? 0.25 : 0.5
      const cL = nL + t * (sL - nL), cA = tA + da * bordure + t * (sA - (tA + da * bordure)), cB = tB + db * bordure + t * (sB - (tB + db * bordure))
      const [R, G, Bl] = lab2rgb(l + w * (cL - l), a + w * (cA - a), b + w * (cB - b))
      d[i] = R
      d[i + 1] = G
      d[i + 2] = Bl
      fait[k] = Math.round(w * 255)
    }
  }
  return fait
}
