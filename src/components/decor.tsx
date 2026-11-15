import { Check, Lock, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ANIMALS, CARE, DECOS, FOOD, type Deco } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { StarEntry } from '../lib/types'
import { todayKey } from '../lib/util'
import { BagIcon, CareIcon, pettedToday, useCare, usePet } from './care'
import House from './House'
import { StarsSheet } from './stars'
import { Art, Btn, Page, Sheet } from './ui'

// La boutique de la maison : une page à part, qui glisse par-dessus l'écran.
// Les animaux et les plantes vivent avec la famille : avant de les installer,
// on prévient qu'il faudra s'en occuper chaque jour, ensemble.

const GROUPS: { title: string; hint?: string; keys: string[] }[] = [
  { title: 'Animaux et plantes', hint: 'Ils vivent avec vous : il faut les nourrir ou les arroser chaque jour, en famille.', keys: ['fleurs', 'chat', 'potager', 'cabane'] },
  { title: 'Le jardin', keys: ['boite', 'lanterne', 'arbre', 'balancoire', 'fontaine'] },
  { title: 'La maison et le ciel', keys: ['fumee', 'montgolfiere'] },
]

/** food : on arrive ici pour racheter des croquettes (la ligne est mise en avant). */
export function DecorPage({ onClose, food: forFood = false }: { onClose: () => void; food?: boolean }) {
  const { state, run } = useHome()
  const { family, houseItems, cares } = state
  const foodRef = useRef<HTMLDivElement>(null)
  const [glow, setGlow] = useState(forFood)
  const showFood = () => {
    foodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setGlow(true)
  }
  const care = useCare(showFood)
  const petAnimal = usePet()
  useEffect(() => {
    if (!forFood) return
    const t = window.setTimeout(() => foodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450)
    return () => window.clearTimeout(t)
  }, [forFood])
  useEffect(() => {
    if (!glow) return
    const t = window.setTimeout(() => setGlow(false), 2600)
    return () => window.clearTimeout(t)
  }, [glow])
  const canFood = family.stars >= FOOD.cost && family.food <= FOOD.max - FOOD.meals
  const [adopt, setAdopt] = useState<Deco | null>(null)
  const [stars, setStars] = useState(false)
  const next = DECOS.find((d) => !houseItems.includes(d.key))
  const day = todayKey()

  const install = async (d: Deco) => {
    success()
    await run((api) => api.unlock(family.id, d.key), `${d.name} : installé`)
  }

  return (
    <>
      <Page
        title="Décorer la maison"
        onClose={onClose}
        trailing={
          <button
            onClick={() => {
              tap()
              setStars(true)
            }}
            className="presse verre flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold"
            aria-label={`${family.stars} étoiles : comment en gagner`}
          >
            <Art name="picto-etoile" size={24} /> {family.stars}
          </button>
        }
      >
        <p className="-mt-1 px-5 text-sous text-brume">
          Niveau {houseItems.length + 1} · {family.stars} étoile{family.stars > 1 ? 's' : ''} à dépenser, gagnées par toute la famille.
        </p>

        <div className="mx-4 mt-4 overflow-hidden rounded-[28px] bg-carte shadow-carte">
          <House type={family.house_type} items={houseItems} cares={cares} onCare={care} since={state.houseSince} petted={pettedToday(state.starLog, state.me.id)} onPet={petAnimal} />
          {next && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Art name={`deco-${next.key}`} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sous font-semibold">Prochaine : {next.name}</span>
                  <span className="shrink-0 text-note text-brume">{Math.min(family.stars, next.cost)}/{next.cost}</span>
                </div>
                <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-remplissage">
                  <div className="h-full rounded-full bg-teinte transition-all duration-500" style={{ width: `${Math.min(100, (family.stars / next.cost) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {GROUPS.map((g) => (
          <div key={g.title} className="mt-6">
            <p className="entete">{g.title}</p>
            {g.hint && <p className="-mt-1 px-5 pb-2.5 text-note text-brume">{g.hint}</p>}
            {g.keys.includes('chat') && (
              <div ref={foodRef} className={`groupe mx-4 mb-2.5 flex items-center gap-3 p-3 pr-3.5 shadow-carte transition-shadow duration-500 ${glow ? 'ring-2 ring-teinte' : ''}`}>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-peche-doux">
                  <BagIcon size={40} empty={family.food === 0} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-corps font-semibold">Sac de croquettes</p>
                  <p className={`text-note ${family.food ? 'text-brume' : 'font-semibold text-rouge'}`}>
                    {family.food ? `Il reste ${family.food} repas` : 'Le placard est vide'} · pour le chat et les oiseaux
                  </p>
                  <span className="mt-1.5 flex gap-[3px]" aria-hidden>
                    {Array.from({ length: FOOD.meals }).map((_, i) => (
                      <span key={i} className={`h-[6px] flex-1 rounded-full ${i < Math.min(family.food, FOOD.meals) ? 'bg-peche' : 'bg-remplissage'}`} />
                    ))}
                  </span>
                </div>
                <button
                  disabled={!canFood}
                  onClick={() => {
                    success()
                    void run((api) => api.buyFood(family.id), `Un sac de croquettes : +${FOOD.meals} repas`)
                  }}
                  className={`presse flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sous font-semibold disabled:opacity-100 ${canFood ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}
                  aria-label={`Acheter un sac de croquettes : ${FOOD.meals} repas pour ${FOOD.cost} étoiles`}
                >
                  {canFood ? <Art name="picto-etoile" size={16} /> : <Lock size={12} strokeWidth={2.6} />} {FOOD.cost}
                </button>
              </div>
            )}
            <div className="mx-4 grid grid-cols-3 gap-2.5">
              {g.keys.map((key) => {
                const d = DECOS.find((x) => x.key === key)!
                const c = CARE[key]
                const owned = houseItems.includes(key)
                const can = family.stars >= d.cost
                const done = c && cares.some((x) => x.item_key === key && x.day === day)
                return (
                  <div key={key} className="groupe relative flex flex-col items-center px-1.5 pb-2.5 pt-3 text-center shadow-carte">
                    <Art name={`deco-${key}`} size={58} className={!owned && !can ? 'opacity-55' : ''} />
                    <span className="mt-1.5 line-clamp-2 flex min-h-[32px] items-center text-legende font-medium">{d.name}</span>
                    {owned && c ? (
                      done ? (
                        <span className="mt-1.5 flex h-[26px] items-center gap-1 rounded-full bg-remplissage px-2.5 text-legende font-semibold text-brume">
                          <Check size={13} strokeWidth={3} /> {c.kind === 'nourrir' ? 'Nourri' : 'Arrosé'}
                        </span>
                      ) : (
                        <button
                          onClick={() => care(key)}
                          className="presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full bg-teinte-doux pl-1.5 pr-2.5 text-legende font-semibold text-teinte-fonce"
                          aria-label={`${c.verb} : +${c.stars}`}
                        >
                          <CareIcon k={key} size={17} /> +{c.stars}
                        </button>
                      )
                    ) : owned ? (
                      <span className="mt-1.5 flex h-[26px] items-center gap-1 rounded-full bg-remplissage px-2.5 text-legende font-semibold text-brume">
                        <Check size={13} strokeWidth={3} /> Installé
                      </span>
                    ) : (
                      <button
                        disabled={!can}
                        onClick={() => (c ? (tap(), setAdopt(d)) : void install(d))}
                        className={`presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold disabled:opacity-100 ${can ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}
                        aria-label={`${d.name} : ${d.cost} étoiles`}
                      >
                        {can ? <Art name="picto-etoile" size={15} /> : <Lock size={11} strokeWidth={2.6} />} {d.cost}
                      </button>
                    )}
                    {c && !owned && (
                      <span className="absolute right-1.5 top-1.5 flex rounded-full bg-white p-[2px] shadow-[0_1px_4px_rgba(29,26,43,0.18)]" title={c.kind === 'nourrir' ? 'À nourrir chaque jour' : 'À arroser chaque jour'}>
                        <CareIcon k={key} size={16} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <p className="px-5 pt-5 text-note text-brume">Chaque décoration installée fait monter la maison d’un niveau. Le défi de la semaine en offre une de plus.</p>
      </Page>

      {adopt && (
        <AdoptSheet
          deco={adopt}
          onClose={() => setAdopt(null)}
          onConfirm={async () => {
            const d = adopt
            setAdopt(null)
            await install(d)
          }}
        />
      )}
      {stars && <StarsSheet onClose={() => setStars(false)} />}
    </>
  )
}

/** Avant d'adopter le chat, d'accueillir les oiseaux ou de planter : on s'engage, en famille. */
function AdoptSheet({ deco, onClose, onConfirm }: { deco: Deco; onClose: () => void; onConfirm: () => void }) {
  const { state } = useHome()
  const c = CARE[deco.key]
  const animal = ANIMALS.includes(deco.key)
  const il = c.plural ? 'ils' : 'il'
  return (
    <Sheet title={c.adopt} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <span className="relative">
          <Art name={`deco-${deco.key}`} size={120} className="anim-flotte" />
          <span className="absolute -right-2 bottom-2 flex rounded-full bg-white p-1.5 shadow-carte">
            <CareIcon k={deco.key} size={30} />
          </span>
        </span>
        <p className="mt-3 font-rond text-titre2">{deco.name}</p>
        <p className="mt-1.5 max-w-[310px] text-sous text-brume">{c.warn}</p>
      </div>
      <div className="groupe mt-5">
        <div className="flex items-center gap-3 border-b border-trait px-4 py-3">
          <CareIcon k={deco.key} size={28} />
          <p className="min-w-0 flex-1 text-sous">{c.verb}, une fois par jour</p>
          <span className="flex items-center gap-1 text-appel font-semibold text-teinte">
            +{c.stars} <Art name="picto-etoile" size={17} />
          </span>
        </div>
        {animal && (
          <div className="flex items-center gap-3 border-b border-trait px-4 py-3">
            <BagIcon size={28} empty={state.family.food === 0} />
            <p className="min-w-0 flex-1 text-sous">
              {c.plural ? 'Ils mangent' : 'Il mange'} les croquettes de la maison : un repas à chaque fois.{' '}
              <span className="text-brume">{state.family.food ? `Il vous en reste ${state.family.food}.` : `Le placard est vide : un sac de ${FOOD.meals} repas coûte ${FOOD.cost} étoiles.`}</span>
            </p>
          </div>
        )}
        <p className="px-4 py-3 text-sous text-brume">Le premier qui s’en occupe fait gagner les étoiles à toute la famille. Chacun le voit en direct dans le jardin.</p>
      </div>
      {/* ce qui arrive si on l'oublie */}
      <div className="mt-3 flex gap-3 rounded-[18px] bg-[#FDECEC] px-4 py-3">
        <TriangleAlert size={20} strokeWidth={2.3} className="mt-0.5 shrink-0 text-rouge" />
        <p className="text-sous text-encre">
          {animal ? (
            <>
              <span className="font-semibold">S’{il} {c.plural ? 'sont oubliés' : 'est oublié'}</span>, {il} {c.plural ? 'sont tristes' : 'est triste'} dès le lendemain, puis {c.plural ? 'dépriment' : 'déprime'}. Au 4e jour sans manger, {il} s’en {c.plural ? 'vont' : 'va'} : {c.plural ? 'ils sont retirés' : 'il est retiré'} du jardin et les {deco.cost} étoiles dépensées ne sont pas rendues.
            </>
          ) : (
            <>
              <span className="font-semibold">Oubliées</span>, les plantes fanent. Un arrosage suffit pour qu’elles reprennent des couleurs.
            </>
          )}
        </p>
      </div>
      <Btn className="mt-4" onClick={onConfirm}>
        {c.act} · {deco.cost} <Art name="picto-etoile" size={20} />
      </Btn>
      <Btn className="mt-2.5" kind="gris" onClick={onClose}>
        Pas maintenant
      </Btn>
    </Sheet>
  )
}

// ───────── Un animal oublié est parti ─────────

const GONE_SEEN = 'nidoo.partis.vus'

/** Le dernier départ pas encore annoncé sur ce téléphone (dans la semaine). */
export function useGone() {
  const { state } = useHome()
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(GONE_SEEN) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const entry = state.starLog.find((x) => x.reason.startsWith('parti:') && !seen.includes(String(x.id)) && Date.now() - new Date(x.created_at).getTime() < 7 * 86400000)
  if (!entry) return null
  return {
    entry,
    seen: () => {
      const next = [...seen, String(entry.id)].slice(-30)
      setSeen(next)
      try {
        localStorage.setItem(GONE_SEEN, JSON.stringify(next))
      } catch {
        /* il sera annoncé à nouveau */
      }
    },
  }
}

export function GoneSheet({ entry, onClose, onAdopt }: { entry: StarEntry; onClose: () => void; onAdopt: () => void }) {
  const key = entry.reason.slice('parti:'.length)
  const c = CARE[key]
  const deco = DECOS.find((d) => d.key === key)
  if (!c || !deco) return null
  const Who = c.who.replace(/^./, (x) => x.toUpperCase())
  return (
    <Sheet title={`${Who} ${c.plural ? 'sont partis' : 'est parti'}`} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Art name={`deco-${key}`} size={120} className="opacity-60 grayscale" />
        <p className="mt-3 font-rond text-titre2">
          {Who} {c.plural ? 'sont partis' : 'est parti'}
        </p>
        <p className="mt-1.5 max-w-[310px] text-sous text-brume">
          Personne ne {c.plural ? 'les' : 'l’'}a nourri{c.plural ? 's' : ''} pendant trois jours. {c.plural ? 'Ils sont partis' : 'Il est parti'} chercher une famille qui aura plus de temps pour {c.plural ? 'eux' : 'lui'}. Les {deco.cost} étoiles dépensées ne sont pas rendues.
        </p>
      </div>
      <Btn className="mt-5" onClick={onAdopt}>
        {c.act === 'Adopter' ? 'Adopter un nouveau chat' : 'Accueillir de nouveaux oiseaux'}
      </Btn>
      <Btn className="mt-2.5" kind="gris" onClick={onClose}>
        Compris
      </Btn>
    </Sheet>
  )
}
