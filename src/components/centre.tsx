import { Check, Lock } from 'lucide-react'
import { useState } from 'react'
import { FOOD, SHOP, type Shop, type ShopItem } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { ACCESSORIES, encodeLook, lookOf } from '../lib/look'
import { useHome } from '../lib/store'
import { BagIcon } from './care'
import { Character } from './Character'
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
  const buy = useBuy()
  const look = lookOf(me.avatar, me.user_id ?? me.id)
  const groups = [...new Set(SHOP.filter((i) => i.shop === 'boutique').map((i) => i.group))]
  const put = (key: string | null) => {
    tap()
    const v = key ? ACCESSORIES.indexOf(key.slice('mode:'.length)) : 0
    void run((a) => a.updateMember(me.id, { avatar: encodeLook({ ...look, v: Math.max(0, v) }) }), key ? 'C’est porté !' : 'Enlevé')
  }
  const current = look.v ? `mode:${ACCESSORIES[look.v]}` : null
  return (
    <>
      <div className="groupe mt-4 flex items-center gap-3 px-3 py-2.5">
        {/* en pied : on voit aussi la veste, le bas ou les chaussures qu'on porte */}
        <span className="block w-[60px] shrink-0 rounded-[18px] bg-remplissage px-1 pt-1">
          <Character look={look} className="block w-full" />
        </span>
        <p className="min-w-0 flex-1 text-sous">Ce que la famille achète ici, chacun peut le porter : depuis cette page pour toi, ou dans « Mon personnage ».</p>
        {current && (
          <button onClick={() => put(null)} className="presse shrink-0 rounded-full bg-remplissage px-3 py-1.5 text-legende font-semibold text-brume">
            Enlever
          </button>
        )}
      </div>
      {groups.map((g) => (
        <div key={g}>
          <p className="entete mt-5 !px-1">{g}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {SHOP.filter((i) => i.group === g).map((it) => {
              const mine = owned.includes(it.key)
              const worn = current === it.key
              const v = ACCESSORIES.indexOf(it.key.slice('mode:'.length))
              return (
                <div key={it.key} className={`groupe flex flex-col items-center px-1.5 pb-2.5 pt-3 text-center shadow-carte ${worn ? 'ring-2 ring-teinte' : ''}`}>
                  {/* ce qui se porte sur la tête ou le visage : en aperçu sur son personnage ; le reste (vestes, bas, chaussures)
                      ne se verrait pas dans ce petit buste, on garde l'image de l'habit */}
                  {mine && (g === 'Chapeaux' || g === 'Accessoires') ? (
                    <span className="block h-[58px] w-[58px] overflow-hidden rounded-[16px] bg-remplissage">
                      <Character look={{ ...look, v }} bust still className="block h-full w-full" />
                    </span>
                  ) : (
                    <Art name={it.art} size={58} className={!mine && family.stars < it.cost ? 'opacity-55' : ''} />
                  )}
                  <span className="mt-1.5 line-clamp-2 flex min-h-[32px] items-center text-legende font-medium">{it.name}</span>
                  {mine ? (
                    <button onClick={() => put(worn ? null : it.key)} className={`presse mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold ${worn ? 'bg-teinte text-white' : 'bg-teinte-doux text-teinte-fonce'}`}>
                      {worn ? (
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
