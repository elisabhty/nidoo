import { avatarEmoji } from '../lib/data'
import type { HouseType, Member } from '../lib/types'
import { dayPhase, isToday } from '../lib/util'

// La maison de la famille : une fenêtre par membre (allumée quand il a donné
// de ses nouvelles aujourd'hui) et les décorations débloquées avec les étoiles.

const SKY = {
  matin: ['#FFE0CB', '#F4E6FA'],
  jour: ['#D9EAFB', '#F7EEFB'],
  soir: ['#F8C4A2', '#CDB6EF'],
  nuit: ['#3F3470', '#8672C4'],
} as const

type Slot = { x: number; y: number; round?: boolean }
const SLOTS: Record<HouseType, Slot[]> = {
  maison: [{ x: 130, y: 130 }, { x: 208, y: 130 }, { x: 169, y: 130 }, { x: 130, y: 166 }, { x: 208, y: 166 }, { x: 169, y: 90, round: true }],
  appartement: [{ x: 140, y: 84 }, { x: 198, y: 84 }, { x: 140, y: 116 }, { x: 198, y: 116 }, { x: 140, y: 148 }, { x: 198, y: 148 }],
  chalet: [{ x: 132, y: 140 }, { x: 206, y: 140 }, { x: 169, y: 96, round: true }, { x: 132, y: 172 }, { x: 206, y: 172 }],
}
const CHIMNEY: Record<HouseType, { x: number; y: number }> = {
  maison: { x: 222, y: 72 },
  appartement: { x: 212, y: 46 },
  chalet: { x: 224, y: 78 },
}

