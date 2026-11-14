import { Check, Lock } from 'lucide-react'
import { useState } from 'react'
import House from '../components/House'
import { ComposeSheet } from '../components/sheets'
import { Art, Avatar, Btn, Screen, Section } from '../components/ui'
import { challengeOfDay, DECOS, questionOfDay, STAR_REASONS } from '../lib/data'
import { success } from '../lib/haptic'
import { useHome } from '../lib/store'
import { ago, todayKey } from '../lib/util'

export default function Play() {
  const { state, run } = useHome()
  const { family, me, members, answers, houseItems } = state
  const q = questionOfDay()
  const challenge = challengeOfDay()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(false)
  const mine = answers.find((a) => a.member_id === me.id)
  const challengeDone = state.moments.some((m) => m.member_id === me.id && m.challenge === challenge && todayKey(new Date(m.created_at)) === todayKey())
  const nextDeco = DECOS.find((d) => !houseItems.includes(d.key))
  const log = state.starLog.filter((s) => s.amount > 0).slice(0, 5)

  return (
    <>
      <Screen
        title="Jouer"
        trailing={
          <span className="verre flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold" aria-label={`${family.stars} étoiles`}>
            <Art name="picto-etoile" size={24} /> {family.stars}
          </span>
        }
      >
        <p className="-mt-1 mb-3 px-5 text-sous text-brume">
          Chaque geste rapporte des étoiles à toute la famille : une météo (1), un câlin (1), une mission (1), la question du jour (2), une photo (3). Elles servent à décorer la maison.
        </p>
        <div className="groupe mx-4 mt-2 p-4 shadow-carte">
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
                          <p className="text-appel">{a.answer}</p>
                        </>
                      ) : (
                        <p className="pt-1 text-sous text-pale">{m.display_name} n’a pas encore répondu</p>
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
                if (text.trim()) {
                  success()
                  void run((api) => api.answer(family.id, me.id, q.key, text), '2 étoiles pour la maison')
                }
              }}
            >
              <input className="champ" placeholder="Ta réponse" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} />
              <p className="px-1 pt-2 text-note text-brume">Les réponses des autres apparaissent une fois la tienne envoyée.</p>
              <Btn type="submit" className="mt-3" disabled={!text.trim()}>Répondre</Btn>
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

        <Section title="Décorer la maison">
          <div className="mx-4 overflow-hidden rounded-[28px] bg-carte shadow-carte">
            <House type={family.house_type} items={houseItems} />
            {nextDeco && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Art name={`deco-${nextDeco.key}`} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="truncate text-sous font-semibold">{nextDeco.name}</span>
                    <span className="text-note text-brume">{Math.min(family.stars, nextDeco.cost)}/{nextDeco.cost}</span>
                  </div>
                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-remplissage">
                    <div className="h-full rounded-full bg-teinte transition-all duration-500" style={{ width: `${Math.min(100, (family.stars / nextDeco.cost) * 100)}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
            {DECOS.map((d) => {
              const owned = houseItems.includes(d.key)
              const can = family.stars >= d.cost
              return (
                <button
                  key={d.key}
                  disabled={owned || !can}
                  onClick={() => {
                    success()
                    void run((api) => api.unlock(family.id, d.key), `${d.name} : installé`)
                  }}
                  className="presse groupe relative flex flex-col items-center px-1.5 pb-2.5 pt-3 text-center shadow-carte"
                  aria-label={`${d.name}, ${owned ? 'déjà installé' : `${d.cost} étoiles`}`}
                >
                  <Art name={`deco-${d.key}`} size={58} className={!owned && !can ? 'opacity-55' : ''} />
                  <span className="mt-1.5 line-clamp-2 flex min-h-[32px] items-center text-legende font-medium">{d.name}</span>
                  {owned ? (
                    <span className="mt-1.5 flex h-[26px] items-center gap-1 rounded-full bg-remplissage px-2.5 text-legende font-semibold text-brume"><Check size={13} strokeWidth={3} /> Installé</span>
                  ) : (
                    <span className={`mt-1.5 flex h-[26px] items-center gap-1 rounded-full px-2.5 text-legende font-semibold ${can ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}>
                      {can ? <Art name="picto-etoile" size={15} /> : <Lock size={11} strokeWidth={2.6} />} {d.cost}
                    </span>
                  )}
                </button>
              )
            })}
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
                        {m?.id === me.id ? what.replace(/^a /, 'as ').replace('sa météo', 'ta météo') : what}
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
      </Screen>
      {photo && <ComposeSheet challenge={challenge} onClose={() => setPhoto(false)} />}
    </>
  )
}
