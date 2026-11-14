import { Camera, Ellipsis, PenLine } from 'lucide-react'
import { useState } from 'react'
import { ComposeSheet } from '../components/sheets'
import { Art, Avatar, Btn, confirmer, Rond, Screen, Vide } from '../components/ui'
import { REACTIONS } from '../lib/data'
import { select } from '../lib/haptic'
import { useHome } from '../lib/store'
import { ago } from '../lib/util'

export default function Moments() {
  const { state, run } = useHome()
  const [compose, setCompose] = useState<null | 'photo' | 'mot'>(null)
  const { me, members, moments, reactions } = state

  return (
    <>
      <Screen
        title="Moments"
        trailing={
          <>
            <Rond label="Écrire un petit mot" onClick={() => setCompose('mot')}><PenLine size={19} /></Rond>
            <Rond label="Photo surprise" tint onClick={() => setCompose('photo')}><Camera size={19} /></Rond>
          </>
        }
      >
        {moments.length === 0 && (
          <Vide art="picto-photo" title="Le mur est encore vide" text="Une photo de ton café, de ta vue, de ta tête : c’est souvent ce qui fait le plus plaisir.">
            <Btn onClick={() => setCompose('photo')}>Photo surprise</Btn>
          </Vide>
        )}
        <div className="mt-2 space-y-4">
          {moments.map((mo) => {
            const by = members.find((m) => m.id === mo.member_id)
            if (!by) return null
            const rs = reactions.filter((r) => r.moment_id === mo.id)
            const mine = rs.find((r) => r.member_id === me.id)?.emoji
            return (
              <article key={mo.id} className="groupe mx-4 shadow-carte">
                <header className="flex items-center gap-3 py-3 pl-3.5 pr-2">
                  <Avatar m={by} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-appel font-semibold">{by.id === me.id ? 'Moi' : by.display_name}</p>
                    <p className="text-note text-brume">{ago(mo.created_at)}{mo.challenge ? ' · Défi photo' : ''}</p>
                  </div>
                  {by.id === me.id && (
                    <button
                      onClick={async () =>
                        (await confirmer({ title: 'Ce moment sera retiré pour toute la famille.', confirm: 'Retirer le moment', destructive: true })) &&
                        run((api) => api.deleteMoment(mo), 'Moment retiré')
                      }
                      className="presse flex h-11 w-11 items-center justify-center text-brume"
                      aria-label="Options du moment"
                    >
                      <Ellipsis size={20} />
                    </button>
                  )}
                </header>
                {mo.image_url && <img src={mo.image_url} alt={mo.body ?? `Photo de ${by.display_name}`} loading="lazy" className="max-h-[70vh] w-full object-cover" />}
                {mo.challenge && <p className="px-4 pt-3 text-note font-semibold text-peche-fonce">{mo.challenge}</p>}
                {mo.body && <p className={mo.image_url ? 'px-4 pt-2.5 text-appel' : 'px-4 pb-1 font-rond text-titre3 font-medium'}>{mo.body}</p>}
                <div className="flex gap-1.5 px-3 pb-3 pt-3">
                  {REACTIONS.map((r) => {
                    const n = rs.filter((x) => x.emoji === r.key).length
                    const on = mine === r.key
                    return (
                      <button
                        key={r.key}
                        onClick={() => {
                          select()
                          void run((api) => api.react(mo, me.id, on ? null : r.key))
                        }}
                        aria-pressed={on}
                        aria-label={r.label}
                        className={`presse flex h-9 items-center gap-1 rounded-full px-2 ${on ? 'bg-teinte-doux ring-[1.5px] ring-teinte' : 'bg-remplissage'} ${!n && !on ? 'opacity-60' : ''}`}
                      >
                        <Art name={r.art} size={22} />
                        {n > 0 && <span className={`pr-0.5 text-note font-semibold ${on ? 'text-teinte-fonce' : 'text-encre'}`}>{n}</span>}
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      </Screen>
      {compose && <ComposeSheet startWith={compose} onClose={() => setCompose(null)} />}
    </>
  )
}
