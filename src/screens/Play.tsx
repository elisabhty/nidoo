import { Camera, Check, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AventCard } from '../components/avent'
import { pettedToday, useCare, usePet } from '../components/care'
import { DecorPage } from '../components/decor'
import { useLieux } from '../components/lieux'
import { PetFigure } from '../components/pet'
import House from '../components/House'
import { ComposeSheet } from '../components/sheets'
import { StarsSheet } from '../components/stars'
import { Art, Avatar, Btn, Lien, Screen, Section, Segments } from '../components/ui'
import { WeeklyChallenge } from '../components/weekly'
import { challengeOfDay, DECOS, petStage, questionOfDay, STAR_REASONS } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import { ago, todayKey } from '../lib/util'

export default function Play() {
  const { state, run } = useHome()
  const { family, me, members, answers, houseItems } = state
  const q = questionOfDay()
  const challenge = challengeOfDay()
  const [section, setSection] = useState<'jour' | 'maison'>('jour')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(false)
  const [stars, setStars] = useState(false)
  const [decor, setDecor] = useState<null | { food?: boolean }>(null)
  const [pic, setPic] = useState<{ blob: Blob; url: string } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const care = useCare(() => setDecor({ food: true }))
  const lieux = useLieux()
  const petAnimal = usePet()
  useEffect(() => () => void (pic && URL.revokeObjectURL(pic.url)), [pic])
  const mine = answers.find((a) => a.member_id === me.id)
  const challengeDone = state.moments.some((m) => m.member_id === me.id && m.challenge === challenge && todayKey(new Date(m.created_at)) === todayKey())
  const nextDeco = DECOS.find((d) => !houseItems.includes(d.key))
  const log = state.starLog.filter((s) => s.amount > 0).slice(0, 5)

  return (
    <>
      <Screen
        title="À vivre ensemble"
        trailing={
          <button onClick={() => setStars(true)} className="presse verre flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold" aria-label={`${family.stars} étoiles : comment en gagner`}>
            <Art name="picto-etoile" size={24} /> {family.stars}
          </button>
        }
      >
        <p className="-mt-1 px-5 text-sous text-brume">Un petit rituel pour se retrouver, chaque jour.</p>
        <div className="mx-5 my-5"><Segments value={section} onChange={setSection} options={[{key:'jour',label:'À vivre ensemble'},{key:'maison',label:'Notre progression'}]} /></div>
        {section === 'jour' && <>
        <div className="mx-5 mb-4 flex items-center gap-3">
          <div className="flex -space-x-2">{members.filter(m => answers.some(a => a.member_id === m.id)).slice(0,4).map(m => <Avatar key={m.id} m={m} size={32} />)}</div>
          <p className="text-note text-brume">{answers.length ? `${answers.length} réponse${answers.length > 1 ? 's' : ''} à découvrir` : 'Soyez les premiers à lancer le moment du jour.'}</p>
        </div>
        <div className="mx-4 mt-4 rounded-[28px] bg-white p-6 shadow-carte">
          <div className="flex items-center gap-2.5">
            <Art name="picto-bulle" size={30} />
            <p className="text-note font-semibold uppercase tracking-[0.03em] text-teinte">Question du jour</p>
          </div>
          <p className="mt-2 font-rond text-titre2">{q.text}</p>
          {mine ? (
            <div className="mt-3.5 space-y-2.5">
              {members.map((m) => {
                const a = answers.find((x) => x.member_id === m.id)
                return (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <Avatar m={m} size={34} />
                    <div className={`min-w-0 flex-1 rounded-[18px] rounded-tl-[6px] px-3.5 py-2 ${a ? (m.id === me.id ? 'bg-teinte text-white' : 'bg-remplissage') : 'bg-transparent px-0'}`}>
                      {a ? (
                        <>
                          {m.id !== me.id && <p className="text-legende font-semibold text-brume">{m.display_name}</p>}
                          {a.photo_url && <img src={a.photo_url} alt={`Photo de ${m.display_name}`} className="my-1.5 block max-h-[220px] w-full rounded-[14px] object-cover" />}
                          {a.answer && <p className="text-appel">{a.answer}</p>}
                        </>
                      ) : (
                        <p className="pt-1 text-sous text-pale">{m.display_name} pourra répondre à son rythme</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <form
              className="mt-3.5"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim() || pic) {
                  success()
                  void run((api) => api.answer(family.id, me.id, q.key, text, pic?.blob ?? null), '2 étoiles pour la maison')
                }
              }}
            >
              <input
                ref={picker}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) setPic({ blob: f, url: URL.createObjectURL(f) })
                }}
              />
              {pic && (
                <div className="relative mb-2.5 overflow-hidden rounded-[18px]">
                  <img src={pic.url} alt="Ta photo" className="block max-h-[240px] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      tap()
                      setPic(null)
                    }}
                    className="presse verre absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-encre"
                    aria-label="Retirer la photo"
                  >
                    <X size={16} strokeWidth={2.8} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <textarea aria-label="Ta réponse à la question du jour" rows={3} className="champ min-w-0 flex-1 resize-none" placeholder={pic ? 'Un mot avec ta photo (facultatif)' : 'Ta réponse'} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} />
                <button
                  type="button"
                  onClick={() => {
                    tap()
                    picker.current?.click()
                  }}
                  className="presse flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] bg-teinte-doux text-teinte-fonce"
                  aria-label={pic ? 'Changer la photo' : 'Répondre avec une photo'}
                >
                  <Camera size={21} strokeWidth={2.2} />
                </button>
              </div>
              <p className="px-1 pt-2 text-note text-brume">Réponds par un mot, une photo, ou les deux. Les réponses des autres apparaissent une fois la tienne envoyée.</p>
              <Btn type="submit" className="mt-3" disabled={!text.trim() && !pic}>Répondre</Btn>
            </form>
          )}
        </div>

        <div className="groupe mx-4 mt-3 flex items-center gap-3 p-3 pr-3.5 shadow-carte">
          <Art name="picto-photo" size={46} />
          <div className="min-w-0 flex-1">
            <p className="text-note font-semibold uppercase tracking-[0.03em] text-peche-fonce">Défi photo · 3 étoiles</p>
            <p className="text-appel font-medium">{challenge}</p>
          </div>
          {challengeDone ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-vert text-white"><Check size={18} strokeWidth={3} /></span>
          ) : (
            <button onClick={() => setPhoto(true)} className="presse h-9 shrink-0 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce">Relever</button>
          )}
        </div>
        <AventCard onOpen={() => lieux.open({ k: 'avent' })} />

        </>}
        {section === 'maison' && <>
        <WeeklyChallenge className="mt-3" />

        <Section title="Notre maison" hint="Chaque petit geste embellit votre maison.">
          <div className="mx-4 overflow-hidden rounded-[28px] bg-carte shadow-carte">
            <House
              type={family.house_type}
              items={houseItems}
              cares={state.cares}
              onCare={care}
              since={state.houseSince}
              petted={pettedToday(state.starLog, me.id)}
              onPet={petAnimal}
              pet={state.pet}
              plots={state.plots}
              gold={state.owned.includes('gamelle:or')}
            />
            <button
              onClick={() => {
                tap()
                setDecor({})
              }}
              className="presse-ligne flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {nextDeco ? <Art name={`deco-${nextDeco.key}`} size={40} /> : <Art name="picto-etoile" size={36} />}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sous font-semibold">{nextDeco ? `Prochaine : ${nextDeco.name}` : 'Maison complète, bravo !'}</span>
                  {nextDeco && <span className="shrink-0 text-note text-brume">{Math.min(family.stars, nextDeco.cost)}/{nextDeco.cost}</span>}
                </span>
                {nextDeco && (
                  <span className="mt-1.5 block h-[6px] overflow-hidden rounded-full bg-remplissage">
                    <span className="block h-full rounded-full bg-teinte transition-all duration-500" style={{ width: `${Math.min(100, (family.stars / nextDeco.cost) * 100)}%` }} />
                  </span>
                )}
              </span>
              <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />
            </button>
          </div>
          {/* les lieux : le compagnon, le potager, le centre commercial */}
          <div className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
            {[
              { k: 'compagnon' as const, label: state.pet ? state.pet.name : 'Compagnon', sub: state.pet ? petStage(state.pet.love).label : 'À choisir', art: state.pet ? null : 'pet-chat' },
              { k: 'potager' as const, label: 'Potager', sub: state.plots.length ? `${state.plots.length} parcelle${state.plots.length > 1 ? 's' : ''}` : houseItems.includes('potager') ? 'À semer' : 'À installer', art: state.plots[0] ? state.plots[0].plant : 'plant-pousse' },
              { k: 'centre' as const, label: 'Centre commercial', sub: 'Courses, jouets, mode', art: 'centre-commercial' },
            ].map((x) => (
              <button
                key={x.k}
                onClick={() => {
                  tap()
                  lieux.open({ k: x.k })
                }}
                className="presse groupe flex flex-col items-center px-1.5 pb-2.5 pt-3 text-center shadow-carte"
              >
                <span className="flex h-[58px] items-center justify-center">
                  {x.k === 'compagnon' && state.pet ? <PetFigure pet={state.pet} className="w-[58px]" /> : <img src={`./art/${x.art}.webp`} alt="" className={x.k === 'centre' ? 'w-[86px] object-contain' : 'h-[58px] w-[58px]'} />}
                </span>
                <span className="mt-1.5 w-full truncate text-legende font-semibold">{x.label}</span>
                <span className="w-full truncate text-mini text-brume">{x.sub}</span>
              </button>
            ))}
          </div>
          <div className="mx-4 mt-3">
            <Btn onClick={() => setDecor({})}>Décorer la maison</Btn>
          </div>
        </Section>

        {log.length > 0 && (
          <Section title="Dernières étoiles">
            <div className="groupe mx-4 shadow-carte">
              {log.map((s, i) => {
                const m = members.find((x) => x.id === s.member_id)
                const what = STAR_REASONS[s.reason] ?? ''
                return (
                  <div key={s.id} className="flex items-center gap-3 pl-3.5">
                    {m ? <Avatar m={m} size={34} /> : <span className="h-[34px] w-[34px] rounded-full bg-remplissage" />}
                    <div className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 ${i < log.length - 1 ? 'border-b border-trait' : ''}`}>
                      <p className="min-w-0 flex-1 text-sous">
                        <span className="font-semibold">{m ? (m.id === me.id ? 'Tu' : m.display_name) : 'Un proche'}</span>{' '}
                        {m?.id === me.id ? what.replace(/^a /, 'as ').replace('son humeur', 'ton humeur') : what}
                        <span className="block text-note text-brume">{ago(s.created_at)}</span>
                      </p>
                      <span className="flex items-center gap-1 text-sous font-semibold text-brume">+{s.amount} <Art name="picto-etoile" size={16} /></span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}
        </>}
      </Screen>
      {photo && <ComposeSheet challenge={challenge} onClose={() => setPhoto(false)} />}
      {stars && (
        <StarsSheet
          onClose={() => setStars(false)}
          onDecorate={() => {
            setStars(false)
            setDecor({})
          }}
        />
      )}
      {decor && <DecorPage food={decor.food} onClose={() => setDecor(null)} />}
      {lieux.node}
    </>
  )
}
