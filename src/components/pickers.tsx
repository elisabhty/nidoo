import { Check, Palette } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COLOR_KEYS, COLORS, HOUSES, shopItem } from '../lib/data'
import { select, tap } from '../lib/haptic'
import { ACCESSORIES, AGE_SCALE, encodeLook, lookOf, type Look } from '../lib/look'
import { BLUSH, BOUCHES, CHEVEUX, labHex, LUNETTES, MONTURES, NEZ, nomPeau, peauOf, peauProche, peauxDe, persoImg, skinLab, VOILES, YEUX } from '../lib/personnalise'
import { COULEURS_MONTURE, FORMES_LUNETTES } from '../lib/lunettes'
import { GROUPS, PERSOS, persoOf, TONES, type Group, type Perso } from '../lib/persos'
import { VISAGES } from '../lib/visages'
import type { HouseType } from '../lib/types'
import { Character } from './Character'
import House from './House'
import { Btn, Segments, Sheet } from './ui'

/** L'état du personnage en cours de choix, partagé entre l'aperçu et les options (écran et fenêtre). */
function usePerso(avatar: string, setAvatar: (v: string) => void) {
  const look = lookOf(avatar)
  const mine = persoOf(look)
  const [group, setGroup] = useState<Group>(mine.g)
  const [hop, setHop] = useState(0)
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
  return { look, mine, group, setGroup, hop, setHop, zoom, setZoom, set, tune, pick }
}
type Perso_ = ReturnType<typeof usePerso>

/** Le portrait : la figurine sur son fond. Un tap la fait sauter. */
function Portrait({ ed, color, size = 206 }: { ed: Perso_; color: string; size?: number }) {
  const { look, mine, zoom, hop } = ed
  const c = COLORS[color] ?? COLORS.lavande
  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-[5%] rounded-full" style={{ background: `radial-gradient(circle at 50% 35%, ${c.bg}, ${c.deep})` }} />
      <span className="absolute bottom-[6%] left-1/2 h-[6%] w-[40%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/15 blur-[3px]" />
      <button
        key={hop}
        onClick={() => {
          tap()
          ed.setHop((n) => n + 1)
        }}
        className="absolute inset-x-0 bottom-[7%] mx-auto transition-[width] duration-300"
        style={{ width: zoom ? '84%' : `${54 * AGE_SCALE[look.a]}%`, animation: hop ? 'rebond 0.7s var(--ressort)' : 'pousse 0.6s var(--ressort) both', transformOrigin: '50% 100%' }}
        aria-label={`Mon personnage : ${mine.label}`}
      >
        {zoom ? <Character look={look} bust className="block h-auto w-full overflow-hidden rounded-full" /> : <Character look={look} className="block h-auto w-full" />}
      </button>
      {zoom && (
        <button onClick={() => (tap(), ed.setZoom(false))} className="presse verre absolute bottom-[10%] left-[-14px] h-10 whitespace-nowrap rounded-full px-3 text-note font-bold text-teinte-fonce">
          Voir en entier
        </button>
      )}
    </div>
  )
}

