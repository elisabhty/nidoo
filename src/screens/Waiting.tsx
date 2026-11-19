import { Check, Clock } from 'lucide-react'
import { useState } from 'react'
import House from '../components/House'
import { Btn } from '../components/ui'
import { useStore } from '../lib/store'
import { ago, errorText, familyLabel } from '../lib/util'

/** On a tapé le code : on attend qu'un responsable de la famille nous ouvre la porte. */
export default function Waiting() {
  const { requests, api, reload, toast } = useStore()
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const check = async () => {
    setChecking(true)
    try { await reload(); setChecked(true) } catch(e) { toast(errorText(e), 'err') }
    setChecking(false)
  }
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
    { label: 'Demande envoyée à la maison', done: true },
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
            ? `« ${familyLabel(r.family_name)} » n’a pas accepté ta demande. Vérifie le code qu’on t’a envoyé.`
            : `Un responsable de « ${familyLabel(r.family_name)} » doit t’ouvrir la porte. Dès qu’il accepte, tu entres : cet écran se met à jour tout seul.`}
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
                <Clock size={24} className="shrink-0 text-teinte" />
              )}
              <span className={`flex min-h-[50px] flex-1 items-center pr-4 text-corps ${i < steps.length - 1 ? 'border-b border-trait' : ''} ${s.done ? '' : 'font-semibold'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        {!refused && <p className="px-4 pt-2 text-center text-note text-brume">Envoyée {ago(r.created_at)}. Tu ne vois rien de la maison tant que ta demande n’est pas acceptée.</p>}

        {!refused && <><p className="mt-5 text-center text-sous text-brume">Tu peux fermer l’application et revenir plus tard avec ce même appareil.</p><Btn className="mt-4" disabled={checking || busy} onClick={() => void check()}>{checking ? 'Vérification…' : 'Vérifier ma demande'}</Btn>{checked && <p role="status" className="mt-2 text-center text-note text-brume">Ta demande est toujours en attente de validation.</p>}</>}
        <div className="flex-1" />
        <Btn kind={refused ? 'plein' : 'gris'} className="mt-6" disabled={busy || checking} onClick={drop}>
          {busy ? 'Un instant…' : refused ? 'Revenir à l’accueil' : 'Annuler ma demande'}
        </Btn>
      </div>
    </div>
  )
}
