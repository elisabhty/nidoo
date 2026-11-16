import { useEffect, useId, useState, type ReactNode } from 'react'
import { ACCESSORIES, EYES, HAIR_COLORS, HAIRSTYLES, SKINS, TOPS, type Look } from '../lib/look'
import { COULEURS_MONTURE, FORMES_LUNETTES, LUNETTES_IMG } from '../lib/lunettes'
import { cachedSrc, labHex, peauOf, persoImg, pixelKey, renderPerso, skinLab } from '../lib/personnalise'
import { accessoryOf, accPlace, accTop, CH, CW, persoOf, type Perso } from '../lib/persos'
import { VISAGES } from '../lib/visages'

// Un personnage de la famille : une figurine en feutrine qui lui ressemble (public/art/persos),
// avec l'accessoire acheté à la boutique. L'ancien personnage dessiné en SVG reste plus bas (CharacterSvg).

type Props = {
  look: Look
  mood?: string | null
  /** buste : la tête et les épaules, pour les pastilles rondes */
  bust?: boolean
  /** larme, goutte, « z » : seulement dans la maison */
  extras?: boolean
  size?: number
  className?: string
  blinkDelay?: number
  still?: boolean
  /** bras grands ouverts pour un câlin */
  pose?: 'calin'
  /** joues toutes roses (après un bisou) */
  blush?: boolean
}

/** L'image de la figurine (avec la peau choisie), recolorée si on a changé ses cheveux, ses yeux ou sa bouche. */
function usePersoSrc(p: Perso, look: Look) {
  const key = pixelKey(p, look)
  const base = persoImg(p, peauOf(p, look))
  const [src, setSrc] = useState(() => (key ? cachedSrc(key) ?? base : base))
  useEffect(() => {
    if (!key) return setSrc(base)
    let live = true
    const hit = cachedSrc(key)
    if (hit) setSrc(hit)
    else
      renderPerso(p, look)
        .then((u) => live && setSrc(u))
        .catch(() => live && setSrc(base))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, base])
  return src
}

