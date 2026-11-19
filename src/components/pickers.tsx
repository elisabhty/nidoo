import { Check, ChevronLeft, ChevronRight, Palette, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COLOR_KEYS, COLORS, HOUSES, shopItem } from '../lib/data'
import { select, tap } from '../lib/haptic'
import { ACCESSORIES, AGE_SCALE, echelleTaille, encodeLook, enlever, lookOf, mettre, porteA, portes, toutEnlever, type Look } from '../lib/look'
import { BLUSH, BOUCHES, CHEVEUX, labHex, LUNETTES, MONTURES, NEZ, nomPeau, peauOf, peauProche, peauxDe, persoImg, skinLab, VOILES, YEUX } from '../lib/personnalise'
import { COULEURS_MONTURE, FORMES_LUNETTES } from '../lib/lunettes'
import { accPlace, accTop, CH, CW, GROUPS, PERSOS, persoOf, type Group, type Perso } from '../lib/persos'
import { VISAGES } from '../lib/visages'
import type { HouseType } from '../lib/types'
import { Character } from './Character'
import House from './House'
import { Btn, Segments, Sheet, ChampRequis, CHAMP_REQUIS } from './ui'

/** L'état du personnage en cours de choix, partagé entre l'aperçu et les options (écran et fenêtre). */
function usePerso(avatar: string, setAvatar: (v: string) => void) {
  const look = lookOf(avatar)
  const mine = persoOf(look)
  const [group, setGroup] = useState<Group>(mine.g)
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
  }
  return { look, mine, group, setGroup, zoom, setZoom, set, tune, pick }
}
type Perso_ = ReturnType<typeof usePerso>

/** Le portrait : la figurine sur son fond. Un toucher alterne le zoom du visage et la vue entière. */
function Portrait({ ed, color, size = 206 }: { ed: Perso_; color: string; size?: number }) {
  const { look, mine, zoom } = ed
  const c = COLORS[color] ?? COLORS.lavande
  // Un seul personnage, en pied : le zoom l'agrandit en douceur vers son visage (une transformation animée),
  // au lieu de remplacer l'image par un portrait d'un coup.
  const R = CH / CW
  const [, , , , , bx0, by0, bs0] = mine.m
  const tete = porteA(look, 'T')
  const pl = tete ? accPlace(mine, tete) : null
  const at = pl ? accTop(pl) : 0
  // le cadre du visage (en largeurs de figurine), agrandi vers le haut si un chapeau dépasse
  let bx = bx0, by = by0 * R, bs = bs0
  if (pl && at < by0) {
    const extra = (by0 - at) * R + 4 / CW
    by -= extra
    bs += extra
    bx -= extra / 2
  }
  const over = pl ? Math.max(0, -at) : 0
  const wf = size * 0.54 * (AGE_SCALE[look.a] ?? 1) * echelleTaille(look)
  const he = wf * R * (1 + over)
  const left = (size - wf) / 2, top = size * 0.93 - he
  const ox = (bx + bs / 2) * wf, oy = (R * over + by + bs / 2) * wf
  const k = (size * 0.84) / (bs * wf)
  const transform = zoom ? `translate(${size / 2 - (left + ox)}px, ${size * 0.51 - (top + oy)}px) scale(${k})` : 'none'
  const doux = 'cubic-bezier(0.22, 0.8, 0.24, 1)'
  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-[5%] rounded-full" style={{ background: `radial-gradient(circle at 50% 35%, ${c.bg}, ${c.deep})` }} />
      <span className="absolute bottom-[6%] left-1/2 h-[6%] w-[40%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/15 blur-[3px] transition-opacity duration-300" style={{ opacity: zoom ? 0 : 1 }} />
      <button
        onClick={() => {
          tap()
          ed.setZoom(v => !v)
        }}
        className="absolute inset-0 block"
        // zoomé, le personnage est découpé dans le rond (le découpage s'anime avec lui)
        style={{ clipPath: zoom ? 'circle(42% at 50% 51%)' : 'circle(75% at 50% 50%)', transition: `clip-path 0.45s ${doux}` }}
        aria-label={`${zoom ? 'Voir le personnage en entier' : 'Zoomer sur le personnage'} : ${mine.label}`}
        aria-pressed={zoom}
      >
        <span
          className="absolute block"
          style={{ left, top, width: wf, transform, transformOrigin: `${ox}px ${oy}px`, transition: `transform 0.45s ${doux}, left 0.3s ${doux}, top 0.3s ${doux}, width 0.3s ${doux}` }}
        >
          <Character look={look} className="block h-auto w-full" />
        </span>
      </button>
      <button
        onClick={() => { tap(); ed.setZoom(v => !v) }}
        aria-label={zoom ? 'Voir le personnage en entier' : 'Zoomer sur le visage'}
        aria-pressed={zoom}
        className="presse verre absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full text-teinte-fonce shadow-carte"
      >
        {zoom ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
      </button>
    </div>
  )
}

