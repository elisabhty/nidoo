import { Check, Lock, Star } from 'lucide-react'
import { useState } from 'react'
import House from '../components/House'
import { ComposeSheet } from '../components/sheets'
import { Avatar, Btn, Section } from '../components/ui'
import { challengeOfDay, DECOS, questionOfDay, STAR_REASONS } from '../lib/data'
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
      <div className="no-bar h-full overflow-y-auto pb-32" style={{ paddingTop: 'calc(var(--sat) + 14px)' }}>
        <div className="flex items-end justify-between px-5">
          <h1 className="titre text-[32px] leading-none">Jouer</h1>
          <span className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[15px] font-extrabold shadow-carte">
            <Star size={17} className="fill-[#F6B93B] text-[#F6B93B]" /> {family.stars}
          </span>
        </div>

        <div className="mx-5 mt-5 rounded-4xl bg-lavande-100 p-5">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-lavande-600">Question du jour</p>
          <p className="titre mt-1.5 text-[22px] leading-snug">{q.text}</p>
          {mine ? (
            <div className="mt-4 space-y-2">
              {members.map((m) => {
                const a = answers.find((x) => x.member_id === m.id)
                return (
                  <div key={m.id} className="flex items-start gap-2.5 rounded-2xl bg-white px-3 py-2.5">
                    <Avatar m={m} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-extrabold text-brume">{m.id === me.id ? 'Moi' : m.display_name}</p>
                      <p className={`text-[15px] leading-snug ${a ? 'font-semibold' : 'text-brume/70'}`}>{a ? a.answer : 'N’a pas encore répondu'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim()) void run((api) => api.answer(family.id, me.id, q.key, text), '+2 étoiles pour la maison')
              }}
            >
              <input className="champ" placeholder="Ta réponse…" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} />
              <p className="mt-2 text-[12.5px] text-brume">Les réponses des autres apparaissent une fois la tienne envoyée.</p>
              <Btn type="submit" className="mt-3" disabled={!text.trim()}>Répondre · +2 ⭐</Btn>
            </form>
          )}
        </div>

        <div className="mx-5 mt-3 flex items-center gap-3 rounded-4xl bg-peche-100 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[24px]">📸</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-peche-500">Défi photo</p>
            <p className="text-[15.5px] font-bold leading-snug">{challenge}</p>
          </div>
          {challengeDone ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-mousse"><Check size={20} /></span>
          ) : (
            <button onClick={() => setPhoto(true)} className="appui h-10 shrink-0 rounded-full bg-encre px-4 text-[14px] font-bold text-white">+3 ⭐</button>
          )}
        </div>

        <Section title="Décorer la maison">
          <div className="mx-5 overflow-hidden rounded-4xl bg-white shadow-doux">
            <House type={family.house_type} members={members} items={houseItems} className="block w-full" />
            {nextDeco && (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-[13px] font-bold">
                  <span>Prochaine : {nextDeco.emoji} {nextDeco.name}</span>
                  <span className="text-brume">{Math.min(family.stars, nextDeco.cost)}/{nextDeco.cost}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-lavande-100">
                  <div className="h-full rounded-full bg-lavande-400 transition-all" style={{ width: `${Math.min(100, (family.stars / nextDeco.cost) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="mx-5 mt-3 grid grid-cols-3 gap-2.5">
            {DECOS.map((d) => {
              const owned = houseItems.includes(d.key)
              const can = family.stars >= d.cost
              return (
                <button
                  key={d.key}
                  disabled={owned || !can}
                  onClick={() => run((api) => api.unlock(family.id, d.key), `${d.name} : installé dans la maison`)}
                  className={`appui relative flex flex-col items-center rounded-3xl px-1.5 pb-2.5 pt-3 text-center ${owned ? 'bg-lavande-100' : 'bg-white shadow-carte'} ${!owned && !can ? 'opacity-55' : ''}`}
                  aria-label={`${d.name}, ${owned ? 'déjà installé' : `${d.cost} étoiles`}`}
                >
                  <span className="text-[30px] leading-none">{d.emoji}</span>
                  <span className="mt-1.5 line-clamp-2 min-h-[30px] text-[12px] font-bold leading-tight">{d.name}</span>
                  <span className={`mt-1 flex items-center gap-1 text-[12.5px] font-extrabold ${owned ? 'text-lavande-600' : 'text-encre'}`}>
                    {owned ? <><Check size={13} /> Installé</> : <>{!can && <Lock size={11} />}<Star size={12} className="fill-[#F6B93B] text-[#F6B93B]" /> {d.cost}</>}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        {log.length > 0 && (
          <Section title="Les dernières étoiles">
            <div className="carte mx-5 divide-y divide-lavande-50 px-4">
              {log.map((s) => {
                const m = members.find((x) => x.id === s.member_id)
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    {m ? <Avatar m={m} size={32} /> : <span className="h-8 w-8 rounded-full bg-lavande-100" />}
                    <p className="min-w-0 flex-1 text-[14px] leading-snug">
                      <b>{m ? (m.id === me.id ? 'Tu' : m.display_name) : 'Un proche'}</b>{' '}
                      {m?.id === me.id ? (STAR_REASONS[s.reason] ?? '').replace(/^a /, 'as ').replace('sa météo', 'ta météo') : STAR_REASONS[s.reason]}
                      <span className="block text-[12px] text-brume">{ago(s.created_at)}</span>
                    </p>
                    <span className="text-[14px] font-extrabold text-lavande-600">+{s.amount}</span>
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>
      {photo && <ComposeSheet challenge={challenge} onClose={() => setPhoto(false)} />}
    </>
  )
}
