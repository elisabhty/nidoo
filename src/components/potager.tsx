import { Check, Lock, Sprout } from 'lucide-react'
import { useState } from 'react'
import { DECOS, PLANTS, plantArt, plantOf, plantStage, STAGE_LABEL, type Shop } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { jouer } from '../lib/sons'
import { useHome } from '../lib/store'
import { todayKey } from '../lib/util'
import { CareIcon, useCare } from './care'
import { StarsPill } from './compagnon'
import { Art, Btn, Page, Sheet } from './ui'

// Le potager : trois parcelles. On sème des graines achetées à la supérette ; chaque jour
// où le potager est arrosé (et chaque engrais), tout ce qui est planté pousse d'un cran.
// Une fois mûr, on récolte : la parcelle se libère et la maison gagne des étoiles.

export function PotagerPage({ onClose, onShop }: { onClose: () => void; onShop: (shop: Shop) => void }) {
  const { state, run } = useHome()
  const { family, houseItems, plots, stock, cares } = state
  const [sow, setSow] = useState<number | null>(null)
  const [cheer, setCheer] = useState<{ plot: number; n: number } | null>(null)
  const care = useCare()
  const has = houseItems.includes('potager')
  const watered = cares.some((c) => c.item_key === 'potager' && c.day === todayKey())
  const deco = DECOS.find((d) => d.key === 'potager')!
  const engrais = stock.engrais ?? 0

  if (!has)
    return (
      <Page title="Notre potager" onClose={onClose} trailing={<StarsPill />}>
        <div className="px-4">
          <div className="groupe flex flex-col items-center px-5 py-6 text-center shadow-carte">
            <Art name="deco-potager" size={150} className="anim-flotte" />
            <p className="mt-2 font-rond text-titre2">Un potager pour la famille</p>
            <p className="mt-1.5 text-sous text-brume">Trois parcelles où semer carottes, fraises, tomates, tournesols… Chaque arrosage les fait pousser, et chaque récolte rapporte des étoiles.</p>
          </div>
          <Btn
            className="mt-4"
            disabled={family.stars < deco.cost}
            onClick={async () => {
              if (await run((a) => a.unlock(family.id, 'potager'), 'Le potager est installé')) success()
            }}
          >
            {family.stars < deco.cost ? (
              <>
                <Lock size={16} strokeWidth={2.6} /> Encore {deco.cost - family.stars} étoiles
              </>
            ) : (
              <>
                Installer le potager · {deco.cost} <Art name="picto-etoile" size={20} />
              </>
            )}
          </Btn>
        </div>
      </Page>
    )

  return (
    <Page title="Notre potager" onClose={onClose} trailing={<StarsPill />}>
      <div className="px-4">
        <p className="-mt-1 px-1 text-sous text-brume">Chaque jour où le potager est arrosé, tout ce qui est planté pousse d’un cran.</p>

        {/* arroser, engrais */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => (watered ? tap() : care('potager'))}
            className={`presse flex items-center gap-3 rounded-[20px] p-3 text-left shadow-carte ${watered ? 'bg-remplissage' : 'bg-carte ring-2 ring-[#5AAEF0]/50'}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#E3F1FD]">
              <CareIcon k="potager" size={34} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-corps font-semibold">
                {watered ? 'Arrosé' : 'Arroser'} {watered && <Check size={15} strokeWidth={3} className="text-vert-fonce" />}
              </span>
              <span className="block truncate text-note text-brume">{watered ? 'Ça pousse !' : '+1 ★ · tout pousse'}</span>
            </span>
          </button>
          <button
            onClick={async () => {
              if (!engrais) return onShop('superette')
              if (!plots.length) return tap()
              if (await run((a) => a.fertilize(family.id), 'Tout le potager a poussé d’un cran')) success()
            }}
            className="presse flex items-center gap-3 rounded-[20px] bg-carte p-3 text-left shadow-carte"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#E6F4DF] ${engrais ? '' : 'opacity-60'}`}>
              <Art name="shop-engrais" size={34} />
            </span>
            <span className="min-w-0">
              <span className="block text-corps font-semibold">Engrais</span>
              <span className="block truncate text-note text-brume">{engrais ? `${engrais} en stock · +1 cran` : 'À la supérette'}</span>
            </span>
          </button>
        </div>

        {/* les trois parcelles */}
        <div className="mt-4 space-y-2.5">
          {[0, 1, 2].map((n) => {
            const p = plots.find((x) => x.plot === n)
            const info = p ? plantOf(p.plant) : null
            const stage = p ? plantStage(p.plant, p.growth) : null
            const ripe = stage === 'mur'
            return (
              <div key={n} className={`groupe relative flex items-center gap-3 p-3 shadow-carte ${ripe ? 'ring-2 ring-vert/60' : ''}`}>
                <span className="relative flex h-[92px] w-[92px] shrink-0 items-end justify-center overflow-hidden rounded-[18px]" style={{ background: 'linear-gradient(180deg, #F3F8EC 0%, #E4F0D6 62%, #9C7350 62.5%, #7E5A3C 100%)' }}>
                  {p ? (
                    <img key={`${p.plant}${p.growth}`} src={`./art/${plantArt(p.plant, p.growth)}.webp`} alt="" className="relative mb-[6%] w-[86%]" style={{ animation: 'pop 0.5s var(--ressort) both, balance 5s ease-in-out 0.5s infinite', transformOrigin: '50% 100%' }} />
                  ) : (
                    <Sprout size={28} strokeWidth={2} className="mb-[38%] text-[#9C7350]/50" />
                  )}
                  {cheer?.plot === n && (
                    <span key={cheer.n} className="pointer-events-none absolute inset-0">
                      {[0, 1, 2, 3].map((i) => (
                        <img key={i} src="./art/picto-etoile.webp" alt="" className="absolute left-[34%] top-[30%] w-[32%]" style={{ animation: `jaillit 1.1s ease-out ${i * 0.08}s both`, ['--jx' as string]: `${(i - 1.5) * 110}%` }} />
                      ))}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {p && info ? (
                    <>
                      <p className="text-corps font-semibold">{info.name}</p>
                      <p className={`text-note ${ripe ? 'font-semibold text-vert-fonce' : 'text-brume'}`}>
                        {STAGE_LABEL[stage!]}
                        {!ripe && ` · encore ${info.ripe - p.growth} arrosage${info.ripe - p.growth > 1 ? 's' : ''}`}
                      </p>
                      <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-remplissage">
                        <div className="h-full rounded-full bg-vert transition-all duration-700" style={{ width: `${Math.min(100, (p.growth / info.ripe) * 100)}%` }} />
                      </div>
                      {ripe && (
                        <button
                          onClick={async () => {
                            const ok = await run((a) => a.harvest(family.id, n), `Récolte : +${info.reward} étoiles`)
                            if (ok) {
                              success()
                              jouer('etoiles')
                              setCheer({ plot: n, n: Date.now() })
                            }
                          }}
                          className="presse mt-2.5 flex h-9 items-center gap-1.5 rounded-full bg-vert px-4 text-sous font-semibold text-white"
                        >
                          Récolter · +{info.reward} <Art name="picto-etoile" size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-corps font-semibold">Parcelle {n + 1}</p>
                      <p className="text-note text-brume">Rien n’y pousse encore.</p>
                      <button
                        onClick={() => {
                          tap()
                          setSow(n)
                        }}
                        className="presse mt-2.5 flex h-9 items-center gap-1.5 rounded-full bg-teinte px-4 text-sous font-semibold text-white"
                      >
                        <Sprout size={16} strokeWidth={2.4} /> Semer
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="px-1 pt-4 text-note text-brume">Les graines s’achètent à la supérette du centre commercial. Si personne n’arrose, rien ne pousse (et les fleurs fanent).</p>
      </div>

      {sow !== null && <SowSheet plot={sow} onClose={() => setSow(null)} onShop={onShop} />}
    </Page>
  )
}

/** Choisir quoi semer : ce qu'on a dans le placard, ou l'acheter et le semer d'un coup. */
function SowSheet({ plot, onClose, onShop }: { plot: number; onClose: () => void; onShop: (shop: Shop) => void }) {
  const { state, run } = useHome()
  const { family, stock } = state
  return (
    <Sheet title={`Semer dans la parcelle ${plot + 1}`} onClose={onClose} tall>
      <div className="groupe">
        {PLANTS.map((p, i) => {
          const key = `graines:${p.key}`
          const have = stock[key] ?? 0
          const cost = [4, 4, 5, 6, 8, 10][i]
          const can = have > 0 || family.stars >= cost
          return (
            <button
              key={p.key}
              disabled={!can}
              onClick={async () => {
                const ok = await run(async (a) => {
                  if (!have) await a.buyItem(family.id, key)
                  await a.plant(family.id, plot, p.key)
                }, `${p.name} : c’est semé`)
                if (ok) {
                  success()
                  onClose()
                }
              }}
              className={`presse-ligne flex w-full items-center gap-3 pl-3 text-left disabled:opacity-50 ${i < PLANTS.length - 1 ? '' : ''}`}
            >
              <Art name={p.key} size={54} />
              <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3.5 ${i < PLANTS.length - 1 ? 'border-b border-trait' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-corps font-semibold">{p.name}</span>
                  <span className="block truncate text-note text-brume">
                    Prêt en {p.ripe} arrosages · récolte +{p.reward} ★
                  </span>
                </span>
                {have ? (
                  <span className="shrink-0 rounded-full bg-[#E6F4DF] px-2.5 py-1 text-legende font-semibold text-vert-fonce">{have} sachet{have > 1 ? 's' : ''}</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-teinte-doux px-2.5 py-1 text-legende font-semibold text-teinte-fonce">
                    <Art name="picto-etoile" size={14} /> {cost}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <p className="px-1 pt-3 text-note text-brume">Sans sachet dans le placard, la graine est achetée puis semée tout de suite.</p>
      <Btn kind="gris" className="mt-3" onClick={() => (onClose(), onShop('superette'))}>
        Voir la supérette
      </Btn>
    </Sheet>
  )
}