export default function House({
  type, members, items, className = '', phase = dayPhase(),
}: { type: HouseType; members: Member[]; items: string[]; className?: string; phase?: keyof typeof SKY }) {
  const night = phase === 'nuit'
  const has = (k: string) => items.includes(k)
  const [s1, s2] = SKY[phase]
  const dark = night ? '#574A85' : '#DCD3EF'
  const wall = night ? '#EFE3D6' : '#FFF4E6'
  const id = `ciel-${phase}`
  const slots = SLOTS[type]
  const ch = CHIMNEY[type]

  return (
    <svg viewBox="0 0 360 250" className={className} role="img" aria-label="La maison de la famille">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s1} />
          <stop offset="1" stopColor={s2} />
        </linearGradient>
        <radialGradient id="halo">
          <stop offset="0" stopColor="#FFE9A8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
        </radialGradient>
        <clipPath id="cadre">
          <rect width="360" height="250" rx="28" />
        </clipPath>
      </defs>

      <g clipPath="url(#cadre)">
        <rect width="360" height="250" fill={`url(#${id})`} />

        {night ? (
          <>
            {[[40, 34], [92, 62], [150, 26], [250, 40], [310, 78], [330, 28], [200, 52], [66, 96]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} fill="#FFF6D6" style={{ animation: `scintille ${2 + (i % 4) * 0.6}s ease-in-out ${i * 0.3}s infinite` }} />
            ))}
            <circle cx="296" cy="50" r="17" fill="#FFF3C9" />
            <circle cx="303" cy="45" r="15" fill={s1} opacity="0.92" />
          </>
        ) : (
          <>
            <circle cx={phase === 'soir' ? 60 : 300} cy={phase === 'jour' ? 46 : 70} r="34" fill="url(#halo)" />
            <circle cx={phase === 'soir' ? 60 : 300} cy={phase === 'jour' ? 46 : 70} r="16" fill={phase === 'soir' ? '#FFB98A' : '#FFE08A'} />
            <g fill="#fff" opacity="0.85" style={{ animation: 'derive 14s ease-in-out infinite' }}>
              <ellipse cx="74" cy="52" rx="24" ry="9" />
              <ellipse cx="90" cy="45" rx="15" ry="9" />
            </g>
            <g fill="#fff" opacity="0.7" style={{ animation: 'derive 18s ease-in-out 2s infinite' }}>
              <ellipse cx="232" cy="34" rx="20" ry="7" />
              <ellipse cx="246" cy="29" rx="12" ry="7" />
            </g>
          </>
        )}

        {has('montgolfiere') && (
          <g style={{ animation: 'derive 9s ease-in-out infinite' }}>
            <path d="M118 26c-13 0-22 10-22 22 0 11 9 19 17 27h10c8-8 17-16 17-27 0-12-9-22-22-22z" fill="#F99263" />
            <path d="M118 26c-5 0-8 10-8 22 0 11 3 19 6 27h4c3-8 6-16 6-27 0-12-3-22-8-22z" fill="#FFE4D2" />
            <path d="M113 76l-1 6M123 76l1 6" stroke="#8A6B52" strokeWidth="1.2" />
            <rect x="111" y="82" width="14" height="9" rx="2.5" fill="#B98A62" />
          </g>
        )}

        {/* collines */}
        <ellipse cx="80" cy="232" rx="170" ry="52" fill={night ? '#5E7E77' : '#CFE7CB'} />
        <ellipse cx="300" cy="240" rx="180" ry="58" fill={night ? '#557670' : '#C2E0C0'} />
        <ellipse cx="180" cy="262" rx="260" ry="66" fill={night ? '#4C6C69' : '#B4D9B5'} />

        {has('arbre') && (
          <g>
            <rect x="52" y="150" width="9" height="54" rx="4" fill="#A67C5B" />
            <circle cx="56" cy="134" r="27" fill={night ? '#4F8A6E' : '#7FC08F'} />
            <circle cx="38" cy="150" r="16" fill={night ? '#487F66' : '#72B684'} />
            <circle cx="74" cy="149" r="17" fill={night ? '#55917A' : '#8BCB9A'} />
            <circle cx="50" cy="126" r="3" fill="#F99263" />
            <circle cx="68" cy="138" r="3" fill="#F99263" />
          </g>
        )}

        {has('cabane') && (
          <g>
            <rect x="332" y="158" width="4" height="46" rx="2" fill="#A67C5B" />
            <rect x="322" y="140" width="24" height="20" rx="4" fill="#FFE4D2" />
            <path d="M318 142l16-13 16 13z" fill="#A88CE0" strokeLinejoin="round" stroke="#A88CE0" strokeWidth="3" />
            <circle cx="334" cy="150" r="4" fill="#7A5A44" />
            <path d="M344 132c3-3 7-2 8 1-3 0-5 1-6 3z" fill="#74AEDD" />
          </g>
        )}

        {has('balancoire') && (
          <g>
            <path d="M282 204l12-52 12 52M322 204l-12-52" stroke="#A67C5B" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M290 152h24" stroke="#A67C5B" strokeWidth="4" strokeLinecap="round" />
            <g style={{ transformOrigin: '302px 152px', animation: 'balance 3.2s ease-in-out infinite' }}>
              <path d="M297 152v32M307 152v32" stroke="#8A6B52" strokeWidth="1.4" />
              <rect x="293" y="184" width="18" height="4.5" rx="2" fill="#F99263" />
            </g>
          </g>
        )}

        {/* la maison */}
        {type === 'maison' && (
          <g>
            <rect x={ch.x - 8} y={ch.y} width="16" height="36" rx="3" fill="#C2ACEC" />
            <rect x="118" y="118" width="124" height="86" rx="10" fill={wall} />
            <path d="M106 124l74-58 74 58z" fill="#A88CE0" stroke="#A88CE0" strokeWidth="12" strokeLinejoin="round" />
            <path d="M118 196h124v8H118z" fill="#F3E3D2" />
          </g>
        )}
        {type === 'appartement' && (
          <g>
            <rect x={ch.x - 7} y={ch.y} width="14" height="20" rx="3" fill="#C2ACEC" />
            <rect x="128" y="68" width="104" height="136" rx="10" fill={wall} />
            <rect x="120" y="60" width="120" height="16" rx="8" fill="#A88CE0" />
            {[110, 142, 174].map((y) => (
              <g key={y} fill="#C2ACEC">
                <rect x="136" y={y} width="30" height="3.5" rx="1.75" />
                <rect x="194" y={y} width="30" height="3.5" rx="1.75" />
              </g>
            ))}
            <path d="M128 196h104v8H128z" fill="#F3E3D2" />
          </g>
        )}
        {type === 'chalet' && (
          <g>
            <rect x={ch.x - 8} y={ch.y} width="16" height="36" rx="3" fill="#B98A62" />
            <rect x="116" y="126" width="128" height="78" rx="8" fill={night ? '#D2AE86' : '#EBCBA5'} />
            {[146, 166, 186].map((y) => (
              <path key={y} d={`M116 ${y}h128`} stroke="#D9B48A" strokeWidth="1.5" />
            ))}
            <path d="M100 132l80-70 80 70z" fill="#8E6FD1" stroke="#8E6FD1" strokeWidth="12" strokeLinejoin="round" />
            <path d="M158 80l22-19 22 19c-7 5-12 0-22 3-10-3-15 2-22-3z" fill="#fff" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
          </g>
        )}

        {has('guirlande') && (
          <g>
            {(type === 'appartement'
              ? [[130, 80], [146, 82], [162, 80], [180, 82], [198, 80], [214, 82], [230, 80]]
              : [[120, 122], [136, 110], [151, 98], [166, 86], [194, 86], [209, 98], [224, 110], [240, 122]]
            ).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y + (type === 'appartement' ? 0 : 12)} r="3.2" fill={['#FFD166', '#F99263', '#FBD6E1', '#B8E0C2'][i % 4]} style={{ animation: `scintille 1.8s ease-in-out ${i * 0.22}s infinite` }} />
            ))}
          </g>
        )}

        {/* fenêtres : une par membre */}
        {slots.map((s, i) => {
          const m = members[i]
          const lit = !!m && isToday(m.mood_at)
          const fill = !m ? dark : lit ? '#FFD98A' : night ? '#6D5FA0' : '#E9E2F7'
          return (
            <g key={i}>
              {lit && <circle cx={s.x + 11} cy={s.y + 11} r="20" fill="url(#halo)" opacity={night ? 0.9 : 0.45} />}
              <rect x={s.x} y={s.y} width="22" height="22" rx={s.round ? 11 : 6} fill={fill} stroke="#fff" strokeWidth="2.5" />
              {m && (
                <text x={s.x + 11} y={s.y + 16} textAnchor="middle" fontSize="13" opacity={lit ? 1 : 0.55}>
                  {avatarEmoji(m.avatar)}
                </text>
              )}
            </g>
          )
        })}

        {/* porte */}
        <path d={type === 'appartement' ? 'M168 204v-24a12 12 0 0124 0v24z' : 'M168 204v-28a12 12 0 0124 0v28z'} fill="#F99263" />
        <circle cx="187" cy="190" r="1.8" fill="#FFF4E6" />
        <path d="M160 204h40v4h-40z" fill="#E7D3C0" />

        {has('fumee') &&
          [0, 1, 2].map((i) => (
            <circle key={i} cx={ch.x} cy={ch.y - 4} r="6" fill="#fff" opacity="0" style={{ animation: `fumee 3.6s ease-out ${i * 1.2}s infinite` }} />
          ))}

        {has('lanterne') && (
          <g>
            <rect x="97" y="164" width="4" height="42" rx="2" fill="#6F6590" />
            <circle cx="99" cy="158" r="16" fill="url(#halo)" style={{ animation: 'scintille 3s ease-in-out infinite' }} />
            <rect x="92" y="150" width="14" height="16" rx="4" fill="#FFD98A" stroke="#6F6590" strokeWidth="2.5" />
          </g>
        )}

        {has('boite') && (
          <g>
            <rect x="262" y="186" width="3.5" height="20" rx="1.75" fill="#8A6B52" />
            <rect x="254" y="174" width="20" height="14" rx="6" fill="#EE7A4B" />
            <rect x="258" y="179" width="12" height="2.2" rx="1.1" fill="#fff" opacity="0.85" />
            <path d="M274 176v-7h6v4h-6" fill="#FFD166" />
          </g>
        )}

        {has('fleurs') && (
          <g>
            {[[108, 206, '#F99263'], [116, 210, '#E888A6'], [100, 211, '#FFD166'], [248, 208, '#E888A6'], [240, 212, '#A88CE0']].map(([x, y, c], i) => (
              <g key={i}>
                <path d={`M${x} ${y}v9`} stroke="#6FAF80" strokeWidth="2" strokeLinecap="round" />
                <circle cx={x as number} cy={y as number} r="4.6" fill={c as string} />
                <circle cx={x as number} cy={y as number} r="1.7" fill="#FFF4E6" />
              </g>
            ))}
          </g>
        )}

        {has('chat') && (
          <g fill="#7A5A44">
            <ellipse cx="226" cy="204" rx="8" ry="7" />
            <circle cx="226" cy="193" r="6" />
            <path d="M221 190l1-7 4 4zM231 190l-1-7-4 4z" />
            <path d="M233 206c7 1 9-4 7-8" stroke="#7A5A44" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <circle cx="224" cy="193" r="1" fill="#FFD98A" />
            <circle cx="228.5" cy="193" r="1" fill="#FFD98A" />
          </g>
        )}

        {has('fontaine') && (
          <g>
            <path d="M52 226c0-5 8-12 18-12s18 7 18 12" stroke="#9CCBEF" strokeWidth="2" fill="none" strokeLinecap="round" style={{ animation: 'scintille 2s ease-in-out infinite' }} />
            <rect x="67" y="212" width="6" height="18" rx="3" fill="#CFC6E6" />
            <ellipse cx="70" cy="232" rx="24" ry="7.5" fill="#CFC6E6" />
            <ellipse cx="70" cy="230.5" rx="19" ry="5" fill="#9CCBEF" />
          </g>
        )}

        {has('potager') && (
          <g>
            <rect x="272" y="222" width="62" height="18" rx="8" fill="#A67C5B" />
            {[282, 295, 308, 321].map((x, i) => (
              <g key={x}>
                <path d={`M${x} 226c-3-5-1-8 0-9 1 1 3 4 0 9z`} fill="#6FAF80" />
                <path d={`M${x} 226c3-4 6-4 7-3-1 2-3 4-7 3z`} fill="#8BCB9A" />
                <circle cx={x} cy="229" r="2.6" fill={i % 2 ? '#EE7A4B' : '#F99263'} />
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  )
}
