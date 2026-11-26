// Les deux pages de l'accueil qui montrent l'iPhone (Elisa, 21 novembre : « une page sur les notifications »,
// « une page sur comment mettre les widgets et les types des différents widgets ») : un écran verrouillé où les
// notifications arrivent une à une, et un écran d'accueil où chaque widget se touche pour de vrai.
import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { select, success, tap } from '../lib/haptic'
import { coeurs, confettis, petille } from '../lib/fete'

const art = (n: string) => `./art/stickers/${n}.webp`

/** Une tête de personnage, recadrée dans la figurine entière. */
function Tete({ id, size }: { id: string; size: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded-full bg-[#EEE8FC]" style={{ width: size, height: size }}>
      <img src={`./art/persos/${id}.webp`} alt="" className="block max-w-none" style={{ width: size * 1.56, marginLeft: -size * 0.28, marginTop: -size * 0.04 }} />
    </span>
  )
}

/* ------------------------------------------------------------------ Notifications */

const NOTIFS = [
  { texte: 'Mamie Jo t’a envoyé un bisou 💗', quand: 'maintenant', tete: 'gf1' },
  { texte: 'Anniversaire de Léo dans 3 jours 🎂', quand: '9:00', tete: 'gi3' },
  { texte: 'Papa a joué au Morpion. À toi ! 🎲', quand: 'hier', tete: 'h02' },
]

/** L'écran verrouillé : l'heure, puis les notifications qui glissent une à une (et qu'on peut toucher). */
export function EcranNotifications({ active }: { active: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(t)
  }, [])
  const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const j = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const jour = j.charAt(0).toUpperCase() + j.slice(1)
  return (
    <div className="notif-ecran relative mx-auto mt-5 w-full max-w-[360px] overflow-hidden rounded-[30px] px-3.5 pb-4 pt-5">
      <p className="text-center text-[13px] font-bold text-white/80">{jour}</p>
      <p className="text-center font-rond text-[52px] font-extrabold leading-[56px] tracking-[-1px] text-white">{heure}</p>
      <div className="mt-4 grid gap-2">
        {NOTIFS.map((n, i) => (
          <button
            key={n.texte}
            type="button"
            className="notif-arrive presse flex items-center gap-2.5 rounded-[18px] bg-white/[0.93] px-3 py-2.5 text-left text-encre shadow-[0_6px_18px_-8px_rgba(30,10,90,0.6)]"
            style={{ animationDelay: `${0.35 + i * 0.6}s` }}
            onClick={(e) => (tap(), coeurs(e.currentTarget, 6))}
          >
            <span className="relative shrink-0">
              <img src="./panda.webp" alt="" className="h-9 w-9 rounded-[9px]" />
              <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-white"><Tete id={n.tete} size={18} /></span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2 text-[12.5px] font-extrabold uppercase tracking-[0.02em] text-[#625A75]">
                NIDOO <span className="text-[11px] font-semibold normal-case tracking-normal text-brume">{n.quand}</span>
              </span>
              <span className="block text-[14px] font-bold leading-[18px]">{n.texte}</span>
            </span>
          </button>
        ))}
      </div>
      {active && (
        <span className="anim-pop absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[#6FD3A8] px-2.5 py-1 text-[12px] font-extrabold text-[#0B3B27]">
          <Check size={13} strokeWidth={3.4} /> Activées
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Widgets */

type Famille = 'tendresse' | 'organisation' | 'jeux'
export const FAMILLES_WIDGETS: { key: Famille; label: string; noms: string[] }[] = [
  { key: 'tendresse', label: '💗 Tendresse', noms: ['Notre maison', 'Bisou express', 'Attentions', 'Ma famille', 'Mon humeur'] },
  { key: 'organisation', label: '📅 Organisation', noms: ['Prochaines dates', 'À faire', 'Sondage', 'Le mur de la famille'] },
  { key: 'jeux', label: '🎲 Jeux', noms: ['Morpion', 'Puissance 4', 'Memory des animaux', 'Notre compagnon'] },
]

const carte = 'relative overflow-hidden rounded-[22px] bg-white text-encre shadow-[0_8px_20px_-10px_rgba(30,10,90,0.55)]'

function BisouExpress() {
  const [envoye, setEnvoye] = useState(false)
  return (
    <button
      type="button"
      className={`${carte} presse flex aspect-square flex-col items-center justify-center gap-1 p-2`}
      aria-label="Bisou express : envoyer un bisou à Mamie"
      onClick={(e) => {
        success()
        coeurs(e.currentTarget, 10)
        setEnvoye(true)
        window.setTimeout(() => setEnvoye(false), 1600)
      }}
    >
      <span className="absolute left-2.5 top-2 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#D23F72]">Bisou</span>
      <span className={envoye ? 'widget-boing' : ''}><Tete id="gf1" size={50} /></span>
      <span className="text-[12px] font-extrabold">Mamie Jo</span>
      <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold transition-colors ${envoye ? 'bg-[#6FD3A8] text-[#0B3B27]' : 'bg-[#FFE6EE] text-[#D23F72]'}`}>{envoye ? 'Envoyé ✓' : '💋 Un bisou'}</span>
    </button>
  )
}

function Attentions() {
  const [dernier, setDernier] = useState<string | null>(null)
  const gestes = [
    { e: '💗', n: 'un cœur' },
    { e: '🤗', n: 'un câlin' },
    { e: '😘', n: 'un bisou' },
    { e: '☀️', n: 'du soleil' },
  ]
  return (
    <div className={`${carte} col-span-2 flex items-center gap-3 p-3`}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-teinte-fonce">Attentions</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Tete id="h02" size={38} />
          <p className="min-w-0 text-[12.5px] font-bold leading-[15px]">{dernier ? <>Tu as envoyé {dernier} à Papa</> : <>Papa t’a fait un câlin 🤗</>}</p>
        </div>
        <p className="mt-1 text-[10.5px] font-semibold text-brume">{dernier ? 'à l’instant' : 'il y a 2 min'}</p>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-1.5">
        {gestes.map((g) => (
          <button
            key={g.e}
            type="button"
            aria-label={`Répondre avec ${g.n}`}
            className="presse flex h-10 w-10 items-center justify-center rounded-full bg-[#F3EEFF] text-[19px]"
            onClick={(e) => (select(), coeurs(e.currentTarget, 6), setDernier(g.n))}
          >
            {g.e}
          </button>
        ))}
      </div>
    </div>
  )
}

const DATES = [
  { art: 'gateau', titre: 'Anniversaire de Léo', dans: 'J-3' },
  { art: 'cafe', titre: 'Repas chez Mamie', dans: 'Dim.' },
  { art: 'avion', titre: 'Les vacances !', dans: 'J-24' },
]
function ProchainesDates() {
  const [i, setI] = useState(0)
  const d = DATES[i]
  return (
    <button
      type="button"
      className={`${carte} presse flex aspect-square flex-col justify-between p-2.5 text-left`}
      aria-label={`Prochaines dates : ${d.titre}, ${d.dans}. Toucher pour la suivante`}
      onClick={(e) => (select(), petille(e.currentTarget), setI((i + 1) % DATES.length))}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#E26F3C]">Dates</span>
      <span key={i} className="anim-pop flex items-center gap-1.5">
        <img src={art(d.art)} alt="" className="h-11 w-11" />
        <span className="font-rond text-[26px] font-extrabold leading-none text-[#E26F3C]">{d.dans}</span>
      </span>
      <span key={`t${i}`} className="anim-entre text-[12.5px] font-extrabold leading-[15px]">{d.titre}</span>
    </button>
  )
}

function AFaire() {
  const [fait, setFait] = useState<boolean[]>([false, true, false])
  const taches = ['Acheter le gâteau', 'Appeler Mamie', 'Réserver le resto']
  return (
    <div className={`${carte} col-span-2 p-3`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#15803D]">À faire · {fait.filter((f) => !f).length || 'plus rien'}</p>
      <div className="mt-1.5 grid gap-1">
        {taches.map((t, i) => (
          <button
            key={t}
            type="button"
            aria-pressed={fait[i]}
            className="presse flex min-h-[30px] items-center gap-2 text-left text-[13px] font-bold"
            onClick={(e) => {
              select()
              const n = fait.map((f, j) => (j === i ? !f : f))
              setFait(n)
              if (!fait[i]) petille(e.currentTarget.firstElementChild)
              if (n.every(Boolean)) (success(), confettis())
            }}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${fait[i] ? 'bg-[#15803D] text-white' : 'ring-2 ring-inset ring-[#C9C2DD]'}`}>{fait[i] && <Check size={12} strokeWidth={3.6} className="anim-pop" />}</span>
            <span className={`transition-colors ${fait[i] ? 'text-brume line-through' : ''}`}>{t}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const LIGNES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const gagnant = (g: string[]) => LIGNES.find(([a, b, c]) => g[a] && g[a] === g[b] && g[a] === g[c])
function Morpion() {
  const [g, setG] = useState<string[]>(Array(9).fill(''))
  const [fin, setFin] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const jouer = (i: number) => {
    if (g[i] || fin) return
    tap()
    const a = g.slice()
    a[i] = '✕'
    if (gagnant(a)) return (setG(a), setFin('Gagné ! 🎉'), success(), confettis())
    const libres = a.map((x, j) => (x ? -1 : j)).filter((j) => j >= 0)
    if (!libres.length) return (setG(a), setFin('Égalité'))
    setG(a)
    window.setTimeout(() => {
      const b = a.slice()
      b[libres[Math.floor(Math.random() * libres.length)]] = '◯'
      setG(b)
      if (gagnant(b)) setFin('Papa gagne 😄')
      else if (b.every(Boolean)) setFin('Égalité')
    }, 420)
  }
  return (
    <div ref={box} className={`${carte} flex aspect-square flex-col p-2`}>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#2F6FD6]">{fin || 'Morpion'}</span>
        {fin && (
          <button type="button" aria-label="Rejouer" className="presse -m-1 flex h-7 w-7 items-center justify-center text-[#2F6FD6]" onClick={() => (tap(), setG(Array(9).fill('')), setFin(''))}>
            <RotateCcw size={14} strokeWidth={2.8} />
          </button>
        )}
      </div>
      <div className="mt-1 grid flex-1 grid-cols-3 gap-1">
        {g.map((x, i) => (
          <button key={i} type="button" aria-label={x ? `Case ${i + 1} : ${x === '✕' ? 'toi' : 'Papa'}` : `Jouer case ${i + 1}`} onClick={() => jouer(i)} className={`flex items-center justify-center rounded-[8px] bg-[#EEF4FF] text-[17px] font-black ${x === '✕' ? 'text-[#2F6FD6]' : 'text-[#E26F3C]'}`}>
            {x && <span className="anim-pop">{x}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Compagnon() {
  const [faim, setFaim] = useState(35)
  const [content, setContent] = useState(false)
  return (
    <div className={`${carte} col-span-2 flex items-center gap-3 p-3`}>
      <img src={art(content ? 'emo-amoureux' : 'chat')} alt="" className={`h-[74px] w-[74px] shrink-0 ${content ? 'widget-boing' : ''}`} key={String(content)} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#B07A00]">Notre compagnon</p>
        <p className="mt-0.5 text-[13px] font-extrabold">{content ? 'Moka ronronne 💛' : 'Moka a un petit creux'}</p>
        <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[#F3EEE0]"><span className="block h-full rounded-full bg-[#FFC94D] transition-[width] duration-500" style={{ width: `${faim}%` }} /></span>
        <button
          type="button"
          className="presse mt-2 rounded-full bg-[#FFF4D6] px-3 py-1.5 text-[12px] font-extrabold text-[#8A5A00]"
          onClick={(e) => {
            success()
            coeurs(e.currentTarget, 7)
            setFaim((f) => Math.min(100, f + 33))
            setContent(true)
            window.setTimeout(() => setContent(false), 1800)
          }}
        >
          🐟 Une friandise
        </button>
      </div>
    </div>
  )
}

const ICONES = [
  { fond: 'linear-gradient(160deg,#7BE3A4,#2FB36A)', e: '📞' },
  { fond: 'linear-gradient(160deg,#FFE08A,#FFB020)', e: '📷' },
  { fond: 'linear-gradient(160deg,#9BC8FF,#4C8DF6)', e: '☁️' },
  { fond: 'linear-gradient(160deg,#FFB3C7,#F2557F)', e: '🎵' },
]

/** L'écran d'accueil de l'iPhone avec les widgets d'une famille ; chacun se touche pour l'essayer. */
export function EcranWidgets() {
  const [famille, setFamille] = useState<Famille>('tendresse')
  const f = FAMILLES_WIDGETS.find((x) => x.key === famille)!
  return (
    <>
      <div className="mt-5 flex justify-center gap-1.5" role="group" aria-label="Les familles de widgets">
        {FAMILLES_WIDGETS.map((x) => (
          <button key={x.key} type="button" className="ob-puce !min-h-[40px] !px-3 !text-[14px]" aria-pressed={famille === x.key} onClick={() => (select(), setFamille(x.key))}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="ecran-accueil mx-auto mt-3 w-full max-w-[360px] rounded-[30px] p-3.5">
        <div key={famille} className="anim-entre grid grid-cols-2 gap-3">
          {famille === 'tendresse' && <BisouExpress />}
          {famille === 'organisation' && <ProchainesDates />}
          {famille === 'jeux' && <Morpion />}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-1.5" aria-hidden="true">
            {ICONES.map((i) => (
              <span key={i.e} className="flex aspect-square items-center justify-center rounded-[14px] text-[22px] shadow-[0_4px_10px_-4px_rgba(30,10,90,0.5)]" style={{ background: i.fond }}>{i.e}</span>
            ))}
          </div>
          {famille === 'tendresse' && <Attentions />}
          {famille === 'organisation' && <AFaire />}
          {famille === 'jeux' && <Compagnon />}
        </div>
      </div>
      <p className="mt-3 text-center text-note font-semibold text-white/80">Dans cette famille : {f.noms.join(' · ')}</p>
    </>
  )
}

/** Comment poser un widget, en trois gestes. */
export function CommentAjouter() {
  const etapes = [
    { n: 1, t: 'Appuie longuement sur un espace vide de l’écran d’accueil, jusqu’à ce que les icônes bougent.' },
    { n: 2, t: 'Touche « Modifier » en haut de l’écran, puis « Ajouter un widget ».' },
    { n: 3, t: 'Cherche « NIDOO », choisis un widget et sa taille, puis touche « Ajouter le widget ».' },
  ]
  return (
    <div className="mt-5 rounded-[22px] bg-white/[0.12] p-4 ring-[1.5px] ring-inset ring-white/25">
      <p className="text-sous font-extrabold">Pour en poser un</p>
      <ol className="mt-3 grid gap-3">
        {etapes.map((e) => (
          <li key={e.n} className="ob-etape flex gap-3" style={{ animationDelay: `${0.1 + e.n * 0.08}s` }}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFC94D] text-[14px] font-black text-[#3B2A00]">{e.n}</span>
            <span className="text-[15px] font-semibold leading-[20px] text-white/95">{e.t}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-note font-semibold text-white/75">Astuce : « Bisou express » se pose aussi sur l’écran verrouillé, et dans le centre de contrôle.</p>
    </div>
  )
}
