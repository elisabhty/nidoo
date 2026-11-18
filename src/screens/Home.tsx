import { CalendarDays, Camera, ChevronRight, Heart, MessageCircleHeart, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAvent } from '../components/avent'
import { DefisDuJour, QuestionSheet } from '../components/defis'
import { MotPage } from '../components/motmystere'
import { pettedToday, useCare, usePet } from '../components/care'
import { DecorPage, GoneSheet, useGone } from '../components/decor'
import { DrawingsSheet, useUnseenDrawings } from '../components/drawing'
import { DrawSheet } from '../components/planche'
import { HousePhotosSheet } from '../components/housePhotos'
import { housePhotoSources, selectedHousePhotos } from '../lib/housePhotos'
import House, { type HouseScene } from '../components/House'
import { myTurns } from '../components/jeux'
import { useLieux } from '../components/lieux'
import { PetFigure } from '../components/pet'
import { ComposeSheet, EventDetailSheet, MoodSheet, ThoughtSheet } from '../components/sheets'
import { StarsSheet } from '../components/stars'
import { Art, Avatar, Sheet } from '../components/ui'
import type { AventAction } from '../lib/avent'
import { challengeOfDay, moodOf } from '../lib/data'
import { feel, tap } from '../lib/haptic'
import { shareInvite } from '../lib/share'
import { homeStories } from '../lib/homeStories'
import { useHome } from '../lib/store'
import type { Drawing, FamEvent, Member } from '../lib/types'
import { familyLabel, finDe, greeting, isToday, nextOccurrence, season } from '../lib/util'
import type { Go } from '../App'

type Open =
  | null
  | { k: 'humeur' }
  | { k: 'pensee'; to?: Member }
  | { k: 'dessin'; to?: string | null; carte?: string }
  | { k: 'dessins'; start?: Drawing }
  | { k: 'etoiles' }
  | { k: 'decor'; food?: boolean }
  | { k: 'explorer' }
  | { k: 'question' }
  | { k: 'defiPhoto' }
  | { k: 'photosMaison'; mode:'add'|'remove' }
  | { k: 'mot' }
  | { k: 'evenement'; e: FamEvent }

export function upcoming(events: ReturnType<typeof useHome>['state']['events'], limit = 3) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return events
    .map((e) => ({ e, at: nextOccurrence(e) }))
    .filter((x) => finDe(x.e, x.at) >= start) // un week-end commencé hier compte encore
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit)
}

const PLAYED = 'nidoo.scenes.jouees'

