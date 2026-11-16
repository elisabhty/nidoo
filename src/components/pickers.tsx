import { ChevronDown, Dices } from 'lucide-react'
import { useId, useState } from 'react'
import { COLOR_KEYS, COLORS, HOUSES, shopItem } from '../lib/data'
import { select, tap } from '../lib/haptic'
import { ACCESSORIES, AGE_SCALE, encodeLook, lookOf, type Look } from '../lib/look'
import { BLUSH, BOUCHES, CHEVEUX, labHex, LEVRES, LUNETTES, MONTURES, NEZ, nomPeau, peauOf, peauProche, peauxDe, persoImg, skinLab, VOILES, YEUX } from '../lib/personnalise'
import { COULEURS_MONTURE, FORMES_LUNETTES } from '../lib/lunettes'
import { GROUPS, PERSOS, persoOf, TONES, type Group, type Perso } from '../lib/persos'
import { VISAGES } from '../lib/visages'
import type { HouseType } from '../lib/types'
import { Character } from './Character'
import House from './House'
import { Segments } from './ui'

/** Choisir son personnage : la figurine en feutrine qui nous ressemble le plus, sa taille et ce qu'on porte. */
export function ProfilePicker({
  name, setName, avatar, setAvatar, color, setColor, placeholder = 'Ton prénom ou ton surnom', compact = false, owned = [], collapsible = false,
}: { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void; placeholder?: string; compact?: boolean; owned?: string[]; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const customizationId = useId()
  const nameId = useId()
  const look = lookOf(avatar)
  const mine = persoOf(look)
  const [group, setGroup] = useState<Group>(mine.g)
  const [tone, setTone] = useState<number | null>(null)
  const [hop, setHop] = useState(0)
  const [tab, setTab] = useState<'peau' | 'cheveux' | 'visage' | 'lunettes' | 'maquillage'>('peau')
  const [zoom, setZoom] = useState(false)
  const set = (patch: Partial<Look>) => {
    select()
    setAvatar(encodeLook({ ...look, ...patch }))
  }
  // personnaliser : on voit le visage de près
  const tune = (patch: Partial<Look>) => {
    set(patch)
    setZoom(true)
  }
  // en changeant de figurine, on garde à peu près la même couleur de peau si on en avait choisi une
  const pick = (p: Perso, t?: number) => {
    const q = t ?? (look.q ? peauProche(p, skinLab(mine, look)) : 0)
    set({ k: PERSOS.indexOf(p) + 1, a: p.a, p: 0, q })
    setZoom(false)
    setHop((n) => n + 1)
  }
  const vis = VISAGES[mine.id]
  const peaux = peauxDe(mine)
  const peau = peauOf(mine, look)
  const c = COLORS[color] ?? COLORS.lavande
  // les plus jeunes d'abord, les grands-parents à la fin, chaque fois du teint le plus clair au plus foncé
  // avec un teint choisi : toutes les figurines qui existent dans ce teint, avec leur peau d'origine ou une autre
  const inTone = (p: Perso): number => {
    if (tone === null || p.t === tone) return 0
    const c = peauxDe(p).filter((x) => x.t && x.b === tone)
    if (!c.length) return -1
    return (tone === TONES.length - 1 ? c.reduce((a, b) => (b.lab[0] < a.lab[0] ? b : a)) : c[0]).t
  }
  const list = PERSOS.filter((p) => p.g === group && inTone(p) >= 0).sort((p, q) => Number(!!p.s) - Number(!!q.s) || Number(p.t !== tone) - Number(q.t !== tone) || p.t - q.t)
  const kids = group === 'fille' || group === 'garcon'
  const [all, setAll] = useState(false)
  // deux rangées d'abord (avec la figurine choisie), le reste sur demande
  const first = list.slice(0, 8)
  if (list.includes(mine) && !first.includes(mine)) first[7] = mine
  const shown = all || tone !== null || list.length <= 12 ? list : first
  const titre = (t: string) => <p className="mb-2 mt-5 px-1 text-note font-semibold uppercase tracking-[0.02em] text-brume">{t}</p>
  const accs = ACCESSORIES.map((a, i) => ({ a, i })).filter(({ a, i }) => i && owned.includes(`mode:${a}`))
  /** Des pastilles de couleur ; la première (0) garde la couleur d'origine de la figurine. */
  const nuancier = (labels: string[], hexes: string[], value: number, onPick: (i: number) => void, origin?: string, originLabel?: string) => (
    <div className="flex flex-wrap gap-2.5">
      {originLabel !== undefined && (
        <button
          onClick={() => onPick(0)}
          aria-pressed={value === 0}
          aria-label={originLabel}
          className={`presse flex h-9 items-center gap-1.5 rounded-full pl-1 pr-3 text-note font-semibold ${value === 0 ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
        >
          <span className="h-7 w-7 rounded-full" style={{ background: origin ?? 'transparent', boxShadow: 'inset 0 0 0 1px rgba(29,26,43,0.12)' }} />
          {originLabel}
        </button>
      )}
      {hexes.map((hex, i) => {
        const k = originLabel !== undefined ? i + 1 : i + 1
        const on = value === k
        return (
          <button
            key={labels[i]}
            onClick={() => onPick(k)}
            aria-pressed={on}
            aria-label={labels[i]}
            title={labels[i]}
            className="presse h-9 w-9 rounded-full"
            style={{ background: hex, boxShadow: on ? '0 0 0 2.5px #FFFFFF, 0 0 0 4.5px #7A5AE0' : 'inset 0 0 0 1px rgba(29,26,43,0.12)' }}
          />
        )
      })}
    </div>
  )
  const puces = (labels: string[], value: number, onPick: (i: number) => void) => (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => (
        <button
          key={label}
          onClick={() => onPick(i)}
          aria-pressed={value === i}
          className={`presse h-9 rounded-full px-3.5 text-sous font-semibold transition-colors ${value === i ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )

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
          style={{ width: zoom ? '84%' : `${54 * AGE_SCALE[look.a]}%`, animation: hop ? 'rebond 0.7s var(--ressort)' : 'pousse 0.6s var(--ressort) both', transformOrigin: '50% 100%' }}
          aria-label={`Mon personnage : ${mine.label}`}
        >
          {zoom ? <Character look={look} bust className="block h-auto w-full overflow-hidden rounded-full" /> : <Character look={look} className="block h-auto w-full" />}
        </button>
        {zoom && (
          <button onClick={() => (tap(), setZoom(false))} className="presse verre absolute bottom-[12%] left-[-4px] h-11 rounded-full px-3 text-note font-semibold text-teinte-fonce">
            En pied
          </button>
        )}
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

      <label htmlFor={nameId} className="mb-1.5 mt-5 px-1 text-note font-semibold text-brume">{placeholder}</label>
      <input id={nameId} aria-label={placeholder} autoComplete="given-name" enterKeyHint="done" className="champ !bg-carte text-center font-rond text-titre3" placeholder={placeholder} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />

      {collapsible && (
        <button type="button" aria-expanded={expanded} aria-controls={customizationId} onClick={() => setExpanded((value) => !value)} className="presse mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce">
          {expanded ? 'Réduire la personnalisation' : 'Personnaliser mon personnage'}
          <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      <div id={customizationId} hidden={collapsible && !expanded}>

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
        {shown.map((p) => {
          const on = p.id === mine.id && !!look.k
          const t = tone === null ? undefined : inTone(p)
          const img = on ? persoImg(p, peauOf(p, look)) : persoImg(p, t ?? 0)
          return (
            <button
              key={p.id}
              onClick={() => pick(p, t)}
              aria-pressed={on}
              aria-label={p.label}
              className={`presse relative overflow-hidden rounded-[18px] px-1.5 pb-1 pt-2 transition-shadow ${on ? 'bg-teinte-doux ring-[2.5px] ring-teinte' : 'bg-carte'}`}
            >
              <img src={img} alt="" loading="lazy" draggable={false} className="block aspect-[300/440] w-full select-none" />
            </button>
          )
        })}
      </div>

      {shown.length < list.length && (
        <button onClick={() => (tap(), setAll(true))} className="presse mt-2 h-11 w-full rounded-full bg-remplissage text-sous font-semibold text-teinte-fonce">
          Voir les {list.length} personnages
        </button>
      )}

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


      {titre('Personnaliser')}
      <div className="no-bar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="tablist">
        {(
          [
            ['peau', 'Peau'],
            ['cheveux', mine.c === 'voile' ? 'Voile' : 'Cheveux'],
            ['visage', 'Visage'],
            ['lunettes', 'Lunettes'],
            ['maquillage', 'Maquillage'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => (select(), setTab(k), setZoom(true))}
            className={`presse h-10 shrink-0 rounded-full px-4 text-sous font-semibold transition-colors ${tab === k ? 'bg-encre text-white' : 'bg-carte text-encre'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="groupe mt-3 p-3.5">
        {tab === 'peau' && (
          <>
            <p className="mb-2 text-note font-semibold text-brume">Couleur de peau</p>
            {peaux.length > 1 ? (
              <div className="flex flex-wrap gap-2.5">
                {peaux.map((x) => {
                  const on = peau === x.t
                  const label = x.t ? nomPeau(x.lab[0]) : 'La sienne'
                  return x.t ? (
                    <button
                      key={x.t}
                      onClick={() => tune({ q: x.t })}
                      aria-pressed={on}
                      aria-label={label}
                      title={label}
                      className="presse h-9 w-9 rounded-full"
                      style={{ background: labHex(x.lab), boxShadow: on ? '0 0 0 2.5px #FFFFFF, 0 0 0 4.5px #7A5AE0' : 'inset 0 0 0 1px rgba(29,26,43,0.12)' }}
                    />
                  ) : (
                    <button
                      key={0}
                      onClick={() => tune({ q: 0 })}
                      aria-pressed={on}
                      className={`presse flex h-9 items-center gap-1.5 rounded-full pl-1 pr-3 text-note font-semibold ${on ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
                    >
                      <span className="h-7 w-7 rounded-full" style={{ background: labHex(x.lab), boxShadow: 'inset 0 0 0 1px rgba(29,26,43,0.12)' }} />
                      {label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sous text-brume">Cette figurine n'existe qu'avec cette couleur de peau. Choisis un teint au-dessus de la galerie : toutes les figurines qui existent dans ce teint s'affichent.</p>
            )}
          </>
        )}
        {tab === 'cheveux' &&
          (vis?.ha ? (
            <>
              <p className="mb-2 text-note font-semibold text-brume">{mine.c === 'voile' ? 'Couleur du voile' : 'Couleur des cheveux'}</p>
              {mine.c === 'voile'
                ? nuancier(VOILES.map((t) => t.label), VOILES.map((t) => labHex(t.lab)), look.x ?? 0, (i) => tune({ x: i }), labHex(vis.ha), 'Le sien')
                : nuancier(CHEVEUX.map((t) => t.label), CHEVEUX.map((t) => labHex(t.lab)), look.x ?? 0, (i) => tune({ x: i }), labHex(vis.ha), 'Les siens')}
            </>
          ) : (
            <p className="text-sous text-brume">{mine.c === 'chauve' ? 'Pas de cheveux à colorer sur cette figurine.' : 'La couleur de cette coiffure ne se change pas. Choisis une figurine qui en a une autre.'}</p>
          ))}
        {tab === 'visage' && (
          <>
            <p className="mb-2 text-note font-semibold text-brume">Couleur des yeux</p>
            {nuancier(YEUX.map((t) => t.label), YEUX.map((t) => labHex(t.lab)), look.y ?? 0, (i) => tune({ y: i }), '#2B2224', 'Les siens')}
            {vis?.bouche ? (
              <>
                <p className="mb-2 mt-4 text-note font-semibold text-brume">Nez</p>
                {puces(NEZ, look.n ?? 0, (i) => tune({ n: i }))}
                <p className="mb-2 mt-4 text-note font-semibold text-brume">Bouche</p>
                {puces(BOUCHES, look.u ?? 0, (i) => tune({ u: i }))}
              </>
            ) : (
              <p className="mt-4 text-sous text-brume">Avec la barbe, le nez et la bouche restent ceux de la figurine.</p>
            )}
          </>
        )}
        {tab === 'lunettes' && (
          <>
            {mine.l ? (
              <p className="text-sous text-brume">Cette figurine porte déjà ses lunettes. Pour en choisir d'autres, prends une figurine sans lunettes.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {LUNETTES.map((label, i) => {
                    const on = (look.j ?? 0) === i
                    return (
                      <button
                        key={label}
                        onClick={() => tune({ j: i })}
                        aria-pressed={on}
                        aria-label={label}
                        className={`presse flex h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-note font-semibold transition-colors ${on ? 'bg-teinte-doux text-teinte-fonce ring-2 ring-teinte' : 'bg-remplissage text-encre'}`}
                      >
                        {i ? <img src={`./art/persos/lun-${FORMES_LUNETTES[i - 1]}-${COULEURS_MONTURE[look.w ?? 0] ?? 'noire'}.webp`} alt="" className="h-6 w-auto max-w-full" draggable={false} /> : <span className="h-6 leading-6 text-brume">—</span>}
                        {label}
                      </button>
                    )
                  })}
                </div>
                {(look.j ?? 0) > 0 && (
                  <>
                    <p className="mb-2 mt-4 text-note font-semibold text-brume">Monture</p>
                    {nuancier(MONTURES.map((m) => m.label), MONTURES.map((m) => m.hex), (look.w ?? 0) + 1, (i) => tune({ w: Math.max(0, i - 1) }))}
                  </>
                )}
              </>
            )}
          </>
        )}
        {tab === 'maquillage' && (
          <>
            <p className="mb-2 text-note font-semibold text-brume">Taches de rousseur</p>
            {puces(['Sans', 'Avec'], look.f ?? 0, (i) => tune({ f: i }))}
            <p className="mb-2 mt-4 text-note font-semibold text-brume">Blush</p>
            {puces(BLUSH, look.z ?? 0, (i) => tune({ z: i }))}
            <p className="mb-2 mt-4 text-note font-semibold text-brume">Rouge à lèvres</p>
            {nuancier(LEVRES.map((t) => t.label), LEVRES.map((t) => labHex(t.lab)), look.l ?? 0, (i) => tune({ l: i }), undefined, 'Sans')}
          </>
        )}
      </div>
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
      </div>
    </>
  )
}

export function HousePicker({ value, onChange }: { value: HouseType; onChange: (v: HouseType) => void }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2.5">
      {HOUSES.map((h) => (
        <button
          type="button"
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
