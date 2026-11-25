import { Check, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FOOD, SHOP, type Shop, type ShopItem } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { enlever, encodeLook, lookOf, mettre, placeDe, portes, toutEnlever, type Look } from '../lib/look'
import { useHome } from '../lib/store'
import { BagIcon } from './care'
import { Character, prechargerHabits } from './Character'
import { StarsPill } from './compagnon'
import { PetFigure } from './pet'
import { Art, confirmerAchat, Page, Segments } from './ui'

// Le centre commercial : la supérette (ce qui se mange et ce qui se sème), l'animalerie
// (le coin, les jeux et les vêtements du compagnon) et la boutique (les accessoires de la famille).
// Tout s'achète avec les étoiles gagnées ensemble.

export function CentrePage({ onClose, start = 'superette' }: { onClose: () => void; start?: Shop }) {
  const { state } = useHome()
  const [shop, setShop] = useState<Shop>(start)
  return (
    <Page title="Centre commercial" onClose={onClose} trailing={<StarsPill />}>
      <div className="px-4">
        <div className="relative overflow-hidden rounded-[28px] shadow-carte" style={{ background: 'linear-gradient(180deg, #EFE9FF 0%, #FFF4EC 100%)' }}>
          <img src="./art/centre-commercial.webp" alt="La supérette, l’animalerie et la boutique" className="mx-auto block w-full max-w-[420px] px-3 pt-3" />
          <p className="px-4 pb-3 pt-1 text-center text-note text-brume">Tout s’achète avec les étoiles de la famille : {state.family.stars} à dépenser.</p>
        </div>
        <div className="mt-4">
          <Segments
            value={shop}
            onChange={(v) => {
              tap()
              setShop(v)
            }}
            options={[
              { key: 'superette', label: 'Supérette' },
              { key: 'animalerie', label: 'Animalerie' },
              { key: 'boutique', label: 'Boutique' },
            ]}
          />
        </div>
        {shop === 'superette' ? <Superette /> : shop === 'animalerie' ? <Animalerie /> : <Boutique />}
      </div>
    </Page>
  )
}

function useBuy() {
  const { state, run } = useHome()
  return async (it: ShopItem) => {
    if (!(await confirmerAchat(it.name.toLowerCase(), it.cost))) return
    if (await run((a) => a.buyItem(state.family.id, it.key), it.qty ? `${it.name} : dans le placard` : `${it.name} : à vous !`)) success()
  }
}