/** Tout ce qu'on peut choisir : la figurine (par catégorie et couleur de peau), sa taille, les détails, le fond. */
function PersoOptions({ ed, color, setColor, owned = [] }: { ed: Perso_; color: string; setColor: (v: string) => void; owned?: string[] }) {
  const { look, mine, group, set, tune, pick } = ed
  const peaux = peauxDe(mine)
  const peau = peauOf(mine, look)
  // une seule rangée de couleurs de peau : elle trie la galerie ET habille la figurine choisie
  const [tone, setTone] = useState<number | null>(() => (peau ? peaux.find((x) => x.t === peau)?.b ?? null : null))
  const [tab, setTab] = useState<'cheveux' | 'visage' | 'lunettes' | 'maquillage'>('cheveux')
  const vis = VISAGES[mine.id]
  // avec un teint choisi : toutes les figurines qui existent dans ce teint, avec leur peau d'origine ou une autre
  const inToneOf = (p: Perso, tn: number | null): number => {
    if (tn === null || p.t === tn) return 0
    const c = peauxDe(p).filter((x) => x.t && x.b === tn)
    if (!c.length) return -1
    return (tn === TONES.length - 1 ? c.reduce((a, b) => (b.lab[0] < a.lab[0] ? b : a)) : c[0]).t
  }
  const inTone = (p: Perso) => inToneOf(p, tone)
  const chooseTone = (tn: number | null) => {
    select()
    setTone(tn)
    const t = inToneOf(mine, tn)
    if (t >= 0 && t !== peau) set({ q: t })
  }
  // les plus jeunes d'abord, les grands-parents à la fin, chaque fois du teint le plus clair au plus foncé
  const list = PERSOS.filter((p) => p.g === group && inTone(p) >= 0).sort((p, q) => Number(!!p.s) - Number(!!q.s) || Number(p.t !== tone) - Number(q.t !== tone) || p.t - q.t)
  const kids = group === 'fille' || group === 'garcon'
  const [all, setAll] = useState(false)
  // deux rangées d'abord (avec la figurine choisie), le reste sur demande
  const first = list.slice(0, 8)
  if (list.includes(mine) && !first.includes(mine)) first[7] = mine
  const shown = all || tone !== null || list.length <= 12 ? list : first
  const titre = (t: string) => <p className="mb-2 mt-5 px-1 text-note font-semibold uppercase tracking-[0.02em] text-brume">{t}</p>
  const accs = ACCESSORIES.map((a, i) => ({ a, i })).filter(({ a, i }) => i && owned.includes(`mode:${a}`))
  const anneau = (on: boolean) => (on ? '0 0 0 2.5px #FFFFFF, 0 0 0 4.5px #7A5AE0' : 'inset 0 0 0 1px rgba(29,26,43,0.12)')
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
      {hexes.map((hex, i) => (
        <button key={labels[i]} onClick={() => onPick(i + 1)} aria-pressed={value === i + 1} aria-label={labels[i]} title={labels[i]} className="presse h-9 w-9 rounded-full" style={{ background: hex, boxShadow: anneau(value === i + 1) }} />
      ))}
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
      <Segments value={group} onChange={(g) => (select(), ed.setGroup(g))} options={GROUPS} />

      {/* la couleur de peau : une seule rangée, pour trouver plus vite et pour habiller sa figurine */}
      <div className="mt-3 flex items-center gap-2 px-1" role="group" aria-label="Couleur de peau">
        <button
          onClick={() => chooseTone(null)}
          aria-pressed={tone === null}
          className={`presse h-9 shrink-0 rounded-full px-3.5 text-sous font-semibold transition-colors ${tone === null ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
        >
          D’origine
        </button>
        {TONES.map((hex, i) => (
          <button key={hex} onClick={() => chooseTone(tone === i ? null : i)} aria-pressed={tone === i} aria-label={`Peau ${nomPeau(peauxDe(PERSOS.find((p) => p.t === i) ?? mine)[0].lab[0]).toLowerCase()}`} className="presse h-9 w-9 shrink-0 rounded-full" style={{ background: hex, boxShadow: anneau(tone === i) }} />
        ))}
      </div>
      {tone !== null && inToneOf(mine, tone) < 0 && <p className="mt-2 px-1 text-note text-brume">Ta figurine n’existe pas avec cette peau : choisis-en une dans la galerie.</p>}

      <div className="mt-3 grid grid-cols-4 gap-2">
        {shown.map((p) => {
          const on = p.id === mine.id
          const t = tone === null ? undefined : inTone(p)
          const img = on ? persoImg(p, peau) : persoImg(p, t ?? 0)
          return (
            <button
              key={p.id}
              onClick={() => pick(p, t)}
              aria-pressed={on}
              aria-label={p.label}
              className={`presse relative overflow-hidden rounded-[18px] px-1.5 pb-1 pt-2 transition-shadow ${on ? 'bg-teinte-doux ring-[2.5px] ring-inset ring-teinte' : 'bg-carte'}`}
            >
              <img src={img} alt="" loading="lazy" draggable={false} className="block aspect-[300/440] w-full select-none" />
              {on && (
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-teinte text-white shadow-carte" aria-hidden="true">
                  <Check size={14} strokeWidth={3.2} />
                </span>
              )}
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
            onClick={() => (select(), setTab(k), ed.setZoom(true))}
            className={`presse h-10 shrink-0 rounded-full px-4 text-sous font-semibold transition-colors ${tab === k ? 'bg-encre text-white' : 'bg-carte text-encre'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="groupe mt-3 p-3.5">
        {tab === 'cheveux' &&
          (vis?.ha ? (
            <>
              <p className="mb-2 text-note font-semibold text-brume">{mine.c === 'voile' ? 'Couleur du voile' : 'Couleur des cheveux'}</p>
              {mine.c === 'voile'
                ? nuancier(VOILES.map((t) => t.label), VOILES.map((t) => labHex(t.lab)), look.x ?? 0, (i) => tune({ x: i }), labHex(vis.ha), 'D’origine')
                : nuancier(CHEVEUX.map((t) => t.label), CHEVEUX.map((t) => labHex(t.lab)), look.x ?? 0, (i) => tune({ x: i }), labHex(vis.ha), 'D’origine')}
            </>
          ) : (
            <p className="text-sous text-brume">{mine.c === 'chauve' ? 'Pas de cheveux à colorer sur cette figurine.' : 'La couleur de cette coiffure ne se change pas. Choisis une figurine qui en a une autre.'}</p>
          ))}
        {tab === 'visage' && (
          <>
            <p className="mb-2 text-note font-semibold text-brume">Couleur des yeux</p>
            {nuancier(YEUX.map((t) => t.label), YEUX.map((t) => labHex(t.lab)), look.y ?? 0, (i) => tune({ y: i }), '#2B2224', 'D’origine')}
            {vis?.bouche ? (
              <>
                <p className="mb-2 mt-4 text-note font-semibold text-brume">Nez</p>
                {puces(NEZ, look.n ?? 0, (i) => tune({ n: i }))}
                <p className="mb-2 mt-4 text-note font-semibold text-brume">Bouche</p>
                {puces(BOUCHES, look.u ?? 0, (i) => tune({ u: i }))}
                <p className="mb-2 mt-4 text-note font-semibold text-brume">Fossettes</p>
                {puces(['Sans', 'Avec'], look.d ?? 0, (i) => tune({ d: i }))}
              </>
            ) : (
              <p className="mt-4 text-sous text-brume">Avec la barbe, le nez, la bouche et les fossettes restent ceux de la figurine.</p>
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

      {titre('Fond du portrait')}
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

type ProfileProps = { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void; placeholder?: string; owned?: string[] }

function NameField({ name, setName, placeholder }: { name: string; setName: (v: string) => void; placeholder: string }) {
  const id = useId()
  return (
    <>
      <label htmlFor={id} className="mb-1.5 mt-5 block px-1 text-note font-semibold text-brume">{placeholder}</label>
      <input id={id} autoComplete="given-name" enterKeyHint="done" className="champ !bg-carte text-center font-rond text-titre3" placeholder={placeholder} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
    </>
  )
}

/** Choisir son personnage dans une fenêtre déjà ouverte (Famille) : l'aperçu, le prénom, puis tous les choix. */
export function ProfilePicker({ name, setName, avatar, setAvatar, color, setColor, placeholder = 'Ton prénom ou ton surnom', owned = [] }: ProfileProps) {
  const ed = usePerso(avatar, setAvatar)
  return (
    <>
      <Portrait ed={ed} color={color} />
      <NameField name={name} setName={setName} placeholder={placeholder} />
      <div className="mt-5">
        <PersoOptions ed={ed} color={color} setColor={setColor} owned={owned} />
      </div>
    </>
  )
}

/** Le premier écran du personnage : l'aperçu, le prénom, et les choix dans une fenêtre à part (l'aperçu y reste visible). */
export function ProfileStep({ name, setName, avatar, setAvatar, color, setColor, placeholder = 'Ton prénom ou ton surnom', owned = [] }: ProfileProps) {
  const ed = usePerso(avatar, setAvatar)
  const [open, setOpen] = useState(false)
  // la fenêtre s'ouvre par-dessus tout l'écran (data-feuilles), pas dans l'étape qui s'anime
  const here = useRef<HTMLDivElement>(null)
  const close = () => {
    setOpen(false)
    ed.setZoom(false)
  }
  const target = here.current?.closest<HTMLElement>('[data-feuilles]') ?? null
  return (
    <>
      <div ref={here}>
        <Portrait ed={ed} color={color} />
      </div>
      <NameField name={name} setName={setName} placeholder={placeholder} />
      <Btn kind="teinte" className="mt-3" onClick={() => setOpen(true)}>
        <Palette size={18} strokeWidth={2.4} /> Changer mon personnage
      </Btn>
      {open && target && createPortal(
        <Sheet title="Ton personnage" tall onClose={close} footer={<Btn onClick={close}>Terminer</Btn>}>
          <div className="sticky top-0 z-10 -mx-5 bg-fond px-5 pb-3" style={{ boxShadow: '0 10px 12px -12px rgba(29,26,43,0.25)' }}>
            <Portrait ed={ed} color={color} size={156} />
          </div>
          <div className="pt-2">
            <PersoOptions ed={ed} color={color} setColor={setColor} owned={owned} />
          </div>
        </Sheet>,
        target,
      )}
    </>
  )
}

export function HousePicker({ value, onChange }: { value: HouseType; onChange: (v: HouseType) => void }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2.5">
      {HOUSES.map((h) => (
        <button
          type="button"
          key={h.key}
          onClick={() => {
            select()
            onChange(h.key)
          }}
          aria-pressed={value === h.key}
          className={`presse relative overflow-hidden rounded-[20px] bg-carte pb-2.5 ${value === h.key ? 'ring-[2.5px] ring-inset ring-teinte' : ''}`}
        >
          <House type={h.key} items={[]} phase="jour" className="!aspect-[1/1]" bare />
          {value === h.key && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-teinte text-white shadow-carte" aria-hidden="true">
              <Check size={14} strokeWidth={3.2} />
            </span>
          )}
          <span className={`mt-2 block text-sous ${value === h.key ? 'font-semibold text-teinte-fonce' : 'font-medium'}`}>{h.label}</span>
          <span className="block px-1 text-note text-[#625A75]">{h.hint}</span>
        </button>
      ))}
    </div>
  )
}
