import { BedDouble, BookOpen, Carrot, Check, ChevronRight, Compass, Dices, Drama, Feather, Flower2, Frown, Heart, HeartHandshake, Leaf, Lightbulb, Lock, Moon, Mountain, PawPrint, PenLine, Search, Shield, Snowflake, Sprout, Star, Users, Volume2, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CARACTERES, FOOD, LOVE, nextStage, PET_COST, petStage, PRENOMS_SURPRISE, SHOP, shopItem, SPECIES, type Shop } from '../lib/data'
import { select, success, tap, warn } from '../lib/haptic'
import { confettis } from '../lib/fete'
import { rebond } from '../lib/rebond'
import { jouer, precharger, sonCompagnon } from '../lib/sons'
import { useHome } from '../lib/store'
import type { Pet } from '../lib/types'
import { todayKey } from '../lib/util'
import { animalMood, BagIcon, CareIcon, HandIcon, hungerOf, pettedToday, useCare, usePet } from './care'
import { PetFigure } from './pet'
import { Art, Btn, Page } from './ui'

// Le compagnon de la famille : on le choisit parmi huit animaux, on lui donne un prénom,
// et il grandit avec l'amour qu'on lui donne (bébé, puis jeune, puis adulte).

type Effect = { id: number; kind: 'repas' | 'caresse' | 'friandise' | 'jeu'; love: number; stars: number; toy?: string }

export function CompagnonPage({ onClose, onShop }: { onClose: () => void; onShop: (shop: Shop) => void }) {
  const { state } = useHome()
  // le moment de l'adoption : « Bienvenue dans la famille ! » (Elisa, 21 novembre)
  const [bienvenue, setBienvenue] = useState<{ species: string; name: string } | null>(null)
  return (
    <>
      <Page title={state.pet ? state.pet.name : 'Notre petit compagnon'} onClose={onClose} trailing={<StarsPill />} scrollKey={state.pet ? 'compagnon' : 'adoption'}>
        {state.pet ? <PetView pet={state.pet} onShop={onShop} /> : <Adopt onAdopte={setBienvenue} />}
      </Page>
      {bienvenue && <Bienvenue {...bienvenue} onMaison={onClose} onRester={() => setBienvenue(null)} />}
    </>
  )
}

export function StarsPill() {
  const { state } = useHome()
  return (
    <span className="verre flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold" aria-label={`${state.family.stars} étoiles`}>
      <Art name="picto-etoile" size={24} /> {state.family.stars}
    </span>
  )
}

// ───────── Choisir son compagnon ─────────

const ICONES_TRAITS: Record<string, LucideIcon> = {
  Joueur: PawPrint, Curieux: Search, Câlin: Heart, Loyal: Heart, Énergique: Zap, Protecteur: Shield, Paisible: Leaf, Affectueux: Heart, Gourmand: Carrot,
  Intelligent: Lightbulb, Aventurier: Compass, Créatif: Star, Serein: Leaf, Bienveillant: HeartHandshake, Positif: Sprout, Tranquille: Moon, Doux: Feather,
  Dormeur: BedDouble, Explorateur: Compass, Sociable: Users, Patient: Snowflake, Conseiller: BookOpen,
}
const ICONES_TITRES: Record<string, LucideIcon> = { chat: Search, chien: Heart, lapin: Leaf, renard: Drama, panda: Flower2, koala: Heart, pingouin: Mountain, hibou: BookOpen }