export default function Home({ go, active = true }: { go: (t: Go) => void; active?: boolean }) {
  const { state, toast } = useHome()
  const [sheet, setSheet] = useState<Open>(null)
  const [explorerVu, setExplorerVu] = useState(() => {
    try {
      return localStorage.getItem('nidoo.explorer.vu') === '1'
    } catch {
      return true
    }
  })
  const [scene, setScene] = useState<HouseScene | null>(null)
  const houseRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const { family, me, members, houseItems } = state
  const received = useUnseenDrawings(state)
  const pendingThoughts = state.thoughts.filter(t => t.to_member === me.id && !t.seen_at)
  const nextSender = pendingThoughts[pendingThoughts.length - 1]?.from_member ?? received[0]?.from_member
  const others = members.filter((m) => m.id !== me.id)
  const inviter = async () => {
    tap()
    if (!family.invite_code || new Date(family.invite_expires_at).getTime() < Date.now()) return go('famille')
    if ((await shareInvite(family.name, family.invite_code)) === 'copie') toast('Invitation copiée')
  }
  const photos = selectedHousePhotos(housePhotoSources(state),family.house_photo_ids).map(p => p.url)
  const now = season()
  // un anniversaire aujourd'hui : on propose la carte toute prête, avec le prénom
  const anniv = state.events
    .filter((e) => e.kind === 'anniversaire' && isToday(nextOccurrence(e).toISOString()))
    .map((e) => {
      const m = others.find((o) => e.members?.includes(o.id)) ?? others.find((o) => e.title.toLowerCase().includes(o.display_name.toLowerCase()))
      const nom = m?.display_name ?? e.title.replace(/^anniversaire\s+(de\s+|d['’])?/i, '')
      return { e, m, nom }
    })
    .filter((x) => !x.e.members?.includes(me.id) || x.m)[0]
  const care = useCare(() => setSheet({ k: 'decor', food: true }))
  const petAnimal = usePet()
  const petted = pettedToday(state.starLog, me.id)
  const tours = myTurns(state)
  const prochain = upcoming(state.events, 1)[0] ?? null
  const histoires = homeStories(state, me.id, prochain)
  const lieux = useLieux(aventAction)
  const av = useAvent()
  const caseDuJour = av.visible && av.aOuvrir.includes(av.today)
  // Le bouton d'une case du calendrier de l'Avent : on ferme le calendrier pour ouvrir le bon endroit
  // (les lieux, eux, s'empilent par-dessus : en revenant, on retrouve le calendrier).
  function aventAction(a: AventAction) {
    if (a === 'compagnon' || a === 'potager' || a === 'centre') return lieux.open({ k: a })
    lieux.closeAll()
    if (a === 'attention') setSheet({ k: 'dessin' })
    else if (a === 'carte') setSheet({ k: 'dessin', carte: 'noel' })
    else if (a === 'humeur') setSheet({ k: 'humeur' })
    else if (a === 'souvenirs') go('fil') // « Partager une photo » : on la partage dans le fil
    else go('organiser')
  }
  const gone = useGone()
  // Un câlin envoyé ou reçu se joue dans le jardin : l'un va voir l'autre et le fait vraiment.
  useEffect(() => {
    if (!active || scene || sheet) return
    let played: string[] = []
    try {
      played = JSON.parse(localStorage.getItem(PLAYED) ?? '[]') as string[]
    } catch {
      /* rien de mémorisé */
    }
    const t = state.thoughts
      .filter((x) => Date.now() - new Date(x.created_at).getTime() < 15 * 60000 && !played.includes(x.id) && (x.from_member === me.id || (x.to_member === me.id && x.seen_at)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    if (!t) return
    try {
      localStorage.setItem(PLAYED, JSON.stringify([...played, t.id].slice(-60)))
    } catch {
      /* tant pis : la scène pourra se rejouer */
    }
    const r = houseRef.current?.getBoundingClientRect()
    if (r && (r.top < 60 || r.bottom > window.innerHeight - 90)) houseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setScene({ id: t.id, from: t.from_member, to: t.to_member, kind: t.kind })
  }, [state.thoughts, sheet, scene, me.id, active])
  // Le geste se sent (et s'entend) au moment où il se fait, chez les deux.
  // (Avant, ce minuteur vivait dans l'effet du dessus et setScene l'annulait aussitôt.)
  const sceneKind = scene?.kind
  useEffect(() => {
    if (!sceneKind) return
    const v = window.setTimeout(() => feel(sceneKind), 1300)
    return () => window.clearTimeout(v)
  }, [scene?.id, sceneKind])

  return (
    <>
      <div className="relative h-full">
        <div
          className={`ios-topbar pointer-events-none absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'ios-toolbar-active' : 'border-b border-transparent'}`}
          style={{ paddingTop: 'var(--sat)' }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-4">
            <button onClick={() => setSheet({ k: 'humeur' })} className="presse pointer-events-auto" aria-label="Mon humeur du jour">
              <Avatar m={me} size={38} mood />
            </button>
            <p className={`absolute inset-x-24 truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{familyLabel(family.name)}</p>
            <button
              onClick={() => {
                tap()
                setSheet({ k: 'etoiles' })
              }}
              className="presse verre pointer-events-auto flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold"
              aria-label={`${family.stars} étoiles : comment en gagner`}
            >
              <Art name="picto-etoile" size={24} /> {family.stars}
            </button>
          </div>
        </div>

        <div
          className="no-bar h-full overflow-y-auto overscroll-contain"
          style={{ paddingTop: 'calc(var(--sat) + 56px)', paddingBottom: 'calc(var(--sab) + 136px)' }}
          onScroll={(e) => {
            const y = e.currentTarget.scrollTop
            setScrolled(y > 60)
            e.currentTarget.style.setProperty('--par', String(Math.max(0, Math.min(y, 400))))
          }}
        >
          <div className="px-5">
            <p className="text-sous font-medium text-brume">{greeting()} {me.display_name}</p>
            <h1 className="break-words font-rond text-grand">Notre maison</h1>
            {familyLabel(family.name).toLowerCase() !== 'notre maison' && <p className="mt-1 text-sous text-brume">{familyLabel(family.name)}</p>}
          </div>



          {received.length > 0 || pendingThoughts.length > 0 ? <button onClick={() => go('recus')} className="presse mx-5 mt-5 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-[22px] bg-teinte-doux p-4 text-left">
            <Art name="geste-coeur" size={36} /><span className="flex-1"><span className="block text-corps font-semibold">{members.find(m => m.id === nextSender)?.display_name ?? 'Un proche'} pense à toi</span><span className="mt-1 block text-sous text-brume">Touche pour voir ce qu’on t’a envoyé</span></span><ChevronRight size={20} />
          </button> : null}

          {/* La maison et les proches restent au cœur de l’accueil. */}
          <div className="mx-4 mt-5">
            <div ref={houseRef} className="relative overflow-hidden rounded-[22px]">
              <div className="absolute right-2 top-[34%] z-20 flex gap-1" role="group" aria-label="Photos accrochées dans la maison">
                <button disabled={!photos.length} onClick={() => setSheet({k:'photosMaison',mode:'remove'})} aria-label="Retirer des photos de la maison" className="presse verre flex h-11 w-11 items-center justify-center rounded-full text-encre disabled:opacity-40"><Minus size={19} /></button>
                <button onClick={() => setSheet({k:'photosMaison',mode:'add'})} aria-label="Ajouter des photos à la maison" className="presse verre flex h-11 w-11 items-center justify-center rounded-full text-encre"><Plus size={19} /></button>
              </div>
              <House
                className="!aspect-[16/10]"
                type={family.house_type}
                items={houseItems}
                photos={photos}
                season={now}
                people={members.map((m) => ({ m, mood: isToday(m.mood_at) ? m.mood : null, label: m.id === me.id ? 'Moi' : m.display_name, me: m.id === me.id }))}
                onPerson={(m) => setSheet(m.id === me.id ? { k: 'humeur' } : { k: 'pensee', to: m })}
                scene={scene}
                onSceneEnd={() => setScene(null)}
                cares={state.cares}
                onCare={care}
                since={state.houseSince}
                petted={petted}
                onPet={petAnimal}
                pet={state.pet}
                plots={state.plots}
                gold={state.owned.includes('gamelle:or')}
              />
            </div>
          </div>
          {/* Les jeux toujours à portée (« À toi de jouer » quand une partie attend), puis le reste rangé dans « Explorer » */}
          <div className="no-bar mt-1 flex gap-2 overflow-x-auto px-5 py-2" aria-label="Les lieux de la maison">
            {[
              { k: 'jeux' as const, label: tours.length ? `À toi de jouer (${tours.length})` : 'Jouer ensemble', icon: <img src="./art/jeu-puissance4.webp" alt="" className="h-[30px] w-[30px] object-contain" /> },
            ].map((x) => (
              <button
                key={x.k}
                onClick={() => {
                  tap()
                  lieux.open({ k: x.k })
                }}
                className={`presse flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white pl-1.5 pr-3.5 text-sous font-semibold shadow-carte ${tours.length ? 'text-teinte-fonce ring-2 ring-inset ring-teinte' : 'text-encre'}`}
              >
                {x.icon} {x.label}
              </button>
            ))}
            {/* « Explorer » se voit : un aperçu de ce qu'il y a dedans (compagnon, potager, boutiques)
                et une flèche qui fait signe, jusqu'à la première visite */}
            <button
              onClick={() => {
                tap()
                setSheet({ k: 'explorer' })
                if (!explorerVu) {
                  setExplorerVu(true)
                  try {
                    localStorage.setItem('nidoo.explorer.vu', '1')
                  } catch {
                    /* stockage indisponible */
                  }
                }
              }}
              className="presse relative flex h-11 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3 text-sous font-bold text-white shadow-[0_3px_8px_rgba(102,70,204,0.3)]"
              style={{ background: 'linear-gradient(120deg, #8E6CF0, #6646CC)' }}
              aria-label="Explorer : compagnon, potager, centre commercial"
            >
              <span className="flex">
                {['pet-chat', 'plant-pousse'].map((a, i) => (
                  <img key={a} src={`./art/${a}.webp`} alt="" className={`h-8 w-8 rounded-full bg-white object-contain p-0.5 ring-2 ring-[#7A5AE0] ${i ? '-ml-1.5' : ''}`} />
                ))}
              </span>
              Explorer
              <ChevronRight size={18} strokeWidth={2.8} style={explorerVu ? undefined : { animation: 'faitSigne 1.6s ease-in-out infinite' }} />
              {!explorerVu && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-[#FF8A7A] ring-2 ring-fond" />}
            </button>
          </div>
          {/* Une chronique vivante, alimentée uniquement par les vrais moments de cette maison. */}
          <section className="mx-5 mt-3 rounded-[22px] bg-carte px-3.5 py-3 shadow-carte" aria-label="La vie de notre maison">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <h2 className="font-rond text-titre3">La vie de notre maison</h2>
              <span className="text-mini text-brume">À partager</span>
            </div>
            {histoires.map((h, index) => {
              const StoryIcon = h.kind === 'evenement' ? CalendarDays : h.kind === 'photo' ? Camera : h.kind === 'message' ? MessageCircleHeart : Heart
              return (
                <button
                  key={h.id}
                  onClick={() => {
                    tap()
                    if (h.event) setSheet({ k: 'evenement', e: h.event })
                    else go(h.target)
                  }}
                  className={`presse flex min-h-[66px] w-full items-center gap-3 rounded-[15px] px-2 py-2 text-left ${index ? 'border-t border-trait/50' : ''}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teinte-doux text-teinte-fonce">
                    <StoryIcon size={20} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-mini font-semibold text-teinte-fonce">{h.label}</span>
                    <span className="block truncate text-sous font-bold text-encre">{h.title}</span>
                    <span className="block truncate text-note text-brume">{h.detail}</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-brume" aria-hidden="true" />
                </button>
              )
            })}
          </section>
          {/* les proches : choisir quelqu'un, avec son prénom et son humeur (moi, je suis dans le jardin) */}
          {others.length > 0 && <p className="mx-5 mt-4 text-note font-semibold text-brume">Touche un proche pour lui faire signe</p>}
          {others.length > 0 && (
            <div
              className="no-bar mx-5 mt-2 flex gap-5 overflow-x-auto pb-2"
              aria-label="Les humeurs de la famille"
              // un fondu à droite montre qu'il y a d'autres proches en faisant glisser
              style={others.length > 4 ? { maskImage: 'linear-gradient(to right, #000 82%, transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 82%, transparent)', paddingRight: 24 } : undefined}
            >
              {others.map((m) => (
                <button key={m.id} onClick={() => setSheet({ k: 'pensee', to: m })} className="presse flex w-[68px] shrink-0 flex-col items-center gap-1">
                  <Avatar m={m} size={58} mood />
                  <span className="w-full truncate text-sous font-semibold">{m.display_name}</span>
                  <span className="w-full truncate text-note text-brume">{isToday(m.mood_at) && m.mood ? moodOf(m.mood)?.label ?? 'À partager' : 'Faire signe'}</span>
                </button>
              ))}
            </div>
          )}
          {anniv && others.length > 0 && (
            <button
              onClick={() => {
                tap()
                setSheet({ k: 'dessin', to: anniv.m?.id ?? null, carte: 'anniversaire' })
              }}
              className="presse mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-[24px] bg-[#FFE9EF] p-3 pr-4 text-left shadow-carte"
            >
              {anniv.m ? <Avatar m={anniv.m} size={48} /> : <Art name="picto-gateau" size={48} />}
              <span className="min-w-0 flex-1">
                <span className="block text-appel font-semibold">C’est l’anniversaire de {anniv.nom} !</span>
                <span className="block text-note text-brume">{anniv.m ? 'Envoie-lui une carte toute prête' : 'Envoie une carte à la famille'}</span>
              </span>
              <img src="./art/stickers/gateau.webp" alt="" className="h-12 w-12 shrink-0 rotate-6 object-contain" />
            </button>
          )}
          {others.length ? (
            <>
              <div className="mx-5 mt-4">
                <button onClick={() => setSheet({ k: 'dessin' })} className="presse ios-primary flex min-h-[54px] w-full items-center justify-center rounded-full text-corps font-bold text-white">Créer une attention</button>
              </div>
              <p className="mx-5 mt-2 text-center text-note text-brume">Un dessin, une photo ou une carte, pour un proche ou pour tous.</p>
            </>
          ) : (
            <div className="mx-5 mt-4 text-center">
              <p className="font-rond text-titre3">Tout commence avec un proche</p>
              <button onClick={() => void inviter()} className="presse ios-primary mt-3 flex min-h-[54px] w-full items-center justify-center rounded-full text-corps font-bold text-white">Inviter mes proches</button>
            </div>
          )}
          <DefisDuJour
            avent={av.visible ? { aOuvrir: caseDuJour, etoiles: av.today === 24 ? 3 : 1 } : null}
            onOpen={(d) => {
              if (d === 'avent') lieux.open({ k: 'avent' })
              else setSheet({ k: d === 'photo' ? 'defiPhoto' : d })
            }}
          />
          <button onClick={() => go('moments')} className="presse mx-5 mt-4 flex min-h-11 w-[calc(100%-2.5rem)] items-center justify-center gap-1 text-sous font-semibold text-teinte-fonce">Nos souvenirs <ChevronRight size={16} /></button>

        </div>
      </div>

      {sheet?.k === 'humeur' && <MoodSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'pensee' && <ThoughtSheet to={sheet.to} onClose={() => setSheet(null)} />}
      {sheet?.k === 'dessin' && <DrawSheet to={sheet.to} carte={sheet.carte} onClose={() => setSheet(null)} />}
      {sheet?.k === 'dessins' && <DrawingsSheet start={sheet.start} onClose={() => setSheet(null)} onDraw={(to) => setSheet({ k: 'dessin', to })} />}
      {sheet?.k === 'etoiles' && (
        <StarsSheet
          onClose={() => setSheet(null)}
          onDecorate={() => setSheet({ k: 'decor' })}
        />
      )}
      {sheet?.k === 'question' && <QuestionSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'photosMaison' && <HousePhotosSheet mode={sheet.mode} onClose={() => setSheet(null)} />}
      {sheet?.k === 'defiPhoto' && <ComposeSheet challenge={challengeOfDay()} onClose={() => setSheet(null)} />}
      {sheet?.k === 'evenement' && <EventDetailSheet event={sheet.e} onClose={() => setSheet(null)} />}
      {sheet?.k === 'mot' && <MotPage onClose={() => setSheet(null)} />}
      {sheet?.k === 'explorer' && (
        <Sheet title="Explorer" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-2.5 pb-2">
            {[
              ...(av.visible ? [{ k: 'avent' as const, label: 'Calendrier de l’Avent', hint: caseDuJour ? 'La case du jour t’attend' : 'Une case par jour', icon: <img src="./art/avent-sapin-mini.webp" alt="" className="h-14 w-14 object-contain" /> }] : []),
              { k: 'jeux' as const, label: 'Jouer ensemble', hint: tours.length ? `À toi de jouer (${tours.length})` : 'À deux ou en famille', icon: <img src="./art/jeu-puissance4.webp" alt="" className="h-14 w-14 object-contain" /> },
              { k: 'compagnon' as const, label: state.pet ? state.pet.name : 'Un compagnon', hint: state.pet ? 'Le compagnon de la maison' : 'Adopter un animal', icon: state.pet ? <PetFigure pet={state.pet} className="w-14" /> : <img src="./art/pet-chat.webp" alt="" className="h-14 w-14 object-contain" /> },
              { k: 'potager' as const, label: 'Le potager', hint: 'Planter et récolter', icon: <img src={`./art/${state.plots[0] ? state.plots[0].plant : 'plant-pousse'}.webp`} alt="" className="h-14 w-14 object-contain" /> },
              { k: 'centre' as const, label: 'Centre commercial', hint: 'Déco, vêtements, animalerie', icon: <img src="./art/centre-commercial.webp" alt="" className="h-14 w-[84px] object-contain" /> },
            ].map((x) => (
              <button
                key={x.k}
                onClick={() => {
                  tap()
                  setSheet(null)
                  lieux.open({ k: x.k })
                }}
                className="presse flex flex-col items-center gap-1 rounded-[22px] bg-carte px-2 pb-3 pt-4 text-center shadow-carte"
              >
                {x.icon}
                <span className="mt-1 text-sous font-bold">{x.label}</span>
                <span className="text-note text-brume">{x.hint}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet?.k === 'decor' && <DecorPage food={sheet.food} onClose={() => setSheet(null)} />}
      {!sheet && gone && (
        <GoneSheet
          entry={gone.entry}
          onClose={gone.seen}
          onAdopt={() => {
            gone.seen()
            if (gone.entry.reason.startsWith('parti:compagnon')) lieux.open({ k: 'compagnon' })
            else setSheet({ k: 'decor' })
          }}
        />
      )}
      {lieux.node}
    </>
  )
}