/** Ce qui se dessine sur le visage : nez, bouche, taches de rousseur, blush, lunettes (toile 300x440). */
export function FaceExtras({ p, look }: { p: Perso; look: Look }) {
  const v = VISAGES[p.id]
  if (!v) return null
  const n = v.bouche ? look.n ?? 0 : 0
  const u = v.bouche ? look.u ?? 0 : 0
  const j = look.j ?? 0
  const z = look.z ?? 0
  const f = look.f ?? 0
  const dd = v.bouche ? look.d ?? 0 : 0
  if (!n && !u && !j && !z && !f && !dd) return null
  const [lx0, ly0, rx0, ry0, r0] = v.e
  const lx = lx0 * CW, ly = ly0 * CH, rx = rx0 * CW, ry = ry0 * CH, r = r0 * CW
  const d = rx - lx
  const ex = (lx + rx) / 2, ey = (ly + ry) / 2
  const skin = skinLab(p, look)
  const shade = labHex([skin[0] - 14, skin[1] + 4, skin[2] + 2])
  const light = labHex([Math.min(96, skin[0] + 8), skin[1] - 2, skin[2] - 4])
  const dent = labHex([Math.max(8, skin[0] * 0.72 - 4), skin[1] + 3, skin[2]])
  const base = labHex(skin)
  const lip = '#5A2A2A'
  const mx = v.mo[0] * CW, my = v.mo[1] * CH
  const mw = Math.max(v.mo[2] * CW, d * 0.34)
  const nx = v.no[0] * CW, ny = v.no[1] * CH
  const id = p.id
  // les lunettes : une vraie paire (image), posée verres sur les yeux, avec son ombre
  const lun = j > 0 && !p.l ? `lun-${FORMES_LUNETTES[j - 1]}-${COULEURS_MONTURE[look.w ?? 0] ?? COULEURS_MONTURE[0]}` : ''
  const mon = lun ? LUNETTES_IMG[lun] : null
  let lunettes: { k: string; t: string; w: number; h: number } | null = null
  if (mon) {
    const D = mon.r[0] - mon.l[0]
    const s0 = Math.hypot(rx - lx, ry - ly) / D
    // les yeux doivent tenir dans les verres, sans que les lunettes deviennent énormes
    const s = Math.min(s0 * 1.5, Math.max(s0, (r * 3.3) / mon.v[0]))
    const deg = (Math.atan2(ry - ly, rx - lx) * 180) / Math.PI
    const gx = (mon.l[0] + mon.r[0]) / 2, gy = (mon.l[1] + mon.r[1]) / 2
    lunettes = { k: lun, t: `translate(${ex} ${ey + r * 0.05}) rotate(${deg}) scale(${s}) translate(${-gx} ${-gy})`, w: mon.w, h: mon.h }
  }
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id={`bl${id}`}>
          <stop offset="0" stopColor="#FF6F91" stopOpacity={z === 2 ? 0.75 : 0.45} />
          <stop offset="1" stopColor="#FF6F91" stopOpacity="0" />
        </radialGradient>
        <filter id={`fo${id}`} x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation={d * 0.006} />
        </filter>
        <radialGradient id={`ne${id}`} cx="0.4" cy="0.35">
          <stop offset="0" stopColor={light} />
          <stop offset="0.6" stopColor={base} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
      </defs>
      {z > 0 &&
        [lx - d * 0.06, rx + d * 0.06].map((cx, i) => <ellipse key={i} cx={cx} cy={ey + d * 0.42} rx={d * 0.17} ry={d * 0.1} fill={`url(#bl${id})`} />)}
      {f > 0 &&
        [-1, 1].map((side) =>
          [
            [0, 0],
            [0.07, 0.03],
            [-0.06, 0.04],
            [0.03, 0.08],
            [-0.03, -0.03],
            [0.1, -0.02],
          ].map(([dx, dy], i) => (
            <circle key={`${side}${i}`} cx={(side < 0 ? lx : rx) + side * d * 0.02 + dx * d * side} cy={ey + d * 0.36 + dy * d} r={d * 0.016} fill="#9A5A3A" opacity={0.55} />
          )),
        )}
      {dd > 0 &&
        // les fossettes : deux petits creux doux au coin de la bouche, dans la couleur de la peau
        [-1, 1].map((side) => {
          const cx = mx + side * (mw * 0.5 + d * 0.065), cy = my + d * 0.02, hh = d * 0.05
          return (
            <g key={side} filter={`url(#fo${id})`} strokeLinecap="round" fill="none">
              <path d={`M${cx} ${cy - hh} Q${cx + side * d * 0.04} ${cy} ${cx} ${cy + hh}`} stroke={dent} strokeWidth={d * 0.03} opacity={0.8} />
              <path d={`M${cx - side * d * 0.016} ${cy - hh * 0.75} Q${cx + side * d * 0.012} ${cy} ${cx - side * d * 0.016} ${cy + hh * 0.75}`} stroke={light} strokeWidth={d * 0.014} opacity={0.4} />
            </g>
          )
        })}
      {n === 1 && <ellipse cx={nx} cy={ny} rx={d * 0.075} ry={d * 0.06} fill={`url(#ne${id})`} />}
      {n === 2 && <ellipse cx={nx} cy={ny + d * 0.01} rx={d * 0.11} ry={d * 0.085} fill={`url(#ne${id})`} />}
      {n === 3 && (
        <>
          <ellipse cx={nx} cy={ny - d * 0.01} rx={d * 0.08} ry={d * 0.07} fill={`url(#ne${id})`} />
          <ellipse cx={nx - d * 0.03} cy={ny + d * 0.035} rx={d * 0.014} ry={d * 0.01} fill={shade} />
          <ellipse cx={nx + d * 0.03} cy={ny + d * 0.035} rx={d * 0.014} ry={d * 0.01} fill={shade} />
        </>
      )}
      {u === 1 && (
        <>
          <path d={`M${mx - mw * 0.5} ${my - mw * 0.08} Q${mx} ${my - mw * 0.02} ${mx + mw * 0.5} ${my - mw * 0.08} Q${mx + mw * 0.42} ${my + mw * 0.55} ${mx} ${my + mw * 0.58} Q${mx - mw * 0.42} ${my + mw * 0.55} ${mx - mw * 0.5} ${my - mw * 0.08} Z`} fill="#5A2626" stroke={lip} strokeWidth={mw * 0.07} strokeLinejoin="round" />
          <ellipse cx={mx} cy={my + mw * 0.38} rx={mw * 0.24} ry={mw * 0.13} fill="#F07A8C" />
        </>
      )}
      {u === 2 && <path d={`M${mx - mw * 0.32} ${my} Q${mx} ${my + mw * 0.32} ${mx + mw * 0.32} ${my}`} fill="none" stroke={lip} strokeWidth={mw * 0.1} strokeLinecap="round" />}
      {u === 3 && (
        <>
          <ellipse cx={mx} cy={my + mw * 0.12} rx={mw * 0.26} ry={mw * 0.3} fill="#5A2626" stroke={lip} strokeWidth={mw * 0.06} />
          <ellipse cx={mx} cy={my + mw * 0.27} rx={mw * 0.16} ry={mw * 0.1} fill="#F07A8C" />
        </>
      )}
      {u === 4 && (
        <>
          <ellipse cx={mx} cy={my + mw * 0.02} rx={mw * 0.16} ry={mw * 0.1} fill="#C8566A" />
          <ellipse cx={mx} cy={my + mw * 0.16} rx={mw * 0.15} ry={mw * 0.1} fill="#C8566A" />
          <path d={`M${mx - mw * 0.12} ${my + mw * 0.09} L${mx + mw * 0.12} ${my + mw * 0.09}`} stroke="#7A2A3A" strokeWidth={mw * 0.03} strokeLinecap="round" />
        </>
      )}
      {lunettes && (
        <g transform={lunettes.t}>
          <image href={`./art/persos/${lunettes.k}.webp`} width={lunettes.w} height={lunettes.h} />
        </g>
      )}
    </svg>
  )
}

