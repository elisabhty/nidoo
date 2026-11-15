import { Ellipsis } from 'lucide-react'
import { Art, Avatar, Btn, confirmer, Vide } from '../components/ui'
import { REACTIONS } from '../lib/data'
import { select } from '../lib/haptic'
import { useHome } from '../lib/store'
import { useState } from 'react'
import { DrawingCanvas, whatOf } from '../components/drawing'
import { DRAW_H, DRAW_W } from '../lib/drawing'
import type { Drawing, Moment } from '../lib/types'
import { ago } from '../lib/util'

// Le fil de la famille : photos, dessins et petits mots envoyés à tout le monde.

function Carte({ mo }: { mo: Moment }) {
  const { state, run } = useHome()
  const { me, members, reactions } = state
  const by = members.find((m) => m.id === mo.member_id)
  if (!by) return null
  const rs = reactions.filter((r) => r.moment_id === mo.id)
  const mine = rs.find((r) => r.member_id === me.id)?.emoji

  return (
    <article className="groupe mx-4 shadow-carte">
      <header className="flex items-center gap-3 py-3 pl-3.5 pr-2">
        <Avatar m={by} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-appel font-semibold">{by.id === me.id ? 'Moi' : by.display_name}</p>
          <p className="truncate text-note text-brume">
            {ago(mo.created_at)}
            {mo.challenge ? ' · Défi photo' : ''}
          </p>
        </div>
        {by.id === me.id ? (
          <button
            onClick={async () =>
              (await confirmer({ title: 'Ce moment sera supprimé pour toute la famille.', confirm: 'Supprimer', destructive: true })) &&
              run((api) => api.deleteMoment(mo), 'Moment supprimé')
            }
            className="presse flex h-11 w-11 items-center justify-center text-brume"
            aria-label="Options du moment"
          >
            <Ellipsis size={20} />
          </button>
        ) : (
          <span className="w-3" />
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
}

/** Une attention (photo et/ou dessin) envoyée à toute la famille : il se refait sous les yeux quand on le touche. */
function Instant({ d }: { d: Drawing }) {
  const { state, run } = useHome()
  const { me, members } = state
  const by = members.find((m) => m.id === d.from_member)
  const [play, setPlay] = useState(0)
  if (!by) return null
  const what = whatOf(d)
  return (
    <article className="groupe mx-4 shadow-carte">
      <header className="flex items-center gap-3 py-3 pl-3.5 pr-2">
        <Avatar m={by} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-appel font-semibold">{by.id === me.id ? 'Moi' : by.display_name}</p>
          <p className="truncate text-note text-brume">
            {ago(d.created_at)} · {what.replace(/^une? /, '').replace(/^./, (c) => c.toUpperCase())}
          </p>
        </div>
        {by.id === me.id ? (
          <button
            onClick={async () =>
              (await confirmer({ title: 'Cet instant sera supprimé pour toute la famille.', confirm: 'Supprimer', destructive: true })) &&
              run((api) => api.deleteDrawing(d.id), 'Supprimé')
            }
            className="presse flex h-11 w-11 items-center justify-center text-brume"
            aria-label="Options"
          >
            <Ellipsis size={20} />
          </button>
        ) : (
          <span className="w-3" />
        )}
      </header>
      <button
        onClick={() => {
          select()
          setPlay((n) => n + 1)
        }}
        className="block w-full overflow-hidden"
        style={{ aspectRatio: `${DRAW_W} / ${DRAW_H}`, background: d.data.bg }}
        aria-label={`Revoir ${what}`}
      >
        <DrawingCanvas data={d.data} id={d.id} play={play} photo={d.photo_url} />
      </button>
      <span className="block h-3" />
    </article>
  )
}

export default function Fil({ onCompose }: { onCompose: () => void }) {
  const { state } = useHome()
  const items = [
    ...state.moments.map((mo) => ({ at: mo.created_at, el: <Carte key={mo.id} mo={mo} /> })),
    ...state.drawings.filter((d) => !d.to_member).map((d) => ({ at: d.created_at, el: <Instant key={d.id} d={d} /> })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  if (items.length === 0) {
    return (
      <Vide art="picto-photo" title="Le fil est encore vide" text="Une photo de ton café, de ta vue, un petit dessin : c’est souvent ce qui fait le plus plaisir.">
        <Btn onClick={onCompose}>Créer une attention</Btn>
      </Vide>
    )
  }
  return <div className="space-y-4">{items.map((x) => x.el)}</div>
}