/** Un petit saut avec un mouvement de tête (Web Animations : fluide, sans recréer l'image). */
function sautille(el: Element | null | undefined) {
  if (!el || typeof (el as HTMLElement).animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  ;(el as HTMLElement).animate(
    [
      { transform: 'translateY(0) rotate(0deg) scale(1)' },
      { transform: 'translateY(2px) rotate(0deg) scale(1.05, 0.94)', offset: 0.12 },
      { transform: 'translateY(-16px) rotate(-7deg) scale(0.97, 1.04)', offset: 0.38 },
      { transform: 'translateY(0) rotate(5deg) scale(1.04, 0.96)', offset: 0.64 },
      { transform: 'translateY(-4px) rotate(-3deg) scale(1)', offset: 0.8 },
      { transform: 'translateY(0) rotate(0deg) scale(1)' },
    ],
    { duration: 720, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  )
}

function Adopt({ onAdopte }: { onAdopte: (x: { species: string; name: string }) => void }) {
  const { state, run } = useHome()
  const [species, setSpecies] = useState('chat')
  const [name, setName] = useState('')
  const sp = SPECIES.find((x) => x.key === species)!
  const c = CARACTERES[species]
  const missing = PET_COST - state.family.stars
  const shown = name.trim() || sp.names[0]
  const figure = useRef<HTMLSpanElement>(null)
  const TitreIcone = ICONES_TITRES[species] ?? Heart
  // leurs petits cris, prêts à partir dès le premier toucher
  useEffect(() => precharger(...SPECIES.map((x) => sonCompagnon(x.key))), [])

  const choisir = (key: string, el: Element) => {
    tap()
    jouer(sonCompagnon(key))
    rebond(el.querySelector('[data-figure]'), 1)
    setSpecies(key)
    window.requestAnimationFrame(() => sautille(figure.current))
  }
  const surprise = () => {
    select()
    const pris = new Set([shown, ...sp.names])
    const libres = PRENOMS_SURPRISE.filter((n) => !pris.has(n))
    setName(libres[Math.floor(Math.random() * libres.length)])
  }

  return (
    <div className="px-4">
      <p className="-mt-1 px-1 text-sous text-brume">Adoptez ensemble un petit compagnon qui grandira à vos côtés !</p>

      {/* son caractère, en grand : on sait tout de suite qui on adopte */}
      <section className="relative mt-4 overflow-hidden rounded-[26px] p-4 pb-3.5 transition-colors duration-300" style={{ background: `linear-gradient(165deg, ${c.fond} 0%, #FFFFFF 135%)` }} aria-live="polite">
        <button
          type="button"
          onClick={() => {
            tap()
            jouer(sonCompagnon(species))
            sautille(figure.current)
          }}
          className="presse absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80"
          style={{ color: c.encre }}
          aria-label={`Écouter le ${sp.name.toLowerCase()}`}
        >
          <Volume2 size={18} strokeWidth={2.4} />
        </button>
        <div className="flex items-center gap-3.5">
          <span ref={figure} className="block w-[104px] shrink-0" style={{ transformOrigin: '50% 100%' }}>
            <PetFigure pet={{ species, outfit: null }} className="w-full" />
          </span>
          <div className="min-w-0 flex-1 pr-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-note font-bold" style={{ color: c.encre }}>
              <TitreIcone size={14} strokeWidth={2.6} /> {c.titre}
            </span>
            <p key={`${species}-${shown}`} className="anim-entre mt-1.5 font-rond text-titre3 leading-tight text-encre">
              {shown} est très {c.adjectif}
            </p>
            <p className="mt-1 text-note text-encre/75">{c.texte}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.traits.map((t, i) => {
            const I = ICONES_TRAITS[t] ?? Star
            return (
              <span key={`${species}-${t}`} className="ligne-arrive-pop inline-flex items-center gap-1.5 rounded-full bg-white/85 py-1 pl-2 pr-3 text-note font-semibold text-encre" style={{ animationDelay: `${i * 60}ms` }}>
                <I size={14} strokeWidth={2.5} style={{ color: c.encre }} /> {t}
              </span>
            )
          })}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {SPECIES.map((x) => {
          const on = x.key === species
          return (
            <button
              key={x.key}
              onClick={(e) => choisir(x.key, e.currentTarget)}
              aria-pressed={on}
              className={`presse flex flex-col items-center rounded-[20px] px-1 pb-2 pt-2.5 transition-shadow ${on ? 'bg-teinte-doux ring-[2.5px] ring-teinte' : 'bg-carte shadow-carte'}`}
            >
              <span data-figure className="block w-[60px]">
                <PetFigure pet={{ species: x.key, outfit: null }} className="w-full" />
              </span>
              <span className={`mt-1 text-legende ${on ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>{x.name}</span>
            </button>
          )
        })}
      </div>

      <p className="entete mt-5 !px-1">Son prénom</p>
      <input className="champ" placeholder={sp.names[0]} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} aria-label="Son prénom" />
      <div className="mt-2 flex flex-wrap gap-2">
        {sp.names.map((n) => (
          <button
            key={n}
            onClick={() => {
              tap()
              setName(n)
            }}
            className={`presse h-8 rounded-full px-3 text-sous font-medium ${shown === n ? 'bg-encre text-white' : 'bg-carte text-encre shadow-carte'}`}
          >
            {n}
          </button>
        ))}
        <button onClick={surprise} className="presse flex h-8 items-center gap-1.5 rounded-full bg-teinte-doux px-3 text-sous font-semibold text-teinte-fonce">
          <Dices size={16} strokeWidth={2.4} /> Surprise
        </button>
      </div>

      <div className="groupe mt-5">
        <Row icon={<Heart size={22} className="text-[#E77BA0]" fill="#E77BA0" />} text="Nourrissez-le, câlinez-le et jouez avec lui pour le faire grandir." />
        <Row
          icon={<BagIcon size={26} />}
          text={
            state.family.food ? (
              `Un repas par jour. Il reste ${state.family.food} repas à la maison.`
            ) : (
              <>
                Un repas par jour : {FOOD.meals} repas pour {FOOD.cost} <Art name="picto-etoile" size={16} className="inline-block -translate-y-px" />
              </>
            )
          }
        />
        <Row icon={<Art name="lit-panier" size={28} />} text="Décorez son petit coin et offrez-lui des accessoires." last />
      </div>

      <Btn
        className="mt-5"
        disabled={missing > 0}
        onClick={async () => {
          const nom = shown
          if (await run((api) => api.adoptPet(state.family.id, species, nom))) {
            success()
            onAdopte({ species, name: nom })
          }
        }}
      >
        {missing > 0 ? (
          <>
            <Lock size={16} strokeWidth={2.6} /> Encore {missing} étoile{missing > 1 ? 's' : ''} pour l’adopter
          </>
        ) : (
          <>
            Adopter {shown} · {PET_COST} <Art name="picto-etoile" size={20} />
          </>
        )}
      </Btn>
    </div>
  )
}

function Row({ icon, text, last }: { icon: ReactNode; text: ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-trait'}`}>
      <span className="flex w-8 shrink-0 justify-center">{icon}</span>
      <p className="min-w-0 flex-1 text-sous">{text}</p>
    </div>
  )
}

/** « Bienvenue dans la famille ! » : il arrive dans le jardin en sautillant, pousse son petit cri, et des confettis. */
function Bienvenue({ species, name, onMaison, onRester }: { species: string; name: string; onMaison: () => void; onRester: () => void }) {
  const c = CARACTERES[species] ?? CARACTERES.chat
  useEffect(() => {
    const t1 = window.setTimeout(() => jouer(sonCompagnon(species)), 1250)
    const t2 = window.setTimeout(() => {
      success()
      confettis()
    }, 1350)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [species])
  return (
    <div className="anim-fondu absolute inset-0 z-[45] flex flex-col" role="dialog" aria-modal="true" aria-label={`Bienvenue dans la famille, ${name} !`} style={{ background: 'linear-gradient(180deg, #D9ECFF 0%, #F1F7FF 52%, #CFEAC0 52.4%, #B5DCA0 100%)' }}>
      <span className="absolute left-[8%] top-[14%] h-[44px] w-[110px] rounded-full bg-white/70 blur-[7px]" />
      <span className="absolute right-[10%] top-[24%] h-[32px] w-[80px] rounded-full bg-white/60 blur-[7px]" />
      <div className="relative flex flex-1 flex-col items-center justify-end pb-[6%]">
        <span className="absolute bottom-[calc(6%-6px)] left-1/2 h-[18px] w-[150px] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/15 blur-[5px]" style={{ animation: 'arriveOmbre 1.3s ease-out both' }} />
        <span className="block w-[46%] max-w-[210px]" style={{ animation: 'arriveCompagnon 1.3s cubic-bezier(0.3, 0.6, 0.4, 1) both', transformOrigin: '50% 100%' }}>
          <PetFigure pet={{ species, outfit: null }} className="w-full" />
        </span>
      </div>
      <div className="relative rounded-t-[30px] bg-fond px-6 pb-[calc(var(--sab)+18px)] pt-6 text-center" style={{ animation: 'monte 0.5s var(--ressort) 0.9s both' }}>
        <p className="font-rond text-titre1 leading-tight">Bienvenue dans la famille, {name} ! 🐾</p>
        <p className="mt-2 text-sous text-brume">
          {name} est très {c.adjectif}. Il s’installe dans votre jardin : nourrissez-le, câlinez-le et jouez avec lui pour le faire grandir.
        </p>
        <Btn className="mt-5" onClick={onMaison}>
          Découvrir sa nouvelle maison
        </Btn>
        <button type="button" onClick={onRester} className="presse mt-2 min-h-11 w-full text-sous font-semibold text-teinte-fonce">
          Faire connaissance
        </button>
      </div>
    </div>
  )
}

// ───────── Le compagnon au quotidien ─────────

function PetView({ pet, onShop }: { pet: Pet; onShop: (shop: Shop) => void }) {
  const { state, api, run, reload, toast } = useHome()
  const { family, cares, stock, owned, starLog, me } = state
  const [fx, setFx] = useState<Effect[]>([])
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(pet.name)
  const care = useCare(() => onShop('superette'))
  const stroke = usePet()
  const stage = petStage(pet.love)
  const next = nextStage(pet.love)
  const fed = cares.some((c) => c.item_key === 'compagnon' && c.day === todayKey())
  const petted = pettedToday(starLog, me.id)
  const played = starLog.some((s) => s.reason === 'jeu' && s.member_id === me.id && todayKey(new Date(s.created_at)) === todayKey())
  const mood = animalMood(hungerOf('compagnon', cares, state.houseSince))
  const toys = SHOP.filter((i) => i.key.startsWith('jeu:') && owned.includes(i.key))
  const outfits = SHOP.filter((i) => i.key.startsWith('habit:') && owned.includes(i.key))
  const beds = SHOP.filter((i) => i.key.startsWith('lit:') && owned.includes(i.key))
  const treats = stock.friandises ?? 0
  const gold = owned.includes('gamelle:or')

  // Il grandit d'un stade : une petite fête.
  const [grown, setGrown] = useState<string | null>(null)
  const [lastStage, setLastStage] = useState(stage.key)
  useEffect(() => {
    if (stage.key !== lastStage) {
      if (PETSTAGE_ORDER.indexOf(stage.key) > PETSTAGE_ORDER.indexOf(lastStage)) {
        success()
        jouer('etoiles')
        setGrown(stage.label)
        window.setTimeout(() => setGrown(null), 3200)
      }
      setLastStage(stage.key)
    }
  }, [stage.key, lastStage, stage.label])

  const play = (e: Omit<Effect, 'id'>) => setFx((all) => [...all, { ...e, id: Date.now() + Math.random() }])
  const feed = () => {
    if (fed) {
      toast(`${pet.name} a déjà mangé aujourd’hui.`)
      return
    }
    if (family.food <= 0) {
      warn()
      toast('Plus de croquettes : il y en a à la supérette.', 'err')
      onShop('superette')
      return
    }
    play({ kind: 'repas', love: LOVE.feed, stars: 3 })
    care('compagnon')
  }
  const caress = async () => {
    tap()
    jouer(sonCompagnon(pet.species))
    const id = Date.now()
    setFx((all) => [...all, { id, kind: 'caresse', love: 0, stars: 0 }])
    const n = await stroke('compagnon')
    if (n) setFx((all) => all.map((x) => (x.id === id ? { ...x, love: LOVE.pet, stars: n } : x)))
  }
  const treat = async () => {
    if (!treats) {
      onShop('superette')
      return
    }
    tap()
    jouer('croquettes')
    window.setTimeout(() => jouer(sonCompagnon(pet.species), 0.8), 900)
    play({ kind: 'friandise', love: LOVE.treat, stars: 0 })
    await run((a) => a.giveTreat(family.id))
  }
  const playWith = async (toy: string) => {
    tap()
    jouer('jouet')
    window.setTimeout(() => jouer(sonCompagnon(pet.species), 0.8), 700)
    const id = Date.now()
    setFx((all) => [...all, { id, kind: 'jeu', love: 0, stars: 0, toy }])
    try {
      const n = await api.playPet(family.id, toy)
      if (n) {
        await reload()
        setFx((all) => all.map((x) => (x.id === id ? { ...x, love: LOVE.play, stars: n } : x)))
      }
    } catch {
      /* l'animation suffit */
    }
  }
  const dress = (patch: Partial<{ outfit: string | null; bed: string | null; name: string }>) => {
    tap()
    void run((a) => a.dressPet(family.id, { outfit: pet.outfit, bed: pet.bed, name: pet.name, ...patch }))
  }

  return (
    <div className="px-4">
      {/* la scène : il vit, on voit l'effet de chaque geste */}
      <div className="relative mt-1 h-[268px] overflow-hidden rounded-[28px] shadow-carte" style={{ background: 'linear-gradient(180deg, #D9ECFF 0%, #F1F7FF 54%, #CFEAC0 54.4%, #BBDFA6 100%)' }}>
        <span className="absolute left-[8%] top-[10%] h-[40px] w-[96px] rounded-full bg-white/70 blur-[6px]" />
        <span className="absolute right-[10%] top-[18%] h-[30px] w-[70px] rounded-full bg-white/60 blur-[6px]" />
        {/* chacun a son ombre douce sur l'herbe (les images n'en portent plus : elle y était dessinée en gris clair,
            et faisait une tache blanche sous l'animal) */}
        {pet.bed && (
          <span className="absolute bottom-[10%] left-[6%] block w-[30%]">
            <span aria-hidden className="absolute inset-x-[6%] bottom-[1%] block h-[9%] rounded-[50%] bg-[#35612B]/30 blur-[5px]" />
            <img src={`./art/${pet.bed.replace(':', '-')}.webp`} alt="" className="relative block w-full" />
          </span>
        )}
        {gold && (
          <span className="absolute bottom-[8%] right-[8%] block w-[16%]">
            <span aria-hidden className="absolute inset-x-[4%] bottom-[1%] block h-[10%] rounded-[50%] bg-[#35612B]/30 blur-[4px]" />
            <img src="./art/shop-gamelle.webp" alt="" className="relative block w-full" />
          </span>
        )}
        <button
          onClick={() => void caress()}
          className="absolute bottom-[8%] left-1/2 block -translate-x-1/2 transition-[width] duration-700"
          style={{ width: `${46 * stage.scale}%` }}
          aria-label={`Caresser ${pet.name}`}
        >
          <span aria-hidden className="absolute inset-x-[14%] bottom-[0.5%] block h-[8%] rounded-[50%] bg-[#35612B]/30 blur-[6px]" />
          <PetFigure
            pet={pet}
            className="w-full"
            style={{ animation: mood === 'bien' ? 'respire 3s ease-in-out infinite' : undefined, transformOrigin: '50% 100%' }}
            filter={mood === 'deprime' ? 'grayscale(0.75) brightness(0.92)' : mood === 'triste' ? 'saturate(0.5)' : undefined}
          />
        </button>
        {fx.map((e) => (
          <EffectLayer key={e.id} e={e} scale={stage.scale} onDone={() => setFx((all) => all.filter((x) => x.id !== e.id))} />
        ))}
        {grown && (
          <span className="absolute inset-x-0 top-[12%] flex justify-center" style={{ animation: 'pop 0.5s var(--ressort) both' }}>
            <span className="rounded-full bg-white px-4 py-2 font-rond text-titre3 text-teinte-fonce shadow-carte">Il a grandi : {grown.toLowerCase()} !</span>
          </span>
        )}
      </div>

      {/* son prénom, son âge, son amour */}
      <div className="mt-4 flex items-center gap-2 px-1">
        {renaming ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (newName.trim()) dress({ name: newName.trim() })
              setRenaming(false)
            }}
          >
            <input className="champ flex-1" value={newName} maxLength={24} onChange={(e) => setNewName(e.target.value)} autoFocus aria-label="Nouveau prénom" />
            <button type="submit" className="presse rounded-full bg-teinte px-4 text-sous font-semibold text-white">
              OK
            </button>
          </form>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate font-rond text-titre1">{pet.name}</p>
            <span className="shrink-0 rounded-full bg-teinte-doux px-3 py-1 text-legende font-semibold text-teinte-fonce">{stage.label}</span>
            <button
              onClick={() => {
                tap()
                setRenaming(true)
              }}
              className="presse flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carte text-brume shadow-carte"
              aria-label="Changer son prénom"
            >
              <PenLine size={16} strokeWidth={2.3} />
            </button>
          </>
        )}
      </div>
      <div className="mt-2 px-1">
        <div className="flex items-baseline justify-between text-note text-brume">
          <span className="flex items-center gap-1 font-semibold text-[#D45D88]">
            <Heart size={13} fill="#E77BA0" strokeWidth={0} /> {pet.love} d’amour
          </span>
          <span>{next ? `${Math.round(Math.min(100, ((pet.love - stage.min) / (next.min - stage.min)) * 100))} % · encore ${next.min - pet.love} ♥ pour devenir ${next.label.toLowerCase()}` : 'il a tout l’amour du monde'}</span>
        </div>
        <div className="mt-1.5 h-[8px] overflow-hidden rounded-full bg-remplissage">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${next ? Math.min(100, ((pet.love - stage.min) / (next.min - stage.min)) * 100) : 100}%`, background: 'linear-gradient(90deg, #F5A3BF, #E77BA0)' }}
          />
        </div>
      </div>

      {mood !== 'bien' && (
        <div className="mt-3 flex gap-3 rounded-[18px] bg-peche-doux px-4 py-3">
          <Frown size={20} strokeWidth={2.3} className="mt-0.5 shrink-0 text-peche-fonce" />
          <p className="text-sous">{mood === 'deprime' ? `${pet.name} déprime : deux jours sans manger. Demain, il s’en va.` : `${pet.name} est triste : il n’a pas mangé hier.`}</p>
        </div>
      )}

      {/* les gestes du jour */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Action
          icon={<CareIcon k="compagnon" size={34} />}
          title={fed ? 'Nourri' : 'Nourrir'}
          sub={fed ? 'Déjà mangé aujourd’hui' : family.food ? `+3 ★ · +${LOVE.feed} ♥ · ${family.food} repas` : 'Plus de croquettes'}
          done={fed}
          urgent={!fed && mood !== 'bien'}
          onClick={feed}
        />
        <Action icon={<HandIcon size={36} />} title="Caresser" sub={petted ? 'Pour le plaisir' : `+1 ★ · +${LOVE.pet} ♥`} onClick={() => void caress()} />
        <Action
          icon={<Art name="shop-friandises" size={36} />}
          title="Friandise"
          sub={treats ? `${treats} en stock · +${LOVE.treat} ♥` : 'À la supérette'}
          muted={!treats}
          onClick={() => void treat()}
        />
        <Action
          icon={<Art name={toys[0]?.art ?? 'jeu-balle'} size={36} />}
          title="Jouer"
          sub={toys.length ? (played ? 'Pour le plaisir' : `+1 ★ · +${LOVE.play} ♥`) : 'À l’animalerie'}
          muted={!toys.length}
          onClick={() => (toys.length ? void playWith(toys[Math.floor(Math.random() * toys.length)].key) : onShop('animalerie'))}
        />
      </div>
      {toys.length > 1 && (
        <div className="no-bar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
          {toys.map((t) => (
            <button key={t.key} onClick={() => void playWith(t.key)} className="presse flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-carte pl-1.5 pr-3.5 text-sous font-medium shadow-carte">
              <Art name={t.art} size={32} /> {t.name}
            </button>
          ))}
        </div>
      )}

      {/* ses affaires */}
      <Things title="Sa tenue" empty="Nœud, bandana, bonnet, petit pull : à l’animalerie." items={outfits} value={pet.outfit} onPick={(k) => dress({ outfit: k })} onShop={() => onShop('animalerie')} />
      <Things title="Son coin" empty="Coussin, panier, niche ou arbre à grimper : à l’animalerie." items={beds} value={pet.bed} onPick={(k) => dress({ bed: k })} onShop={() => onShop('animalerie')} />

      <button
        onClick={() => {
          tap()
          onShop('animalerie')
        }}
        className="presse groupe mt-5 flex w-full items-center gap-3 px-4 py-3 text-left shadow-carte"
      >
        <img src="./art/centre-commercial.webp" alt="" className="h-11 w-[74px] object-contain" />
        <span className="min-w-0 flex-1">
          <span className="block text-corps font-semibold">L’animalerie</span>
          <span className="block text-note text-brume">Jeux, vêtements, son coin, une gamelle dorée…</span>
        </span>
        <ChevronRight size={17} strokeWidth={2.6} className="text-pale" />
      </button>
      <p className="px-1 pt-4 text-note text-brume">{pet.name} mange une fois par jour : le premier de la famille qui le nourrit lui donne son repas.</p>
    </div>
  )
}

const PETSTAGE_ORDER = ['bebe', 'jeune', 'adulte']

function Action({ icon, title, sub, onClick, done, muted, urgent }: { icon: ReactNode; title: string; sub: string; onClick: () => void; done?: boolean; muted?: boolean; urgent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`presse flex items-center gap-3 rounded-[20px] p-3 text-left shadow-carte ${done ? 'bg-remplissage' : 'bg-carte'} ${urgent ? 'ring-2 ring-rouge/60' : ''}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${done ? 'bg-white/70' : 'bg-teinte-doux'} ${muted ? 'opacity-60' : ''}`}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-corps font-semibold">
          {title} {done && <Check size={15} strokeWidth={3} className="text-vert" />}
        </span>
        <span className="block truncate text-note text-brume">{sub}</span>
      </span>
    </button>
  )
}

function Things({ title, empty, items, value, onPick, onShop }: { title: string; empty: string; items: typeof SHOP; value: string | null; onPick: (k: string | null) => void; onShop: () => void }) {
  return (
    <>
      <p className="entete mt-5 !px-1">{title}</p>
      {items.length ? (
        <div className="no-bar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          <Chip on={!value} label="Rien" onClick={() => onPick(null)} />
          {items.map((i) => (
            <Chip key={i.key} on={value === i.key} label={i.name} art={i.art} onClick={() => onPick(i.key)} />
          ))}
        </div>
      ) : (
        <button onClick={onShop} className="presse groupe flex w-full items-center gap-3 px-4 py-3 text-left">
          <p className="min-w-0 flex-1 text-sous text-brume">{empty}</p>
          <ChevronRight size={17} strokeWidth={2.6} className="text-pale" />
        </button>
      )}
    </>
  )
}

function Chip({ on, label, art, onClick }: { on: boolean; label: string; art?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`presse flex w-[84px] shrink-0 flex-col items-center rounded-[18px] px-1 pb-2 pt-2 ${on ? 'bg-teinte-doux ring-[2.5px] ring-teinte' : 'bg-carte shadow-carte'}`}>
      {art ? <Art name={art} size={46} /> : <span className="flex h-[46px] items-center text-titre3 text-pale">—</span>}
      <span className={`mt-1 w-full truncate text-center text-mini ${on ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>{label}</span>
    </button>
  )
}

/** L'effet d'un geste au-dessus du compagnon : la gamelle, la main, la friandise, le jouet, puis l'amour gagné. */
function EffectLayer({ e, scale, onDone }: { e: Effect; scale: number; onDone: () => void }) {
  const w = 46 * scale
  return (
    <span className="pointer-events-none absolute bottom-[8%] left-1/2 block aspect-square -translate-x-1/2" style={{ width: `${w}%`, animation: 'apparait 2.8s ease both' }} onAnimationEnd={(ev) => ev.target === ev.currentTarget && onDone()}>
      {e.kind === 'repas' && (
        <span className="absolute bottom-[-4%] left-[62%] block w-[46%]" style={{ animation: 'pop 0.45s var(--ressort) both' }}>
          <CareIcon k="compagnon" size="100%" />
        </span>
      )}
      {e.kind === 'caresse' && (
        <span className="absolute left-[14%] top-[-24%] block w-[72%] drop-shadow-[0_2px_4px_rgba(29,26,43,0.3)]" style={{ animation: 'caresse 0.62s ease-in-out 3' }}>
          <HandIcon size="100%" />
        </span>
      )}
      {e.kind === 'friandise' && <img src="./art/shop-friandises.webp" alt="" className="absolute right-[-30%] top-[0%] w-[44%]" style={{ animation: 'pop 0.5s var(--ressort) both' }} />}
      {e.kind === 'jeu' && e.toy && <img src={`./art/${shopItem(e.toy)?.art ?? 'jeu-balle'}.webp`} alt="" className="absolute bottom-[-2%] left-[-34%] w-[42%]" style={{ animation: 'rebond 0.6s var(--ressort) 3' }} />}
      {[0, 1, 2].map((i) => (
        <img key={i} src="./art/geste-coeur.webp" alt="" className="absolute left-[32%] top-[0%] w-[36%]" style={{ animation: `jaillit 1.3s ease-out ${0.7 + i * 0.22}s both`, ['--jx' as string]: `${(i - 1) * 90}%` }} />
      ))}
      {(e.love > 0 || e.stars > 0) && (
        <span className={`absolute ${e.kind === 'caresse' ? 'bottom-[128%]' : 'bottom-[96%]'} left-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[14px] font-bold shadow-[0_4px_12px_rgba(29,26,43,0.22)]`} style={{ animation: 'gain 1.8s ease-out 0.9s both' }}>
          {e.love > 0 && (
            <span className="flex items-center gap-0.5 text-[#D45D88]">
              +{e.love} <Heart size={13} fill="#E77BA0" strokeWidth={0} />
            </span>
          )}
          {e.stars > 0 && (
            <span className="flex items-center gap-0.5 text-teinte-fonce">
              +{e.stars} <img src="./art/picto-etoile.webp" alt="" className="h-[15px] w-[15px]" />
            </span>
          )}
        </span>
      )}
    </span>
  )
}
