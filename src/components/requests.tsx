import { ShieldCheck } from 'lucide-react'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { JoinRequest } from '../lib/types'
import { ago } from '../lib/util'
import { Avatar, confirmer } from './ui'

/** Demandes d'entrée, visibles par les responsables : accepter ou refuser, en un geste. */
export function JoinRequests({ className = '' }: { className?: string }) {
  const { state, run } = useHome()
  if (!state.requests.length) return null

  const accept = (r: JoinRequest) => {
    success()
    void run((api) => api.answerRequest(r.id, true), `${r.display_name} fait maintenant partie de la famille`)
  }
  const refuse = async (r: JoinRequest) => {
    const ok = await confirmer({
      title: `Refuser ${r.display_name} ?`,
      message: 'Cette personne n’entrera pas et ne verra rien de la famille.',
      confirm: 'Refuser',
      destructive: true,
    })
    if (ok) void run((api) => api.answerRequest(r.id, false), 'Demande refusée')
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {state.requests.map((r) => (
        <div key={r.id} className="anim-entre groupe mx-4 p-3.5 shadow-carte ring-1 ring-teinte/15">
          <div className="flex items-center gap-3">
            <span className="relative">
              <Avatar m={r} size={46} />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-teinte text-white ring-2 ring-white">
                <ShieldCheck size={12} strokeWidth={2.6} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-appel font-semibold">{r.display_name} veut entrer</p>
              <p className="truncate text-note text-brume">A tapé le code d’invitation · {ago(r.created_at)}</p>
            </div>
          </div>
          <p className="mt-2.5 rounded-[12px] bg-remplissage px-3 py-2 text-note text-encre/80">
            Accepte seulement si tu sais qui c’est : une fois dans la famille, cette personne voit la maison, les humeurs, le fil et l’agenda.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                tap()
                void refuse(r)
              }}
              className="presse h-11 rounded-full bg-remplissage text-sous font-semibold text-encre"
            >
              Refuser
            </button>
            <button onClick={() => accept(r)} className="presse h-11 rounded-full bg-teinte text-sous font-semibold text-white">
              Accepter
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
