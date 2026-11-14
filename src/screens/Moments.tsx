import { Camera, PenLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ComposeSheet } from '../components/sheets'
import { Avatar, Vide } from '../components/ui'
import { REACTIONS } from '../lib/data'
import { useHome } from '../lib/store'
import { ago } from '../lib/util'

export default function Moments() {
  const { state, run } = useHome()
  const [compose, setCompose] = useState<null | 'photo' | 'mot'>(null)
  const { me, members, moments, reactions } = state

  return (
    <>
      <div className="no-bar h-full overflow-y-auto pb-32" style={{ paddingTop: 'calc(var(--sat) + 14px)' }}>
        <div className="flex items-end justify-between px-5">
          <h1 className="titre text-[32px] leading-none">Moments</h1>
          <div className="flex gap-2">
            <button onClick={() => setCompose('mot')} className="appui flex h-11 w-11 items-center justify-center rounded-full bg-white text-encre shadow-carte" aria-label="Écrire un petit mot">
              <PenLine size={19} />
            </button>
            <button onClick={() => setCompose('photo')} className="appui flex h-11 items-center gap-2 rounded-full bg-encre px-4 text-[14.5px] font-bold text-white shadow-doux">
              <Camera size={18} /> Photo
            </button>
          </div>
        </div>
        <p className="mt-1.5 px-5 text-[14.5px] text-brume">Les instants partagés par la famille, du plus récent au plus ancien.</p>

        <div className="mt-5 space-y-4">
          {moments.length === 0 && (
            <Vide emoji="📸" title="Le mur est encore vide" text="Une photo de ton café, de ta vue, de ta tête : c’est souvent ce qui fait le plus plaisir." />
          )}
          {moments.map((mo) => {
            const by = members.find((m) => m.id === mo.member_id)
            if (!by) return null
            const rs = reactions.filter((r) => r.moment_id === mo.id)
            const mine = rs.find((r) => r.member_id === me.id)?.emoji
            const counts = REACTIONS.map((e) => ({ e, n: rs.filter((r) => r.emoji === e).length }))
            return (
              <article key={mo.id} className="carte mx-5 overflow-hidden">
                <header className="flex items-center gap-3 px-3.5 pb-2.5 pt-3.5">
                  <Avatar m={by} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-extrabold">{by.id === me.id ? 'Moi' : by.display_name}</p>
                    <p className="text-[12.5px] text-brume">{ago(mo.created_at)}</p>
                  </div>
                  {by.id === me.id && (
                    <button
                      onClick={() => window.confirm('Retirer ce moment pour toute la famille ?') && run((api) => api.deleteMoment(mo), 'Moment retiré')}
                      className="appui flex h-9 w-9 items-center justify-center rounded-full text-brume"
                      aria-label="Retirer ce moment"
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </header>
                {mo.challenge && <p className="mx-3.5 mb-2.5 inline-block rounded-full bg-peche-100 px-3 py-1 text-[12.5px] font-bold">📸 Défi : {mo.challenge}</p>}
                {mo.image_url && <img src={mo.image_url} alt={mo.body ?? `Photo de ${by.display_name}`} loading="lazy" className="max-h-[70vh] w-full object-cover" />}
                {mo.body && (
                  <p className={mo.image_url ? 'px-4 pt-3 text-[15.5px] leading-snug' : 'px-4 pb-1 font-titre text-[20px] font-medium leading-snug'}>{mo.body}</p>
                )}
                <div className="flex gap-1.5 px-3 pb-3 pt-3">
                  {counts.map(({ e, n }) => (
                    <button
                      key={e}
                      onClick={() => run((api) => api.react(mo, me.id, mine === e ? null : e))}
                      aria-pressed={mine === e}
                      aria-label={`Réagir ${e}`}
                      className={`appui flex h-9 items-center gap-1 rounded-full px-2.5 text-[16px] ${mine === e ? 'bg-lavande-200' : n ? 'bg-lavande-50' : 'bg-transparent opacity-60'}`}
                    >
                      {e}
                      {n > 0 && <span className="text-[12.5px] font-extrabold text-encre">{n}</span>}
                    </button>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </div>
      {compose && <ComposeSheet startWith={compose} onClose={() => setCompose(null)} />}
    </>
  )
}