export function Character({ look, mood = null, bust = false, extras = false, className = '', pose, blush = false }: Props) {
  const p = persoOf(look)
  const src = usePersoSrc(p, look)
  const acc = accessoryOf(look)
  const pl = acc ? accPlace(p, acc) : null
  const [t, h, x, c, , bx0, by0, bs0] = p.m
  const R = CH / CW
  const hw = h * R
  const at = pl ? accTop(pl) : 0
  // la figurine, l'accessoire et les petits signes de l'humeur, dans la toile 300x440
  const figure = (
    <>
      <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
      <FaceExtras p={p} look={look} />
      {blush && (
        <>
          {[-1, 1].map((side) => (
            <span
              key={side}
              className="absolute rounded-[50%]"
              style={{ left: `${(x + side * hw * 0.24 - hw * 0.09) * 100}%`, top: `${(t + h * 0.7) * 100}%`, width: `${hw * 0.18 * 100}%`, height: `${((hw * 0.11) / R) * 100}%`, background: 'radial-gradient(closest-side, rgba(255,110,140,0.75), rgba(255,110,140,0))' }}
            />
          ))}
        </>
      )}
      {pl && (
        <img
          src={`./art/persos/acc-${acc}.webp`}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: `${pl.w * 100}%`, left: `${(pl.x - pl.w / 2) * 100}%`, top: `${at * 100}%` }}
        />
      )}
      {extras && mood === 'triste' && (
        <span className="perso-larme absolute block rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[#8FD3FF]" style={{ left: `${(x - hw * 0.2) * 100}%`, top: `${(t + h * 0.72) * 100}%`, width: `${hw * 0.07 * 100}%`, height: `${((hw * 0.1) / R) * 100}%` }} />
      )}
      {extras && mood === 'stresse' && (
        <span className="perso-goutte absolute block rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[#8FD3FF]" style={{ left: `${(x + c * 0.42) * 100}%`, top: `${(t + h * 0.3) * 100}%`, width: `${hw * 0.08 * 100}%`, height: `${((hw * 0.11) / R) * 100}%` }} />
      )}
      {extras && mood === 'fatigue' && (
        <span className="absolute font-rond font-bold text-[#7B6FB0]" style={{ left: `${(x + c * 0.4) * 100}%`, top: `${(t - h * 0.02) * 100}%`, fontSize: '0.55em', animation: 'flotte 2.6s ease-in-out infinite' }}>
          z
        </span>
      )}
    </>
  )

  if (bust) {
    // le cadre du buste, agrandi vers le haut si un chapeau dépasse
    let bx = bx0 * CW
    let by = by0 * CH
    let bs = bs0 * CW
    if (pl && at * CH < by) {
      const extra = by - at * CH + 4
      by -= extra
      bs += extra
      bx -= extra / 2
    }
    return (
      <span className={`relative block overflow-hidden ${className}`} style={{ aspectRatio: '1 / 1' }}>
        <span className="absolute block" style={{ width: `${(CW / bs) * 100}%`, left: `${(-bx / bs) * 100}%`, top: `${(-by / bs) * 100}%`, aspectRatio: `${CW} / ${CH}` }}>
          {figure}
        </span>
      </span>
    )
  }
  // en pied ; un chapeau qui dépasse agrandit la boîte vers le haut, la figurine reste posée en bas
  const over = pl ? Math.max(0, -at) : 0
  return (
    <span className={`relative block ${className}`} style={{ aspectRatio: `${CW} / ${CH * (1 + over)}`, transform: pose === 'calin' ? 'scale(1.04, 0.98)' : undefined, transformOrigin: '50% 100%' }}>
      <span className="absolute inset-x-0 bottom-0 block" style={{ aspectRatio: `${CW} / ${CH}` }}>
        {figure}
      </span>
    </span>
  )
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`
}

type Circ = [number, number, number]
const curls = (cs: Circ[], fill: string, stroke: string) => cs.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={0.6} strokeOpacity={0.35} />)

/** Cheveux de derrière (sous la tête) et de devant (sur le front). */
function hair(style: string, H: string): { back: ReactNode; front: ReactNode } {
  const Hd = shade(H, -0.28)
  const p = (d: string, extra: Record<string, unknown> = {}) => <path d={d} fill={H} {...extra} />
  switch (style) {
    case 'court':
      return { back: null, front: p('M24.5 41 C23 22 35 12 50 12 C65 12 77 22 75.5 41 C73 33 69 27 62 25 C55 28.5 44 29 35 27 C30 30 26 35 24.5 41 Z') }
    case 'raie':
      return {
        back: null,
        front: (
          <>
            {p('M24 43 C21.5 21 35 10.5 51 10.5 C67 10.5 79 21 76 43 C74.5 34 71 27.5 64 24.5 C58 30 44 33.5 31 31.5 C27.5 34.5 25 38.5 24 43 Z')}
            <path d="M58 12.5 Q56.5 19 64 24.5" fill="none" stroke={Hd} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
          </>
        ),
      }
    case 'boucles':
      return {
        back: null,
        front: <g>{curls([[27, 38, 6.5], [28, 30, 7], [33, 22.5, 7.5], [41, 17.5, 8], [50, 15.5, 8.5], [59, 17.5, 8], [67, 22.5, 7.5], [72, 30, 7], [73, 38, 6.5], [38, 26.5, 6.5], [50, 24, 6.5], [62, 26.5, 6.5]], H, Hd)}</g>,
      }
    case 'longs':
      return {
        back: p('M22.5 40 C21 19 35 9.5 50 9.5 C65 9.5 79 19 77.5 40 L79.5 88 Q66 93 50 91 Q34 93 20.5 88 Z'),
        front: p('M24 45 C22 21 35 11.5 50 11.5 C65 11.5 78 21 76 45 C75.5 33 70 26 61 23.5 C55 28 42 30.5 30 32 C27 35.5 25 40 24 45 Z'),
      }
    case 'bouclesLongs':
      return {
        back: <g>{curls([[50, 14, 13], [34, 18, 11], [66, 18, 11], [25, 30, 10], [75, 30, 10], [22, 44, 10], [78, 44, 10], [22, 58, 10], [78, 58, 10], [24, 72, 10], [76, 72, 10], [28, 84, 9], [72, 84, 9]], H, Hd)}</g>,
        front: <g>{curls([[28, 35, 6], [33, 26, 7], [41, 20, 7.5], [50, 18, 8], [59, 20, 7.5], [67, 26, 7], [72, 35, 6], [44, 27, 5.5], [56, 27, 5.5]], H, Hd)}</g>,
      }
    case 'carre':
      return {
        back: p('M21.5 42 C20 18 35 9.5 50 9.5 C65 9.5 80 18 78.5 42 L79.5 66 Q73 71 65 68.5 L35 68.5 Q27 71 20.5 66 Z'),
        front: p('M23.5 38 C23 19 36 11.5 50 11.5 C64 11.5 77 19 76.5 38 C70 34.5 30 34.5 23.5 38 Z'),
      }
    case 'chignon':
      return {
        back: <circle cx={50} cy={10.5} r={10} fill={H} />,
        front: (
          <>
            {p('M25 41 C24 23 36 14.5 50 14.5 C64 14.5 76 23 75 41 C71 31 62 24.5 50 24.5 C38 24.5 29 31 25 41 Z')}
            <path d="M40 16.5 Q44 21 46 24.5 M60 16.5 Q56 21 54 24.5" fill="none" stroke={Hd} strokeWidth={0.9} strokeLinecap="round" opacity={0.55} />
          </>
        ),
      }
    case 'queue':
      return {
        back: p('M65 17 C82 18 87 40 81 63 C79 71 72 73 74 61 C77 47 74 33 63 26 Z'),
        front: p('M24.5 42 C23 22 35 12.5 50 12.5 C65 12.5 77 22 75.5 42 C73 32 66 26 58 24 C50 27.5 38 29 30 30 C27.5 33.5 25.5 37.5 24.5 42 Z'),
      }
    case 'tresses': {
      const braid = (x: number) => (
        <g>
          {[52, 61, 70, 79].map((y) => (
            <ellipse key={y} cx={x} cy={y} rx={4.8} ry={5.6} fill={H} stroke={Hd} strokeWidth={0.6} strokeOpacity={0.4} />
          ))}
          <rect x={x - 3} y={84} width={6} height={2.6} rx={1.2} fill="#E77BA0" />
          <path d={`M${x - 3} 86.5 L${x} 93 L${x + 3} 86.5 Z`} fill={H} />
        </g>
      )
      return {
        back: (
          <>
            {braid(24)}
            {braid(76)}
          </>
        ),
        front: (
          <>
            {p('M24.5 43 C23 22 35 12.5 50 12.5 C65 12.5 77 22 75.5 43 C73 31 63 23 50 21 C37 23 27 31 24.5 43 Z')}
            <path d="M50 12.5 L50 21" stroke={Hd} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
          </>
        ),
      }
    }
    case 'afro':
      return {
        back: (
          <g>
            <circle cx={50} cy={32} r={30} fill={H} />
            {curls([[24, 22, 9], [33, 10, 9], [50, 5, 9], [67, 10, 9], [76, 22, 9], [80, 37, 8], [20, 37, 8], [22, 50, 8], [78, 50, 8]], H, Hd)}
          </g>
        ),
        front: p('M25 40 C24.5 26 36 19 50 19 C64 19 75.5 26 75 40 C71 31 62 27 50 27 C38 27 29 31 25 40 Z'),
      }
    case 'meche':
      return {
        back: null,
        front: (
          <g fill="none" stroke={H} strokeLinecap="round">
            <path d="M50 18 C46.5 12.5 49.5 8 54 9.6 C57.6 11 56 15.4 52.4 14.6" strokeWidth={2.6} />
            <path d="M45.5 18.6 Q46.5 15.2 49 15.8" strokeWidth={1.8} />
          </g>
        ),
      }
    case 'rase':
      return { back: null, front: p('M25.5 40 C24.5 23 36 15 50 15 C64 15 75.5 23 74.5 40 C71 30 62 25 50 25 C38 25 29 30 25.5 40 Z', { opacity: 0.55 }) }
    default:
      return { back: null, front: <ellipse cx={42} cy={22} rx={6} ry={3} fill="#FFFFFF" opacity={0.25} transform="rotate(-20 42 22)" /> }
  }
}

/** Le corps selon la taille. pose « calin » : bras grands ouverts. */
function body(age: number, top: string, skin: string, pose?: 'calin') {
  const B = [
    // épaule x, épaule y, main au repos, buste, jambes
    { sx: 31.5, sy: 87, hand: [27, 111.5], torso: 'M28 113 C28 88 37 75.5 50 75.5 C63 75.5 72 88 72 113 Z', legs: { y: 107, h: 15, w: 8.5, shoe: 122.5 } },
    { sx: 32, sy: 86, hand: [28, 106.5], torso: 'M29 108 C29 87 37.5 75.5 50 75.5 C62.5 75.5 71 87 71 108 Z', legs: { y: 103, h: 12, w: 8.2, shoe: 115.5 } },
    { sx: 34, sy: 85, hand: [30.5, 100.5], torso: 'M32 102 C32 85 39.5 75.5 50 75.5 C60.5 75.5 68 85 68 102 Z', legs: { y: 98, h: 10, w: 7.5, shoe: 108.5 } },
    { sx: 34, sy: 82, hand: [29.5, 93.5], torso: 'M32 94 C30 81 39 73.5 50 73.5 C61 73.5 70 81 68 94 C67 103 59 106 50 106 C41 106 33 103 32 94 Z', legs: null },
  ][age] ?? null
  if (!B) return null
  const [hx, hy] = pose === 'calin' ? [B.sx - 16, B.sy - 10] : B.hand
  const arm = (side: 1 | -1) => {
    const sx = side === 1 ? B.sx : 100 - B.sx
    const x = side === 1 ? hx : 100 - hx
    const d = pose === 'calin' ? `M${sx} ${B.sy} C${sx - 7 * side} ${B.sy - 1} ${sx - 12 * side} ${B.sy - 5} ${x} ${hy}` : `M${sx} ${B.sy} C${sx - 5.5 * side} ${B.sy + 8} ${sx - 6.5 * side} ${(B.sy + hy) / 2 + 6} ${x} ${hy - 1}`
    return (
      <g key={side}>
        <path d={d} fill="none" stroke={top} strokeWidth={age === 3 ? 7 : 8.5} strokeLinecap="round" />
        <circle cx={x} cy={hy} r={age >= 2 ? 3.8 : 4.4} fill={skin} />
      </g>
    )
  }
  return (
    <g>
      {B.legs ? (
        <>
          <rect x={50 - 2.5 - B.legs.w} y={B.legs.y} width={B.legs.w} height={B.legs.h} rx={3.5} fill="#3B3355" />
          <rect x={52.5} y={B.legs.y} width={B.legs.w} height={B.legs.h} rx={3.5} fill="#3B3355" />
          <ellipse cx={50 - 2.5 - B.legs.w / 2} cy={B.legs.shoe} rx={B.legs.w * 0.73} ry={2.8} fill="#2B2540" />
          <ellipse cx={52.5 + B.legs.w / 2} cy={B.legs.shoe} rx={B.legs.w * 0.73} ry={2.8} fill="#2B2540" />
        </>
      ) : (
        <>
          <ellipse cx={42.5} cy={106} rx={5.6} ry={4} fill={skin} />
          <ellipse cx={57.5} cy={106} rx={5.6} ry={4} fill={skin} />
        </>
      )}
      {arm(1)}
      {arm(-1)}
      <path d={B.torso} fill={top} />
      {age === 3 && (
        <>
          <circle cx={50} cy={95} r={1.1} fill="#FFFFFF" opacity={0.8} />
          <circle cx={50} cy={100} r={1.1} fill="#FFFFFF" opacity={0.8} />
        </>
      )}
    </g>
  )
}

export function CharacterSvg({
  look, mood = null, bust = false, extras = false, size, className = '', blinkDelay = 0, still = false, pose, blush = false,
}: {
  look: Look
  mood?: string | null
  /** buste : la tête et les épaules, pour les pastilles rondes */
  bust?: boolean
  /** chapeau de fête, larme, goutte, « z » : seulement dans la maison */
  extras?: boolean
  size?: number
  className?: string
  blinkDelay?: number
  /** sans clignement (petites pastilles) */
  still?: boolean
  /** bras grands ouverts pour un câlin */
  pose?: 'calin'
  /** joues toutes roses (après un bisou) */
  blush?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const skin = SKINS[look.s]
  const skinD = shade(skin, -0.16)
  const skinDD = shade(skin, -0.32)
  const H = HAIR_COLORS[look.c].hex
  const brow = look.h === HAIRSTYLES.findIndex((x) => x.key === 'chauve') ? shade(skin, -0.45) : shade(H, -0.3)
  const eye = EYES[look.e]
  const top = TOPS[look.t]
  const hs = hair(HAIRSTYLES[look.h].key, H)
  const ink = '#2B2540'
  const lip = look.l ? '#D2384F' : '#8E3B46'

  // ── yeux, sourcils et bouche selon l'humeur
  const L = 40.5
  const R = 59.5
  const Y = 46
  const baby = look.a === 3
  const openEye = (cx: number, dx = 0, dy = 0, ry = baby ? 5 : 4.3) => (
    <g key={cx}>
      <ellipse cx={cx} cy={Y} rx={baby ? 4.1 : 3.6} ry={ry} fill={eye} />
      <ellipse cx={cx + dx} cy={Y + 0.5 + dy} rx={2} ry={Math.min(2.5, ry * 0.6)} fill="#1D1A2B" />
      <circle cx={cx + 1.2 + dx * 0.5} cy={Y - 1.5 + dy * 0.5} r={1.05} fill="#FFFFFF" />
    </g>
  )
  const arcEye = (cx: number, up: boolean) => <path key={cx} d={up ? `M${cx - 3.6} ${Y + 1.6} Q${cx} ${Y - 2.6} ${cx + 3.6} ${Y + 1.6}` : `M${cx - 3.6} ${Y} Q${cx} ${Y + 3} ${cx + 3.6} ${Y}`} fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
  const sleepy = (cx: number) => (
    <g key={cx}>
      <ellipse cx={cx} cy={Y + 1.2} rx={3.6} ry={2.4} fill={eye} />
      <ellipse cx={cx} cy={Y + 1.6} rx={1.8} ry={1.5} fill="#1D1A2B" />
      <path d={`M${cx - 4.2} ${Y - 0.2} Q${cx} ${Y - 1.4} ${cx + 4.2} ${Y - 0.2}`} fill="none" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  )
  const brows = {
    neutre: ['M35.5 39.5 Q40.5 36.8 45.5 39.2', 'M54.5 39.2 Q59.5 36.8 64.5 39.5'],
    fronce: ['M35.5 38 Q40.5 38.4 45.5 40.6', 'M54.5 40.6 Q59.5 38.4 64.5 38'],
    inquiet: ['M35.5 40 Q40 39 45 36.6', 'M55 36.6 Q60 39 64.5 40'],
    haut: ['M35.5 38 Q40.5 35 45.5 37.6', 'M54.5 37.6 Q59.5 35 64.5 38'],
  }
  let eyes: ReactNode = [openEye(L), openEye(R)]
  let br = brows.neutre
  let mouth: ReactNode = <path d="M45 59.5 Q50 63.6 55 59.5" fill="none" stroke={lip} strokeWidth={look.l ? 2.4 : 1.8} strokeLinecap="round" />
  let extra: ReactNode = null
  let blink = true
  const open = (d: string) => (
    <>
      <path d={d} fill={lip} />
      <path d="M46.6 59.6 Q50 61 53.4 59.6 L53.4 58.9 L46.6 58.9 Z" fill="#FFFFFF" opacity={0.9} />
    </>
  )
  switch (mood) {
    case 'heureux':
      mouth = open('M44.2 58.6 Q50 66.4 55.8 58.6 Q50 60 44.2 58.6 Z')
      break
    case 'serein':
      eyes = [arcEye(L, false), arcEye(R, false)]
      blink = false
      mouth = <path d="M45.5 59.6 Q50 62.6 54.5 59.6" fill="none" stroke={lip} strokeWidth={1.8} strokeLinecap="round" />
      break
    case 'motive':
      br = brows.fronce
      mouth = open('M44 58.4 Q50 65 56 58.4 Q50 59.6 44 58.4 Z')
      if (extras) extra = <path d="M76 14 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 Z" fill="#F2B33D" className="perso-scintille" />
      break
    case 'fete':
      eyes = [arcEye(L, true), arcEye(R, true)]
      blink = false
      br = brows.haut
      mouth = open('M43.6 57.8 Q50 68 56.4 57.8 Q50 59.4 43.6 57.8 Z')
      if (extras)
        extra = (
          <g>
            <path d="M50 -1 L40.5 17.5 Q50 21 59.5 17.5 Z" fill="#F2B33D" />
            <path d="M45.5 7.5 L54 8.8 M43 12.8 L57 14.4" stroke="#E5484D" strokeWidth={2} strokeLinecap="round" />
            <circle cx={50} cy={-1} r={2.8} fill="#E77BA0" />
            {[[18, 22, '#8E6FF0'], [82, 26, '#5FB277'], [14, 40, '#F58B5C'], [86, 44, '#5AA3E0']].map(([x, y, c]) => (
              <rect key={`${x}`} x={x as number} y={y as number} width={2.6} height={4} rx={0.8} fill={c as string} className="perso-confetti" />
            ))}
          </g>
        )
      break
    case 'fatigue':
      eyes = [sleepy(L), sleepy(R)]
      blink = false
      br = ['M35.5 40 Q40.5 38.6 45.5 40', 'M54.5 40 Q59.5 38.6 64.5 40']
      mouth = <path d="M46.6 60.6 Q50 59.6 53.4 60.6" fill="none" stroke={lip} strokeWidth={1.8} strokeLinecap="round" />
      if (extras)
        extra = (
          <g fill="#8E8AA6" fontWeight={800} fontFamily="ui-rounded, Nunito, sans-serif" className="perso-zz">
            <text x={72} y={22} fontSize={7}>z</text>
            <text x={78} y={14} fontSize={9.5}>z</text>
          </g>
        )
      break
    case 'stresse':
      br = brows.inquiet
      mouth = <path d="M44.6 60.4 q1.8 -1.7 3.6 0 q1.8 1.7 3.6 0 q1.8 -1.7 3.6 0" fill="none" stroke={lip} strokeWidth={1.7} strokeLinecap="round" />
      extra = <path d="M71 25 Q74.6 31 71 33.4 Q67.4 31 71 25 Z" fill="#8FD3FF" stroke="#5AA3E0" strokeWidth={0.6} className={extras ? 'perso-goutte' : undefined} />
      break
    case 'nostalgique':
      eyes = [openEye(L, -0.7, -1.4), openEye(R, -0.7, -1.4)]
      br = brows.haut
      mouth = <path d="M46.4 60 Q50 62 53.6 60" fill="none" stroke={lip} strokeWidth={1.8} strokeLinecap="round" />
      break
    case 'triste':
      br = brows.inquiet
      eyes = [openEye(L, 0, 0.6, 3.9), openEye(R, 0, 0.6, 3.9)]
      mouth = <path d="M45.4 61.8 Q50 58 54.6 61.8" fill="none" stroke={lip} strokeWidth={1.8} strokeLinecap="round" />
      extra = <path d="M37.6 50.5 Q40 55 37.6 56.8 Q35.2 55 37.6 50.5 Z" fill="#8FD3FF" stroke="#5AA3E0" strokeWidth={0.5} className={extras ? 'perso-larme' : undefined} />
      break
  }

  const glasses = [
    null,
    <g key="r" fill="#FFFFFF" fillOpacity={0.14} stroke={ink} strokeWidth={1.5}>
      <circle cx={L} cy={46.5} r={6.6} />
      <circle cx={R} cy={46.5} r={6.6} />
      <path d="M47.1 46 Q50 44.4 52.9 46 M33.9 45.6 L26.8 44.2 M66.1 45.6 L73.2 44.2" fill="none" />
    </g>,
    <g key="c" fill="#FFFFFF" fillOpacity={0.14} stroke={ink} strokeWidth={1.5}>
      <rect x={33.4} y={40.8} width={14.2} height={10.6} rx={3} />
      <rect x={52.4} y={40.8} width={14.2} height={10.6} rx={3} />
      <path d="M47.6 45.6 Q50 44.2 52.4 45.6 M33.4 44.6 L26.8 43.8 M66.6 44.6 L73.2 43.8" fill="none" />
    </g>,
    <g key="s">
      <path d="M33 41.6 H47.8 V46.5 Q47.8 52 41.6 52 Q33 52 33 46.5 Z M52.2 41.6 H67 V46.5 Q67 52 58.4 52 Q52.2 52 52.2 46.5 Z" fill="#2B2540" />
      <path d="M47.8 43.4 Q50 42.2 52.2 43.4 M33 43 L26.8 42.4 M67 43 L73.2 42.4" stroke="#2B2540" strokeWidth={1.4} fill="none" />
      <path d="M36 43.8 L39.5 43.8 M55.2 43.8 L58.7 43.8" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
    </g>,
  ][look.g]
  const beard = [
    null,
    <g key="c" fill={H}>
      <path d="M27 47 C27.5 62 38 71 50 71 C62 71 72.5 62 73 47 C71 57 64 63.5 56 64 Q50 66.6 44 64 C36 63.5 29 57 27 47 Z" />
      <path d="M43 57.6 Q50 54.4 57 57.6 Q50 59.1 43 57.6 Z" />
    </g>,
    <path key="m" d="M42.5 57.8 Q46 54.4 50 56.1 Q54 54.4 57.5 57.8 Q54 59.4 50 57.9 Q46 59.4 42.5 57.8 Z" fill={H} />,
    <g key="l" fill={H}>
      <path d="M27 46 C27 66 37 80 50 81.5 C63 80 73 66 73 46 C71 57 64 63.5 56 64 Q50 66.6 44 64 C36 63.5 29 57 27 46 Z" />
      <path d="M43 57.6 Q50 54.4 57 57.6 Q50 59.1 43 57.6 Z" />
    </g>,
  ][look.b]
  const mole = [null, [36.6, 57.2], [63.6, 56.2], [55.8, 57]][look.m] as number[] | null

  // Les accessoires de la boutique, par-dessus les cheveux.
  const acc = ACCESSORIES[look.v ?? 0] ?? ''
  const flower = (x: number, y: number, c: string) => (
    <g key={`${x}${y}`}>
      {[0, 72, 144, 216, 288].map((r) => (
        <circle key={r} cx={x + 2.4 * Math.cos((r * Math.PI) / 180)} cy={y + 2.4 * Math.sin((r * Math.PI) / 180)} r={1.9} fill={c} />
      ))}
      <circle cx={x} cy={y} r={1.3} fill="#F7C948" />
    </g>
  )
  const hat = {
    bonnet: (
      <g key="bonnet">
        <path d="M23.5 34 C23.5 16 35 7.5 50 7.5 C65 7.5 76.5 16 76.5 34 Z" fill="#E5484D" />
        <path d="M31 14 C34.5 21 35 28 34.5 33 M40.5 9.8 C43 17 43.4 26 43 33 M50 8 V33 M59.5 9.8 C57 17 56.6 26 57 33 M69 14 C65.5 21 65 28 65.5 33" stroke="#B9363C" strokeWidth={1.2} fill="none" opacity={0.55} />
        <rect x={21.5} y={27.5} width={57} height={9.5} rx={4.75} fill="#D33F45" />
        <path d="M24 32 H76" stroke="#B9363C" strokeWidth={1} opacity={0.4} />
        <circle cx={50} cy={7} r={6.4} fill="#FFF6EA" />
      </g>
    ),
    casquette: (
      <g key="casquette">
        <path d="M26.5 33 C26.5 18 37 10.5 50 10.5 C63 10.5 73.5 18 73.5 33 Z" fill="#3B74E0" />
        <path d="M50 11 V32 M38 14 Q44 22 44 32 M62 14 Q56 22 56 32" stroke="#2F62C4" strokeWidth={1} fill="none" opacity={0.6} />
        <path d="M50 31.5 C60 29.5 74 29.5 86.5 34 C80.5 38.5 66 39 50 36.5 Z" fill="#2E5DBB" />
        <circle cx={50} cy={11} r={2} fill="#2E5DBB" />
      </g>
    ),
    paille: (
      <g key="paille">
        <ellipse cx={50} cy={30} rx={37} ry={8.5} fill="#EBC77D" />
        <path d="M31 30 C31 15.5 39 9 50 9 C61 9 69 15.5 69 30 Z" fill="#E2B867" />
        <path d="M31.3 24 Q50 21.6 68.7 24 L68.9 29.6 Q50 27.6 31.1 29.6 Z" fill="#F28AA8" />
        <path d="M65 26.5 L58.5 22 Q57.5 26.5 58.5 31 Z M65 26.5 L71.5 22 Q72.5 26.5 71.5 31 Z" fill="#EE7398" />
        <circle cx={65} cy={26.5} r={1.7} fill="#E05C86" />
        <path d="M17 31 Q50 40 83 31" stroke="#D8AE5E" strokeWidth={1} fill="none" opacity={0.6} />
      </g>
    ),
    fleurs: (
      <g key="fleurs">
        <path d="M27 31 Q50 17 73 31" stroke="#7BB662" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        {[
          [28.5, 29.5, '#F59BB6'],
          [35, 24.5, '#FFFFFF'],
          [42.5, 21.5, '#F7C948'],
          [50, 20.5, '#F59BB6'],
          [57.5, 21.5, '#FFFFFF'],
          [65, 24.5, '#F7C948'],
          [71.5, 29.5, '#F59BB6'],
        ].map(([x, y, c]) => flower(x as number, y as number, c as string))}
      </g>
    ),
    couronne: (
      <g key="couronne">
        <path d="M33.5 26 L35 9.5 L42.5 17.5 L50 6 L57.5 17.5 L65 9.5 L66.5 26 Z" fill="#F2C14E" stroke="#D9A43A" strokeWidth={0.9} strokeLinejoin="round" />
        <rect x={33} y={22} width={34} height={5.5} rx={2} fill="#E5AE34" />
        <circle cx={50} cy={24.7} r={1.9} fill="#E5484D" />
        <circle cx={41} cy={24.7} r={1.4} fill="#5AA3E0" />
        <circle cx={59} cy={24.7} r={1.4} fill="#5AA3E0" />
        {[35, 50, 65].map((x, i) => (
          <circle key={x} cx={x} cy={[9.5, 6, 9.5][i]} r={1.5} fill="#FFF0B8" />
        ))}
      </g>
    ),
    noeud: (
      <g key="noeud">
        <path d="M66 20 L57.5 14.5 Q55.8 20 57.5 25.5 Z M66 20 L74.5 14.5 Q76.2 20 74.5 25.5 Z" fill="#A684E8" />
        <circle cx={66} cy={20} r={2.2} fill="#8D6AD6" />
      </g>
    ),
    echarpe: (
      <g key="echarpe">
        <path d="M56 78.5 L63.5 101 L55.5 102 L50.5 81 Z" fill="#F4B740" />
        <path d="M57.8 84 L60 84 M59.6 89.5 L61.8 89.5 M61.3 95 L63.5 95" stroke="#F0795B" strokeWidth={2.4} />
        <path d="M33 71.5 Q50 81.5 67 71.5 L68 79 Q50 89.5 32 79 Z" fill="#F4B740" />
        <path d="M38 75.5 L37.5 82.5 M46 78 L45.8 85.5 M54 78 L54.2 85.5 M62 75.5 L62.5 82.5" stroke="#F0795B" strokeWidth={2.6} />
      </g>
    ),
  }[acc as string] ?? null
  const starGlasses = (
    <g key="star">
      <circle cx={L} cy={46.5} r={7.4} fill="#1E1B2B" />
      <circle cx={R} cy={46.5} r={7.4} fill="#1E1B2B" />
      <path d="M47.9 45.6 Q50 44 52.1 45.6 M33.1 45 L26.8 43.8 M66.9 45 L73.2 43.8" stroke="#1E1B2B" strokeWidth={1.6} fill="none" />
      <path d="M36.2 43.2 Q38.5 41.6 41 42 M55.2 43.2 Q57.5 41.6 60 42" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" opacity={0.55} fill="none" />
    </g>
  )
  const hatOn = ['bonnet', 'casquette', 'paille', 'fleurs', 'couronne'].includes(acc)

  const bottom = [128, 121, 114, 112][look.a] ?? 128
  const y0 = extras ? -6 : 0
  const box = bust ? '10 6 80 80' : `8 ${y0} 84 ${bottom - y0}`
  const ratio = bust ? 1 : (bottom - y0) / 84
  return (
    <svg viewBox={box} width={size} height={size ? size * ratio : undefined} className={className} aria-hidden>
      <defs>
        <linearGradient id={`p${id}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={shade(skin, 0.1)} />
          <stop offset="1" stopColor={skinD} />
        </linearGradient>
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(top, 0.12)} />
          <stop offset="1" stopColor={shade(top, -0.12)} />
        </linearGradient>
      </defs>

      {hs.back}

      {/* corps : adulte, ado, enfant ou bébé */}
      {!bust && body(look.a, `url(#t${id})`, skin, pose)}
      {bust ? (
        <path d="M18 94 C18 84 32 75.5 50 75.5 C68 75.5 82 84 82 94 Z" fill={`url(#t${id})`} />
      ) : null}
      <rect x={44.2} y={62} width={11.6} height={baby ? 13 : 15} rx={5} fill={skinD} />
      {!baby && <path d="M44.4 75.8 Q50 81 55.6 75.8" fill={skinD} />}

      {/* tête */}
      <ellipse cx={26.4} cy={46.5} rx={4.1} ry={5.6} fill={skinD} />
      <ellipse cx={73.6} cy={46.5} rx={4.1} ry={5.6} fill={skinD} />
      {look.o === 1 && (
        <>
          <circle cx={26.2} cy={53.2} r={1.8} fill="#F2C14E" stroke="#C99A2E" strokeWidth={0.5} />
          <circle cx={73.8} cy={53.2} r={1.8} fill="#F2C14E" stroke="#C99A2E" strokeWidth={0.5} />
        </>
      )}
      <path d="M26 43 C26 26 37 17 50 17 C63 17 74 26 74 43 C74 58 64 69.5 50 69.5 C36 69.5 26 58 26 43 Z" fill={`url(#p${id})`} />

      {/* visage */}
      <ellipse cx={35.6} cy={55.2} rx={4.4} ry={2.7} fill="#FF8FA3" opacity={blush ? 0.8 : baby ? 0.45 : 0.3} />
      <ellipse cx={64.4} cy={55.2} rx={4.4} ry={2.7} fill="#FF8FA3" opacity={blush ? 0.8 : baby ? 0.45 : 0.3} />
      {look.f === 1 &&
        [[41.8, 52.4], [44.4, 54.4], [40.6, 55.2], [58.2, 52.4], [55.6, 54.4], [59.4, 55.2], [43, 50.8], [57, 50.8]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={0.6} fill={skinDD} opacity={0.75} />
        ))}
      <g className={blink && !still ? 'perso-cligne' : undefined} style={{ animationDelay: `${blinkDelay}s` }}>
        {eyes}
      </g>
      <path d={br[0]} fill="none" stroke={brow} strokeWidth={1.9} strokeLinecap="round" />
      <path d={br[1]} fill="none" stroke={brow} strokeWidth={1.9} strokeLinecap="round" />
      <path d="M50.2 50.4 Q52.3 53.6 49.8 54.6" fill="none" stroke={skinDD} strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
      {beard}
      {mouth}
      {mole && <circle cx={mole[0]} cy={mole[1]} r={0.95} fill="#4A2E24" />}
      {look.p === 1 && (
        <g>
          <ellipse cx={50} cy={60.6} rx={5.8} ry={3.7} fill="#8FD3FF" stroke="#5AA3E0" strokeWidth={0.6} />
          <circle cx={50} cy={64} r={2.7} fill="none" stroke="#F2B33D" strokeWidth={1.5} />
          <circle cx={50} cy={60.6} r={1.6} fill="#5AA3E0" />
        </g>
      )}

      {hs.front}
      {acc === 'lunettes' ? starGlasses : glasses}
      {hat}
      {(extras || mood === 'triste' || mood === 'stresse') && !(hatOn && mood === 'fete') && extra}
    </svg>
  )
}
