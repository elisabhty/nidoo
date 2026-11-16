import { Dices } from 'lucide-react'
import { useState } from 'react'
import { COLOR_KEYS, COLORS, HOUSES, shopItem } from '../lib/data'
import { select, tap } from '../lib/haptic'
import { ACCESSORIES, AGE_SCALE, encodeLook, lookOf, type Look } from '../lib/look'
import { GROUPS, PERSOS, persoOf, TONES, type Group, type Perso } from '../lib/persos'
import type { HouseType } from '../lib/types'
import { Character } from './Character'
import House from './House'
import { Segments } from './ui'

/** Choisir son personnage : la figurine en feutrine qui nous ressemble le plus, sa taille et ce qu'on porte. */
export function ProfilePicker({
  name, setName, avatar, setAvatar, color, setColor, placeholder = 'Ton prénom ou ton surnom', compact = false, owned = [],
}: { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void; placeholder?: string; compact?: boolean; owned?: string[] }) {
  const look = lookOf(avatar)
  const mine = persoOf(look)
  const [group, setGroup] = useState<Group>(mine.g)
  const [tone, setTone] = useState<number | null>(null)
  const [hop, setHop] = useState(0)
  const set = (patch: Partial<Look>) => {
    select()
    setAvatar(encodeLook({ ...look, ...patch }))
  }
  const pick = (p: Perso) => {
    set({ k: PERSOS.indexOf(p) + 1, a: p.a, p: 0 })
    setHop((n) => n + 1)
  }
  const c = COLORS[color] ?? COLORS.lavande
  // les plus jeunes d'abord, les grands-parents à la fin, chaque fois du teint le plus clair au plus foncé
  const list = PERSOS.filter((p) => p.g === group && (tone === null || p.t === tone)).sort((p, q) => Number(!!p.s) - Number(!!q.s) || p.t - q.t)
  const kids = group === 'fille' || group === 'garcon'
  const titre = (t: string) => <p className="mb-2 mt-5 px-1 text-note font-semibold uppercase tracking-[0.02em] text-brume">{t}</p>
  const accs = ACCESSORIES.map((a, i) => ({ a, i })).filter(({ a, i }) => i && owned.includes(`mode:${a}`))

  return (
    <>
      <div className="relative mx-auto h-[206px] w-[206px]">
        <span className="absolute inset-[5%] rounded-full" style={{ background: `radial-gradient(circle at 50% 35%, ${c.bg}, ${c.deep})` }} />
        <span className="absolute bottom-[6%] left-1/2 h-[6%] w-[40%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/15 blur-[3px]" />
        <button
          key={hop}
          onClick={() => {
            tap()
            setHop((n) => n + 1)
          }}
          className="absolute inset-x-0 bottom-[7%] mx-auto transition-[width] duration-300"
          style={{ width: `${54 * AGE_SCALE[look.a]}%`, animation: hop ? 'rebond 0.7s var(--ressort)' : 'pousse 0.6s var(--ressort) both', transformOrigin: '50% 100%' }}
          aria-label={`Mon personnage : ${mine.label}`}
        >
          <Character look={look} className="block h-auto w-full" />
        </button>
        <button
          onClick={() => {
            const pool = PERSOS.filter((p) => p.g === group)
            pick(pool[Math.floor(Math.random() * pool.length)])
          }}
          className="presse verre absolute bottom-[12%] right-[-4px] flex h-11 w-11 items-center justify-center rounded-full text-teinte"
          aria-label="Personnage au hasard"
          title="Au hasard"
        >
          <Dices size={20} strokeWidth={2.2} />
        </button>
      </div>

      <input aria-label={placeholder} autoComplete="given-name" enterKeyHint="done" className="champ mt-3 !bg-carte text-center font-rond text-titre3" placeholder={placeholder} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />

      <p className={`${compact ? 'mt-4' : 'mt-5'} px-1 text-center text-sous text-brume`}>Choisis le personnage qui te ressemble le plus.</p>
      <div className="mt-3">
        <Segments value={group} onChange={(g) => (select(), setGroup(g))} options={GROUPS} />
      </div>

      {/* le teint, pour trouver plus vite */}
      <div className="mt-3 flex items-center gap-2 px-1" role="group" aria-label="Teint">
        <button
          onClick={() => (select(), setTone(null))}
          aria-pressed={tone === null}
          className={`presse h-9 rounded-full px-3.5 text-sous font-semibold transition-colors ${tone === null ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
        >
          Tous
        </button>
        {TONES.map((hex, i) => (
          <button
            key={hex}
            onClick={() => (select(), setTone(tone === i ? null : i))}
            aria-pressed={tone === i}
            aria-label={`Teint ${i + 1}`}
            className="presse h-9 w-9 shrink-0 rounded-full"
            style={{ background: hex, boxShadow: tone === i ? '0 0 0 2.5px #FFFFFF, 0 0 0 4.5px #7A5AE0' : 'inset 0 0 0 1px rgba(29,26,43,0.12)' }}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {list.map((p) => {
          const on = p.id === mine.id && !!look.k
          return (
            <button
              key={p.id}
              onClick={() => pick(p)}
              aria-pressed={on}
              aria-label={p.label}
              className={`presse relative overflow-hidden rounded-[18px] px-1.5 pb-1 pt-2 transition-shadow ${on ? 'bg-teinte-doux ring-[2.5px] ring-teinte' : 'bg-carte'}`}
            >
              <img src={`./art/persos/${p.id}.webp`} alt="" loading="lazy" draggable={false} className="block aspect-[300/440] w-full select-none" />
            </button>
          )
        })}
      </div>

      {kids && (
        <>
          {titre('Sa taille dans la maison')}
          <Segments
            value={String(look.a === 1 ? 1 : 2)}
            onChange={(v) => set({ a: Number(v) })}
            options={[
              { key: '1', label: 'Ado' },
              { key: '2', label: 'Enfant' },
            ]}
          />
        </>
      )}

      {accs.length > 0 && (
        <>
          {titre('De la boutique')}
          <div className="flex flex-wrap gap-2">
            {[{ a: '', i: 0 }, ...accs].map(({ a, i }) => {
              const on = (look.v ?? 0) === i
              return (
                <button
                  key={i}
                  onClick={() => set({ v: i })}
                  aria-pressed={on}
                  className={`presse flex h-11 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-sous font-semibold transition-colors ${on ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
                >
                  {a ? <img src={`./art/mode-${a}.webp`} alt="" className="h-8 w-8" /> : <span className="w-1.5" />}
                  {a ? shopItem(`mode:${a}`)?.name ?? a : 'Rien'}
                </button>
              )
            })}
          </div>
        </>
      )}

      {titre('Couleur de fond')}
      <div className="flex flex-wrap gap-2.5 px-1">
        {COLOR_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => {
              select()
              setColor(k)
            }}
            aria-pressed={color === k}
            aria-label={`Fond ${k}`}
            className="presse h-9 w-9 rounded-full"
            style={{ background: `linear-gradient(160deg, ${COLORS[k].bg}, ${COLORS[k].ring})`, boxShadow: color === k ? `0 0 0 2.5px #FFFFFF, 0 0 0 4.5px ${COLORS[k].ring}` : undefined }}
          />
        ))}
      </div>
    </>
  )
}

export function HousePicker({ value, onChange }: { value: HouseType; onChange: (v: HouseType) => void }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2.5">
      {HOUSES.map((h) => (
        <button
          key={h.key}
          onClick={() => {
            select()
            onChange(h.key)
          }}
          aria-pressed={value === h.key}
          className={`presse overflow-hidden rounded-[20px] bg-carte pb-2.5 ${value === h.key ? 'ring-2 ring-teinte' : ''}`}
        >
          <House type={h.key} items={[]} phase="jour" className="!aspect-[1/1]" bare />
          <span className={`mt-2 block text-sous ${value === h.key ? 'font-semibold text-teinte-fonce' : 'font-medium'}`}>{h.label}</span>
          <span className="block px-1 text-note text-[#625A75]">{h.hint}</span>
        </button>
      ))}
    </div>
  )
}