function Price({ cost, can, onClick, label }: { cost: number; can: boolean; onClick: () => void; label: string }) {
  return (
    <button
      disabled={!can}
      onClick={onClick}
      aria-label={label}
      className={`presse flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sous font-semibold disabled:opacity-100 ${can ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}
    >
      {can ? <Art name="picto-etoile" size={16} /> : <Lock size={12} strokeWidth={2.6} />} {cost}
    </button>
  )
}

// ───────── La supérette ─────────

function Superette() {
  const { state, run } = useHome()
  const { family, stock } = state
  const buy = useBuy()
  const groups = [...new Set(SHOP.filter((i) => i.shop === 'superette').map((i) => i.group))]
  const canFood = family.stars >= FOOD.cost && family.food <= FOOD.max - FOOD.meals
  return (
    <>
      <p className="entete mt-5 !px-1">Pour les animaux</p>
      <div className="groupe">
        <Line
          art={<BagIcon size={46} empty={family.food === 0} />}
          name="Sac de croquettes"
          text={`${FOOD.meals} repas · pour le compagnon et les oiseaux`}
          have={family.food ? `Il en reste ${family.food}` : 'Le placard est vide'}
          price={
            <Price
              cost={FOOD.cost}
              can={canFood}
              label={`Acheter un sac de croquettes : ${FOOD.cost} étoiles`}
              onClick={async () => {
                if (!(await confirmerAchat('un sac de croquettes', FOOD.cost))) return
                if (await run((a) => a.buyFood(family.id), `Un sac de croquettes : +${FOOD.meals} repas`)) success()
              }}
            />
          }
        />
        {SHOP.filter((i) => i.group === 'Pour le compagnon').map((it) => (
          <Line key={it.key} art={<Art name={it.art} size={48} />} name={it.name} text={it.text ?? ''} have={stock[it.key] ? `Dans le placard : ${stock[it.key]}` : undefined} price={<Price cost={it.cost} can={family.stars >= it.cost} label={`Acheter ${it.name} : ${it.cost} étoiles`} onClick={() => void buy(it)} />} last />
        ))}
      </div>
      {groups
        .filter((g) => g !== 'Pour le compagnon')
        .map((g) => (
          <div key={g}>
            <p className="entete mt-5 !px-1">{g}</p>
            <div className="groupe">
              {SHOP.filter((i) => i.group === g).map((it, n, list) => (
                <Line
                  key={it.key}
                  art={<Art name={it.art} size={48} />}
                  name={it.name}
                  text={it.text ?? ''}
                  have={stock[it.key] ? `Dans le placard : ${stock[it.key]}` : undefined}
                  price={<Price cost={it.cost} can={family.stars >= it.cost} label={`Acheter ${it.name} : ${it.cost} étoiles`} onClick={() => void buy(it)} />}
                  last={n === list.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
    </>
  )
}

function Line({ art, name, text, have, price, last }: { art: React.ReactNode; name: string; text: string; have?: string; price: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex items-center gap-3 pl-3">
      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center">{art}</span>
      <div className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 ${last ? '' : 'border-b border-trait'}`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-corps font-semibold">{name}</p>
          <p className="truncate text-note text-brume">{text}</p>
          {have && <p className="text-legende font-semibold text-vert">{have}</p>}
        </div>
        {price}
      </div>
    </div>
  )
}

// ───────── L'animalerie ─────────

function Animalerie() {
  const { state, run } = useHome()
  const { family, owned, pet } = state
  const buy = useBuy()
  const groups = [...new Set(SHOP.filter((i) => i.shop === 'animalerie').map((i) => i.group))]
  const wear = (it: ShopItem) => {
    if (!pet) return
    tap()
    const outfit = it.key.startsWith('habit:') ? (pet.outfit === it.key ? null : it.key) : pet.outfit
    const bed = it.key.startsWith('lit:') ? (pet.bed === it.key ? null : it.key) : pet.bed
    void run((a) => a.dressPet(family.id, { outfit, bed, name: pet.name }))
  }
  return (
    <>
      {pet ? (
        <div className="groupe mt-4 flex items-center gap-3 px-3 py-2.5">
          <PetFigure pet={pet} className="w-[52px]" />
          <p className="min-w-0 flex-1 text-sous">Ce que vous achetez ici est pour {pet.name}. Ses vêtements et son coin se changent aussi depuis sa page.</p>
        </div>
      ) : (
        <p className="mt-4 px-1 text-sous text-brume">Vous n’avez pas encore de compagnon : tout ce que vous achetez ici l’attendra.</p>
      )}
      {groups.map((g) => (
        <div key={g}>
          <p className="entete mt-5 !px-1">{g}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {SHOP.filter((i) => i.group === g).map((it) => {
              const mine = owned.includes(it.key)
              const worn = !!pet && (pet.outfit === it.key || pet.bed === it.key)
              const wearable = it.key.startsWith('habit:') || it.key.startsWith('lit:')
              return (
                <div key={it.key} className={`groupe flex flex-col items-center px-1.5 pb-2.5 pt-3 text-center shadow-carte ${worn ? 'ring-2 ring-teinte' : ''}`}>
                  <Art name={it.art} size={58} className={!mine && family.stars < it.cost ? 'opacity-55' : ''} />
                  <span className="mt-1.5 line-clamp-2 flex min-h-[32px] items-center text-legende font-medium">{it.name}</span>
                  {mine ? (
                    wearable && pet ? (
                      <button onClick={() => wear(it)} className={`presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold ${worn ? 'bg-teinte text-white' : 'bg-teinte-doux text-teinte-fonce'}`}>
                        {worn ? (
                          <>
                            <Check size={13} strokeWidth={3} /> {it.key.startsWith('lit:') ? 'Son coin' : 'Porté'}
                          </>
                        ) : it.key.startsWith('lit:') ? (
                          'Installer'
                        ) : (
                          'Lui mettre'
                        )}
                      </button>
                    ) : (
                      <span className="mt-1.5 flex h-[26px] items-center gap-1 rounded-full bg-remplissage px-2.5 text-legende font-semibold text-brume">
                        <Check size={13} strokeWidth={3} /> À vous
                      </span>
                    )
                  ) : (
                    <button
                      disabled={family.stars < it.cost}
                      onClick={() => void buy(it)}
                      className={`presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold disabled:opacity-100 ${family.stars >= it.cost ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}
                      aria-label={`${it.name} : ${it.cost} étoiles`}
                    >
                      {family.stars >= it.cost ? <Art name="picto-etoile" size={15} /> : <Lock size={11} strokeWidth={2.6} />} {it.cost}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

// ───────── La boutique (pour la famille) ─────────

function Boutique() {
  const { state, run } = useHome()
  const { family, owned, me } = state
  const articles = SHOP.filter((i) => i.shop === 'boutique')
  const groups = [...new Set(articles.map((i) => i.group))]
  // La tenue change tout de suite à l'écran ; elle est enregistrée un instant plus tard, une seule fois pour
  // plusieurs gestes d'affilée (sinon chaque réponse du serveur ferait clignoter la figurine).
  const [locale, setLocale] = useState<Look | null>(null)
  const look = locale ?? lookOf(me.avatar, me.user_id ?? me.id)
  const dernier = useRef<Look | null>(null)
  const minuterie = useRef<number | undefined>(undefined)
  const envoyer = useRef(async () => {})
  envoyer.current = async () => {
    const l = dernier.current
    if (!l) return
    const avatar = encodeLook(l)
    await run(
      (api) => api.updateMember(me.id, { avatar }),
      undefined,
      (s) => ({ ...s, me: { ...s.me, avatar }, members: s.members.map((m) => (m.id === s.me.id ? { ...m, avatar } : m)) }),
    )
    if (dernier.current === l) {
      dernier.current = null
      setLocale(null)
    }
  }
  const porter = (l: Look) => {
    dernier.current = l
    setLocale(l)
    window.clearTimeout(minuterie.current)
    minuterie.current = window.setTimeout(() => void envoyer.current(), 450)
  }
  // en quittant la boutique, ce qui n'est pas encore enregistré part tout de suite
  useEffect(
    () => () => {
      window.clearTimeout(minuterie.current)
      void envoyer.current()
    },
    [],
  )
  // les images des habits arrivent d'avance : d'abord ceux qu'on a, puis le reste (pour l'essayage)
  const figurine = look.k
  useEffect(() => {
    const nom = (i: ShopItem) => i.key.slice('mode:'.length)
    prechargerHabits(look, articles.filter((i) => owned.includes(i.key)).map(nom))
    const t = window.setTimeout(() => prechargerHabits(look, articles.map(nom)), 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figurine, owned.length])
  // chaque chose a sa place (tête, haut, veste, bas, chaussures…) : on peut en porter plusieurs à la fois
  const worn = portes(look).map((a) => `mode:${a}`)
  // la cabine : ce qu'on essaie sans l'avoir (pas encore acheté), montré sur soi avant de dépenser ses étoiles
  const [essai, setEssai] = useState<string | null>(null)
  const essaye = essai && !owned.includes(essai) ? articles.find((i) => i.key === essai) ?? null : null
  const vu = essaye ? mettre(look, essaye.key.slice('mode:'.length)) : look
  const put = (key: string, on: boolean) => {
    tap()
    setEssai(null)
    const a = key.slice('mode:'.length)
    porter(on ? mettre(look, a) : enlever(look, a))
  }
  const toutRetirer = () => {
    tap()
    setEssai(null)
    porter(toutEnlever(look))
  }
  const acheter = async (it: ShopItem) => {
    if (!(await confirmerAchat(it.name.toLowerCase(), it.cost))) return
    if (!(await run((a) => a.buyItem(family.id, it.key), `${it.name} : à vous !`))) return
    success()
    // acheté : on le garde sur soi
    setEssai(null)
    porter(mettre(look, it.key.slice('mode:'.length)))
  }
  return (
    <>
      {/* La cabine d'essayage : sa figurine en pied, bien visible, qui reste en haut pendant qu'on parcourt les rayons.
          Sa hauteur ne change jamais (rien ne saute quand on met ou enlève quelque chose). */}
      <div className="sticky top-0 z-10 -mx-1 mt-2 px-1 pb-2 pt-2" style={{ background: 'linear-gradient(to bottom, #F2F1F8 86%, rgba(242, 241, 248, 0))' }}>
        <div className="flex h-[176px] items-stretch gap-3 overflow-hidden rounded-[24px] px-3 shadow-carte" style={{ background: 'linear-gradient(160deg, #EFE9FF 0%, #FFF4EC 100%)' }}>
          {/* la figurine fait 142 px de haut dans une carte de 176 : il reste la place d'un chapeau au-dessus (il ne
              dépasse jamais de plus de 0,11 de sa hauteur, voir accPlace) et un peu d'air sous ses pieds — rien ne sort
              plus du cadre, et sa taille ne change pas quand on met ou enlève quelque chose */}
          <span className="relative block w-[108px] shrink-0 self-end pb-2.5" aria-label={essaye ? `Vous essayez : ${essaye.name}` : 'Votre tenue'}>
            <span className="absolute inset-x-3 bottom-2 block h-3 rounded-[50%] bg-black/10 blur-[3px]" />
            <Character look={vu} className="relative mx-auto block w-[97px]" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col justify-center py-3">
            <p className="text-legende font-semibold uppercase tracking-wide text-brume">Cabine d’essayage</p>
            {essaye ? (
              <>
                <p className="mt-1 line-clamp-2 text-appel font-semibold">{essaye.name}</p>
                <p className="mt-0.5 text-legende text-brume">À l’essai : pas encore à vous.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    disabled={family.stars < essaye.cost}
                    onClick={() => void acheter(essaye)}
                    className={`presse flex h-9 items-center gap-1 rounded-full px-3.5 text-sous font-semibold disabled:opacity-100 ${family.stars >= essaye.cost ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}
                    aria-label={`Acheter ${essaye.name} : ${essaye.cost} étoiles`}
                  >
                    {family.stars >= essaye.cost ? <Art name="picto-etoile" size={16} /> : <Lock size={12} strokeWidth={2.6} />} {essaye.cost}
                  </button>
                  <button
                    onClick={() => {
                      tap()
                      setEssai(null)
                    }}
                    className="presse h-9 rounded-full bg-white/70 px-3.5 text-sous font-semibold text-brume"
                  >
                    Retirer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 line-clamp-3 text-sous">{worn.length ? `Vous portez ${worn.length} chose${worn.length > 1 ? 's' : ''}. Tout se porte ensemble.` : 'Touchez un habit pour l’essayer sur vous, même avant de l’acheter.'}</p>
                <div className="mt-2">
                  <button onClick={toutRetirer} disabled={!worn.length} className="presse h-9 rounded-full bg-white/70 px-3.5 text-sous font-semibold text-brume disabled:opacity-40">
                    Tout enlever
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <p className="entete mt-3 !px-1">{g}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {articles
              .filter((i) => i.group === g)
              .map((it) => {
                const mine = owned.includes(it.key)
                const porte = worn.includes(it.key)
                const alEssai = essaye?.key === it.key
                return (
                  <div key={it.key} className={`groupe flex flex-col items-center px-1.5 pb-2.5 pt-3 text-center shadow-carte ${porte || alEssai ? 'ring-2 ring-teinte' : ''}`}>
                    {/* toucher l'image : la mettre (si on l'a) ou l'essayer dans la cabine (sinon) */}
                    <button
                      onClick={() => {
                        if (mine) return put(it.key, !porte)
                        tap()
                        setEssai(alEssai ? null : it.key)
                      }}
                      className="presse block"
                      aria-label={mine ? (porte ? `Enlever ${it.name}` : `Porter ${it.name}`) : alEssai ? `Ne plus essayer ${it.name}` : `Essayer ${it.name}`}
                    >
                      {/* ce qui se porte sur la tête ou le visage : en aperçu sur son personnage ; le reste se voit dans la cabine */}
                      {mine && ['T', 'Y', 'O', 'C'].includes(placeDe(it.key.slice('mode:'.length)) ?? '') ? (
                        <span className="block h-[58px] w-[58px] overflow-hidden rounded-[16px] bg-remplissage">
                          <Character look={mettre(look, it.key.slice('mode:'.length))} bust still className="block h-full w-full" />
                        </span>
                      ) : (
                        <Art name={it.art} size={58} className={!mine && family.stars < it.cost ? 'opacity-55' : ''} />
                      )}
                    </button>
                    <span className="mt-1.5 line-clamp-2 flex min-h-[32px] items-center text-legende font-medium">{it.name}</span>
                    {mine ? (
                      <button onClick={() => put(it.key, !porte)} className={`presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold ${porte ? 'bg-teinte text-white' : 'bg-teinte-doux text-teinte-fonce'}`}>
                        {porte ? (
                          <>
                            <Check size={13} strokeWidth={3} /> Porté
                          </>
                        ) : (
                          'Porter'
                        )}
                      </button>
                    ) : (
                      <button
                        disabled={family.stars < it.cost}
                        onClick={() => void acheter(it)}
                        className={`presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold disabled:opacity-100 ${family.stars >= it.cost ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}
                        aria-label={`${it.name} : ${it.cost} étoiles`}
                      >
                        {family.stars >= it.cost ? <Art name="picto-etoile" size={15} /> : <Lock size={11} strokeWidth={2.6} />} {it.cost}
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </>
  )
}