/** Un réglage au curseur (1 à 9, milieu à 5), avec des mots plutôt que des chiffres. */
function Curseur({ label, gauche, droite, valeur, noms, onChange }: { label: string; gauche: string; droite: string; valeur: number; noms: string[]; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sous font-semibold text-encre">{label}</label>
        <span className="text-note font-semibold text-teinte-fonce">{noms[valeur - 1]}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={9}
        step={1}
        value={valeur}
        aria-valuetext={noms[valeur - 1]}
        onChange={(e) => {
          select()
          onChange(Number(e.target.value))
        }}
        className="curseur w-full"
        style={{ ['--plein' as string]: `${((valeur - 1) / 8) * 100}%` }}
      />
      <div className="mt-0.5 flex justify-between text-note text-brume">
        <span>{gauche}</span>
        <span>{droite}</span>
      </div>
    </div>
  )
}

/** Tout ce qu'on peut choisir : la figurine (par catégorie et couleur de peau), sa taille, les détails, le fond. */
function PersoOptions({ ed, color, setColor, owned = [] }: { ed: Perso_; color: string; setColor: (v: string) => void; owned?: string[] }) {
  const { look, mine, group, set, tune, pick } = ed
  const peaux = peauxDe(mine)
  const peau = peauOf(mine, look)
  const [section, setSection] = useState<'personnage'|'details'|'fond'>('personnage')
  const [tab, setTab] = useState<'cheveux' | 'visage' | 'lunettes' | 'maquillage'>('cheveux')
  const vis = VISAGES[mine.id]
  const chooseSkin = (q: number) => {
    set({q})
  }
  // La première sélection montre d’emblée plusieurs teints, générations et styles.
  // On trie la galerie sans déplacer PERSOS, dont les indices sont enregistrés dans les profils.
  const premieres: Record<Group, string[]> = {
    femme: ['f01', 'f14', 'f06', 'f04', 'gf2'],
    homme: ['h01', 'h03', 'h12', 'gm1', 'h06'],
    fille: ['fi1', 'fi3', 'fi5', 'fi6', 'fa2'],
    garcon: ['gi1', 'gi3', 'gi5', 'gi6', 'ga2'],
    bebe: ['b1', 'b3', 'b5', 'b2', 'b4'],
  }
  const priorite = (p: Perso) => {
    const i = premieres[group].indexOf(p.id)
    return i < 0 ? premieres[group].length : i
  }
  const list = PERSOS.filter((p) => p.g === group).sort((p, q) => priorite(p) - priorite(q) || Number(!!p.s) - Number(!!q.s) || p.t - q.t)
  const galerie = useRef<HTMLDivElement>(null)
  const galerieId = useId()
  const [restants, setRestants] = useState(Math.max(0, list.length - 5))
  const compter = () => {
    const el = galerie.current
    if (!el) return
    const bord = el.getBoundingClientRect().right
    let vus = 0
    Array.from(el.children).forEach((carte, i) => {
      if (carte.getBoundingClientRect().right <= bord + 1) vus = i + 1
    })
    setRestants(Math.max(0, list.length - vus))
  }
  useEffect(() => {
    const el = galerie.current
    if (!el) return
    el.scrollTo({ left: 0, behavior: 'instant' })
    compter()
    const ro = new ResizeObserver(compter)
    ro.observe(el)
    return () => ro.disconnect()
  }, [group, section]) // eslint-disable-line react-hooks/exhaustive-deps
  const avancer = () => {
    tap()
    const el = galerie.current
    if (!el) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    if (!restants) el.scrollTo({ left: 0, behavior })
    else el.scrollBy({ left: el.clientWidth + 4, behavior })
  }
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
          className={`presse flex h-11 items-center gap-1.5 rounded-full pl-1 pr-3 text-note font-semibold ${value === 0 ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
        >
          <span className="h-7 w-7 rounded-full" style={{ background: origin ?? 'transparent', boxShadow: 'inset 0 0 0 1px rgba(29,26,43,0.12)' }} />
          {originLabel}
        </button>
      )}
      {hexes.map((hex, i) => (
        <button key={labels[i]} onClick={() => onPick(i + 1)} aria-pressed={value === i + 1} aria-label={labels[i]} title={labels[i]} className="presse flex h-11 w-11 items-center justify-center rounded-full"><span className="h-8 w-8 rounded-full" style={{ background: hex, boxShadow: anneau(value === i + 1) }} /></button>
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
          className={`presse h-11 rounded-full px-3.5 text-sous font-semibold transition-colors ${value === i ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <div className="mb-4" role="tablist" aria-label="Personnaliser le personnage">
        <div className="flex rounded-full bg-remplissage p-1">
          {([['personnage','Personnage'],['details','Détails'],['fond','Fond']] as const).map(([key,label]) => <button key={key} role="tab" aria-selected={section === key} aria-controls={`perso-panel-${galerieId}`} onClick={() => { tap(); setSection(key); if (key === 'details') ed.setZoom(true) }} className={`presse min-h-11 flex-1 rounded-full px-3 text-sous font-semibold ${section === key ? 'bg-carte text-encre shadow-carte' : 'text-brume'}`}>{label}</button>)}
        </div>
      </div>
      <div id={`perso-panel-${galerieId}`} role="tabpanel" aria-label={section === 'personnage' ? 'Personnage' : section === 'details' ? 'Détails' : 'Fond'}>
      {section === 'personnage' && <>
      <Segments value={group} onChange={(g) => (select(), ed.setGroup(g))} options={GROUPS} />

      <div className="mb-2 mt-4 flex items-center justify-between px-1"><p className="text-sous font-semibold">Teint</p><span className="text-note text-brume">Aperçu en direct</span></div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Couleur de peau">
        {peaux.map(skin => <button key={skin.t} onClick={() => chooseSkin(skin.t)} aria-pressed={peau === skin.t} aria-label={`${nomPeau(skin.lab[0])}${skin.t === 0 ? ' · teint d’origine' : ''}`} className="presse flex h-11 w-11 items-center justify-center rounded-full"><span className="block h-8 w-8 rounded-full" style={{background:labHex(skin.lab),boxShadow:anneau(peau === skin.t)}} /></button>)}
      </div>
      <p className="mb-2 mt-4 px-1 text-sous font-semibold">Choisis ton personnage</p>
      <div className="mt-3 flex items-stretch gap-2">
        <div ref={galerie} id={galerieId} onScroll={compter} className="no-bar flex min-w-0 flex-1 snap-x snap-mandatory gap-0.5 overflow-x-auto p-1" role="group" aria-label="Galerie de personnages">
        {list.map((p) => {
          const on = p.id === mine.id
          const img = on ? persoImg(p, peau) : persoImg(p, 0)
          return (
            <button
              key={p.id}
              onClick={() => pick(p)}
              aria-pressed={on}
              aria-label={p.label}
              style={{ flexBasis: 'calc((100% - 8px) / 5)', minWidth: 44 }}
              className={`presse relative shrink-0 snap-start overflow-hidden rounded-[12px] px-0.5 pb-1 pt-2 transition-shadow ${on ? 'bg-teinte-doux ring-[2.5px] ring-inset ring-teinte' : 'bg-carte'}`}
            >
              <img src={img} alt="" loading="lazy" draggable={false} className="block aspect-[300/440] w-full select-none" />
              {on && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teinte text-white shadow-carte" aria-hidden="true">
                  <Check size={10} strokeWidth={3.2} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <button onClick={avancer} aria-controls={galerieId} className="presse flex w-[96px] shrink-0 items-center justify-center gap-1 rounded-[16px] bg-teinte-doux px-1.5 text-center text-[11px] font-semibold leading-[14px] text-teinte-fonce">
        {restants > 0 ? <><span>Voir les {restants}<br />autres personnages</span><ChevronRight size={16} className="perso-arrow shrink-0" aria-hidden="true" /></> : <><span>Revenir<br />au début</span><ChevronLeft size={16} className="shrink-0" aria-hidden="true" /></>}
      </button>
      </div>

      {titre('Taille et silhouette')}
      <div className="groupe space-y-4 px-4 pb-4 pt-3.5">
        <Curseur
          label="Taille"
          gauche="Plus petite"
          droite="Plus grande"
          valeur={look.G || 5}
          noms={['Toute petite', 'Petite', 'Plutôt petite', 'Un peu petite', 'Moyenne', 'Un peu grande', 'Plutôt grande', 'Grande', 'Très grande']}
          onChange={(v) => set({ G: v === 5 ? 0 : v })}
        />
        <Curseur
          label="Silhouette"
          gauche="Fine"
          droite="Tout en rondeur"
          valeur={look.L || 5}
          noms={['Très fine', 'Fine', 'Élancée', 'Un peu élancée', 'Équilibrée', 'Un peu ronde', 'Joliment ronde', 'Tout en rondeur', 'Bien en chair']}
          onChange={(v) => set({ L: v === 5 ? 0 : v })}
        />
      </div>

      </>}
      {section === 'details' && <>
      <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Détails du visage">
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
            className={`presse min-h-11 rounded-full px-1 text-note font-semibold transition-colors ${tab === k ? 'bg-encre text-white' : 'bg-carte text-encre'}`}
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
              // chaque chose a sa place : on en porte plusieurs à la fois ; « Rien » enlève tout
              const on = a ? portes(look).includes(a) : portes(look).length === 0
              return (
                <button
                  key={i}
                  onClick={() => set(a ? (on ? enlever(look, a) : mettre(look, a)) : toutEnlever(look))}
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

      </>}
      {section === 'fond' && <>
      <p className="mb-4 text-sous text-brume">Choisis la couleur derrière ton personnage.</p>
      <div className="flex flex-wrap gap-2.5 px-1">
        {COLOR_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => {
              select()
              setColor(k)
            }}
            aria-pressed={color === k}
            aria-label={`Fond ${NOMS_FONDS[k] ?? k}`}
            className="presse flex h-11 w-11 items-center justify-center rounded-full"
          ><span className="h-8 w-8 rounded-full" style={{ background: `linear-gradient(160deg, ${COLORS[k].bg}, ${COLORS[k].ring})`, boxShadow: color === k ? `0 0 0 2.5px #FFFFFF, 0 0 0 4.5px ${COLORS[k].ring}` : undefined }} /></button>
        ))}
      </div>
      </>}
      </div>
    </>
  )
}

type ProfileProps = { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void; placeholder?: string; owned?: string[] }

/** Ce que le prénom débloque, pour soi ou pour un enfant. */
const aidePrenom = (placeholder: string) => (placeholder.startsWith('Son') ? 'Écris son prénom pour pouvoir l’ajouter.' : 'Il apparaît sous ton personnage, pour toute la famille.')

function NameField({ name, setName, placeholder }: { name: string; setName: (v: string) => void; placeholder: string }) {
  const id = useId()
  return (
    <>
      <ChampRequis id={id} className="mt-5" label={placeholder} aide={aidePrenom(placeholder)}>
        <input id={id} required aria-describedby={`${id}-aide`} autoComplete="given-name" enterKeyHint="done" className={`${CHAMP_REQUIS} !h-[56px] text-center font-rond text-titre3`} placeholder={placeholder} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
      </ChampRequis>
    </>
  )
}

/** Choisir son personnage dans une fenêtre déjà ouverte (Famille) : l'aperçu, le prénom, puis tous les choix. */
/** Les noms des fonds de portrait, dits à VoiceOver avec leurs accents. */
const NOMS_FONDS: Record<string, string> = { peche: 'pêche', lavande: 'lavande', menthe: 'menthe', ciel: 'ciel', soleil: 'soleil', rose: 'rose', sauge: 'sauge', corail: 'corail' }

export function ProfilePicker({ name, setName, avatar, setAvatar, color, setColor, placeholder = 'Ton prénom ou ton surnom', owned = [] }: ProfileProps) {
  const ed = usePerso(avatar, setAvatar)
  const nameId = useId()
  return (
    <>
      <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-center gap-3 border-b border-trait bg-fond px-5 pb-4">
        <Portrait ed={ed} color={color} size={148} />
        <div className="min-w-0 flex-1">
          <ChampRequis id={nameId} compact label={placeholder.startsWith('Son') ? 'Son prénom' : 'Ton prénom'} aide={aidePrenom(placeholder)}>
            <input id={nameId} required aria-describedby={`${nameId}-aide`} autoComplete="given-name" enterKeyHint="done" className={`${CHAMP_REQUIS} font-rond text-titre3`} placeholder={placeholder} maxLength={24} value={name} onChange={e => setName(e.target.value)} />
          </ChampRequis>
        </div>
      </div>
      <div>
        <PersoOptions ed={ed} color={color} setColor={setColor} owned={owned} />
      </div>
    </>
  )
}

/** Le premier écran du personnage : l'aperçu, le prénom, et les choix dans une fenêtre à part (l'aperçu y reste visible). */
export function ProfileStep({ name, setName, avatar, setAvatar, color, setColor, placeholder = 'Ton prénom ou ton surnom', owned = [], sansNom = false }: ProfileProps & { sansNom?: boolean }) {
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
      {!sansNom && <NameField name={name} setName={setName} placeholder={placeholder} />}
      <Btn kind={sansNom ? 'blanc' : 'teinte'} className="mt-3" onClick={() => setOpen(true)}>
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
          className={`presse relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border-[2.5px] p-0 text-center transition-colors ${value === h.key ? 'border-teinte bg-[#F2ECFF]' : 'border-transparent bg-carte'}`}
        >
          <div className="w-full shrink-0 overflow-hidden"><House type={h.key} items={[]} phase="jour" className="!aspect-[1/1] !w-full" bare /></div>
          {value === h.key && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-teinte text-white shadow-carte" aria-hidden="true">
              <Check size={14} strokeWidth={3.2} />
            </span>
          )}
          <span className={`mt-2 block w-full px-1 text-sous ${value === h.key ? 'font-semibold text-teinte-fonce' : 'font-medium'}`}>{h.label}</span>
          <span className="block w-full flex-1 px-1 pb-3 text-note text-[#625A75]">{h.hint}</span>
        </button>
      ))}
    </div>
  )
}
