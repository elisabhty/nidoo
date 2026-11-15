import { Check } from 'lucide-react'
import { useState } from 'react'
import House from '../components/House'
import { Btn } from '../components/ui'
import { useStore } from '../lib/store'
import { ago, errorText } from '../lib/util'

/** On a tapé le code : on attend qu'un responsable de la famille nous ouvre la porte. */
export default function Waiting() {
  const { requests, api, reload, toast } = useStore()
  const [busy, setBusy] = useState(false)
  const r = requests.find((x) => x.status === 'attente') ?? requests[0]
  if (!r) return null
  const refused = r.status === 'refusee'

  const drop = async () => {
    setBusy(true)
    try {
      await api.cancelRequest(r.id)
      await reload()
    } catch (e) {
      toast(errorText(e), 'err')
    }
    setBusy(false)
  }

  const steps = [
    { label: 'Code vérifié', done: true },
    { label: 'Demande envoyée à la famille', done: true },
    { label: refused ? 'Demande refusée' : 'Un responsable accepte ta demande', done: false },
  ]

  return (
    <div className="no-bar flex h-full flex-col overflow-y-auto bg-fond px-5" style={{ paddingTop: 'calc(var(--sat) + 24px)', paddingBottom: 'calc(var(--sab) + 18px)' }}>
      <div className="anim-entre flex flex-1 flex-col">
        <div className="relative mx-auto w-full overflow-hidden rounded-[28px] shadow-carte">
          <House type={r.house_type} items={[]} />
          <img src="./panda.webp" alt="" className={`absolute bottom-3 right-3 h-[64px] w-[64px] rounded-[18px] shadow-flottant ${refused ? '' : 'anim-flotte'}`} />
        </div>

        <h1 className="mt-6 text-center font-rond text-titre1">{refused ? 'Demande non acceptée' : 'Demande envoyée'}</h1>
        <p className="mx-auto mt-1.5 max-w-[310px] text-center text-sous text-brume">
          {refused
            ? `La famille ${r.family_name} n’a pas accepté ta demande. Vérifie avec eux le code qu’ils t’ont envoyé.`
            : `Un responsable de la famille ${r.family_name} doit t’ouvrir la porte. Dès qu’il accepte, tu entres : cet écran se met à jour tout seul.`}
        </p>

        <div className="groupe mt-6 shadow-carte">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3 pl-4">
              {s.done ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-vert text-white">
                  <Check size={14} strokeWidth={3.2} />
                </span>
              ) : refused ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rouge/15 text-[13px] font-bold text-rouge">✕</span>
              ) : (
                <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-[2.5px] border-teinte/25 border-t-teinte" />
              )}
              <span className={`flex min-h-[50px] flex-1 items-center pr-4 text-corps ${i < steps.length - 1 ? 'border-b border-trait' : ''} ${s.done ? '' : 'font-semibold'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        {!refused && <p className="px-4 pt-2 text-center text-note text-brume">Envoyée {ago(r.created_at)}. Tu ne vois rien de la famille tant que ta demande n’est pas acceptée.</p>}

        <div className="flex-1" />
        <Btn kind={refused ? 'plein' : 'gris'} className="mt-6" disabled={busy} onClick={drop}>
          {refused ? 'Compris' : 'Annuler ma demande'}
        </Btn>
      </div>
    </div>
  )
}
