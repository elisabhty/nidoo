import { Check, ChevronRight, Heart, Lock, PenLine, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { FOOD, LOVE, nextStage, PET_COST, petStage, SHOP, shopItem, SPECIES, type Shop } from '../lib/data'
import { success, tap, warn } from '../lib/haptic'
import { jouer, sonCompagnon } from '../lib/sons'
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
  return (
    <Page title={state.pet ? state.pet.name : 'Notre compagnon'} onClose={onClose} trailing={<StarsPill />} scrollKey={state.pet ? 'compagnon' : 'adoption'}>
      {state.pet ? <PetView pet={state.pet} onShop={onShop} /> : <Adopt />}
    </Page>
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

function Adopt() {
  const { state, run } = useHome()
  const [species, setSpecies] = useState('chat')
  const [name, setName] = useState('')
  const sp = SPECIES.find((x) => x.key === species)!
  const missing = PET_COST - state.family.stars
  const shown = name.trim() || sp.names[0]

  return (
    <div className="px-4">
      <p className="-mt-1 px-1 text-sous text-brume">Choisissez-le ensemble : il vivra dans votre jardin et grandira avec l’amour de toute la famille.</p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {SPECIES.map((x) => {
          const on = x.key === species
          return (
            <button
              key={x.key}
              onClick={() => {
                tap()
                jouer(sonCompagnon(x.key))
                setSpecies(x.key)
              }}
              aria-pressed={on}
              className={`presse flex flex-col items-center rounded-[20px] px-1 pb-2 pt-2.5 transition-shadow ${on ? 'bg-teinte-doux ring-[2.5px] ring-teinte' : 'bg-carte shadow-carte'}`}
            >
              <PetFigure pet={{ species: x.key, outfit: null }} className={`w-[64px] ${on ? 'anim-flotte' : ''}`} />
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
      </div>

      <div className="groupe mt-5">
        <Row icon={<Heart size={22} className="text-[#E77BA0]" fill="#E77BA0" />} text="Chaque repas, caresse, friandise et partie de jeu lui donne de l’amour : il grandit, de bébé à adulte." />
        <Row icon={<BagIcon size={26} />} text={`Il mange les croquettes de la maison, un repas par jour. ${state.family.food ? `Il en reste ${state.family.food}.` : `Un sac de ${FOOD.meals} repas coûte ${FOOD.cost} étoiles.`}`} />
        <Row icon={<Art name="lit-panier" size={28} />} text="Son coin, ses jeux et ses vêtements s’achètent à l’animalerie du centre commercial." last />
      </div>
      <div className="mt-3 flex gap-3 rounded-[18px] bg-[#FDECEC] px-4 py-3">
        <TriangleAlert size={20} strokeWidth={2.3} className="mt-0.5 shrink-0 text-rouge" />
        <p className="text-sous text-encre">
          <span className="font-semibold">S’il est oublié</span>, il est triste dès le lendemain, puis déprime. Au 4e jour sans manger, il s’en va : son amour part avec lui et les {PET_COST} étoiles ne sont pas rendues.
        </p>
      </div>

      <Btn
        className="mt-5"
        disabled={missing > 0}
        onClick={async () => {
          if (await run((api) => api.adoptPet(state.family.id, species, shown), `Bienvenue ${shown} !`)) success()
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

function Row({ icon, text, last }: { icon: ReactNode; text: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-trait'}`}>
      <span className="flex w-8 shrink-0 justify-center">{icon}</span>
      <p className="min-w-0 flex-1 text-sous">{text}</p>
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
        {pet.bed && <img src={`./art/${pet.bed.replace(':', '-')}.webp`} alt="" className="absolute bottom-[10%] left-[6%] w-[30%]" />}
        {gold && <img src="./art/shop-gamelle.webp" alt="" className="absolute bottom-[8%] right-[8%] w-[16%]" />}
        <button
          onClick={() => void caress()}
          className="absolute bottom-[8%] left-1/2 block -translate-x-1/2 transition-[width] duration-700"
          style={{ width: `${46 * stage.scale}%` }}
          aria-label={`Caresser ${pet.name}`}
        >
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
          <span>{next ? `encore ${next.min - pet.love} pour devenir ${next.label.toLowerCase()}` : 'il a tout l’amour du monde'}</span>
        </div>
        <div className="mt-1.5 h-[8px] overflow-hidden rounded-full bg-remplissage">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${next ? Math.min(100, ((pet.love - stage.min) / (next.min - stage.min)) * 100) : 100}%`, background: 'linear-gradient(90deg, #F5A3BF, #E77BA0)' }}
          />
        </div>
      </div>

      {mood !== 'bien' && (
        <div className="mt-3 flex gap-3 rounded-[18px] bg-[#FDECEC] px-4 py-3">
          <TriangleAlert size={20} strokeWidth={2.3} className="mt-0.5 shrink-0 text-rouge" />
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
      <p className="px-1 pt-4 text-note text-brume">
        {pet.name} mange une fois par jour (le premier de la famille qui le nourrit). Oublié, il devient triste, puis déprime, et au 4e jour sans manger il s’en va.
      </p>
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
