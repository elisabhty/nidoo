// Le visage de l'humeur : le panda roux de Nidoo, le même que dans le widget « Mon humeur » (public/art/humeur-<humeur>.webp)
// (Elisa, 21 novembre : « remplace les emoji par ça »). Il se lit d'un coup d'œil dans la bulle au-dessus de chacun,
// sur les pastilles et en grand pour choisir son humeur. Un smiley dessiné reste pour une humeur inconnue.

const PANDAS = new Set(['heureux', 'serein', 'motive', 'fete', 'fatigue', 'stresse', 'nostalgique', 'triste'])

const INK = '#5B3A1E'
const MOUTH = '#7A3B1E'

export function Smiley({ mood, size = 22 }: { mood: string; size?: number }) {
  if (PANDAS.has(mood)) {
    // la tête du panda remplit le rond ; ses oreilles (et le chapeau de fête) dépassent un peu
    const w = size * 1.18
    return (
      <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        <img src={`./art/humeur-${mood}.webp`} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: w, height: w, left: (size - w) / 2, top: (size - w) / 2 }} />
      </span>
    )
  }
  const eyes = (y = 9.6) => (
    <>
      <ellipse cx={8.3} cy={y} rx={1.25} ry={1.55} fill={INK} />
      <ellipse cx={15.7} cy={y} rx={1.25} ry={1.55} fill={INK} />
    </>
  )
  const line = (d: string, w = 1.3) => <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" />
  let face: React.ReactNode = null
  switch (mood) {
    case 'heureux':
      face = (
        <>
          {eyes()}
          <path d="M6.8 13.2 Q12 19.6 17.2 13.2 Q12 14.4 6.8 13.2 Z" fill={MOUTH} />
        </>
      )
      break
    case 'serein':
      face = (
        <>
          {line('M6.3 10 Q8.3 12 10.3 10')}
          {line('M13.7 10 Q15.7 12 17.7 10')}
          {line('M8.6 15 Q12 17.6 15.4 15')}
        </>
      )
      break
    case 'motive':
      face = (
        <>
          {line('M5.8 7 L10.2 8.4')}
          {line('M18.2 7 L13.8 8.4')}
          {eyes(10.2)}
          <path d="M7.2 13.6 Q12 18.8 16.8 13.6 Q12 14.6 7.2 13.6 Z" fill={MOUTH} />
          <path d="M8.6 14 Q12 14.8 15.4 14 L15 15 Q12 15.6 9 15 Z" fill="#FFFFFF" />
        </>
      )
      break
    case 'fete':
      face = (
        <>
          {line('M6.3 10.6 Q8.3 7.6 10.3 10.6')}
          {line('M13.7 10.6 Q15.7 7.6 17.7 10.6')}
          <path d="M6.8 13 Q12 20.4 17.2 13 Q12 14.2 6.8 13 Z" fill={MOUTH} />
          <path d="M13.6 2.6 L20.6 0.4 L18.4 7.2 Z" fill="#E77BA0" stroke="#FFFFFF" strokeWidth={0.5} />
          <circle cx={20.6} cy={0.6} r={1.2} fill="#8E6FF0" />
        </>
      )
      break
    case 'fatigue':
      face = (
        <>
          {line('M6.2 10.2 H10.4', 1.5)}
          {line('M13.6 10.2 H17.8', 1.5)}
          <ellipse cx={8.3} cy={11.2} rx={1.3} ry={0.8} fill={INK} />
          <ellipse cx={15.7} cy={11.2} rx={1.3} ry={0.8} fill={INK} />
          {line('M10 16.2 Q12 15.5 14 16.2')}
          <text x={17.4} y={5.2} fontSize={5.4} fontWeight={800} fill="#6E56CF" fontFamily="'Nunito Variable', Nunito, ui-rounded, sans-serif">z</text>
        </>
      )
      break
    case 'stresse':
      face = (
        <>
          {line('M6 8.4 Q8.4 7.6 10.2 6.2')}
          {line('M18 8.4 Q15.6 7.6 13.8 6.2')}
          {eyes(10.4)}
          {line('M7.6 16.2 q1.1 -1.1 2.2 0 q1.1 1.1 2.2 0 q1.1 -1.1 2.2 0 q1.1 1.1 2.2 0', 1.2)}
          <path d="M20 5 Q22 8.4 20 9.8 Q18 8.4 20 5 Z" fill="#8FD3FF" stroke="#3E9BE9" strokeWidth={0.4} />
        </>
      )
      break
    case 'nostalgique':
      face = (
        <>
          <ellipse cx={7.8} cy={8.8} rx={1.25} ry={1.55} fill={INK} />
          <ellipse cx={15.2} cy={8.8} rx={1.25} ry={1.55} fill={INK} />
          {line('M9.4 15.4 Q12 16.8 14.6 15.4')}
          <path d="M18.6 3.2 c0.6 -0.9 2 -0.5 1.8 0.6 c-0.2 0.9 -1.8 1.9 -1.8 1.9 c0 0 -1.6 -1 -1.8 -1.9 c-0.2 -1.1 1.2 -1.5 1.8 -0.6 Z" fill="#E5484D" />
        </>
      )
      break
    case 'triste':
      face = (
        <>
          {line('M6.2 8.2 Q8.4 7.6 10.2 6.6')}
          {line('M17.8 8.2 Q15.6 7.6 13.8 6.6')}
          {eyes(10.4)}
          {line('M8.2 17 Q12 13.6 15.8 17')}
          <path d="M7.4 12.4 Q9 15 7.4 16 Q5.8 15 7.4 12.4 Z" fill="#8FD3FF" stroke="#3E9BE9" strokeWidth={0.4} />
        </>
      )
      break
    default:
      face = (
        <>
          {eyes()}
          {line('M8.6 15 Q12 17.2 15.4 15')}
        </>
      )
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="smiley-jaune" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFEB8A" />
          <stop offset="1" stopColor="#F5B700" />
        </radialGradient>
      </defs>
      <circle cx={12} cy={12} r={11} fill="url(#smiley-jaune)" stroke="#D99A00" strokeWidth={0.6} />
      {face}
    </svg>
  )
}
