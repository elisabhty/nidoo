// « Je suis en route » (Elisa, 26 novembre, d'après la liste « Prévenir sa famille que l'on est sur le chemin du
// retour ») : dans combien de temps j'arrive, qui prévenir, et le petit mot tel qu'ils le liront. Il part comme tous
// les petits mots : dans l'appli, et sur leur widget des attentions.
import { Car, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { arrivee, boutonPrevenir, DELAIS, libelleDelai, messageEnRoute, texteHeure } from '../lib/enRoute'
import { select, success } from '../lib/haptic'
import { scenesDejaVues } from '../lib/scenes'
import { useHome } from '../lib/store'
import type { Member } from '../lib/types'
import { Avatar, Btn, Sheet } from './ui'

export function EnRouteSheet({ onClose }: { onClose: () => void }) {
  const { state, run } = useHome()
  // ceux qui ont NIDOO sur leur téléphone (un petit mot ne va pas à un bébé)
  const proches = useMemo(() => state.members.filter((m) => m.user_id && m.id !== state.me.id), [state.members, state.me.id])
  const [dans, setDans] = useState<number | null>(15)
  const [pour, setPour] = useState<string[]>(() => proches.map((m) => m.id))
  const [etat, setEtat] = useState<'pret' | 'envoi' | 'envoye'>('pret')
  // l'heure d'arrivée reste juste si la fiche reste ouverte un moment
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])
  const choisis = proches.filter((m) => pour.includes(m.id))
  const tous = choisis.length === proches.length
  const heure = dans == null ? null : texteHeure(arrivee(maintenant, dans))

  const basculer = (id: string) => {
    select()
    setPour((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }
  const envoyer = async () => {
    if (etat !== 'pret' || !choisis.length) return
    setEtat('envoi')
    let ids: string[] = []
    const ok = await run(async (a) => {
      ids = await a.sendThoughts(state.family.id, state.me.id, choisis.map((m) => m.id), 'mot', messageEnRoute(dans, Date.now()))
    })
    if (!ok) {
      setEtat('pret')
      return
    }
    // l'envoi se voit ici (le bouton) : pas une scène par proche en revenant à l'accueil
    scenesDejaVues(ids)
    success()
    setEtat('envoye')
    window.setTimeout(onClose, 1100)
  }
  const puce = (on: boolean) => `presse choix-pop flex items-center gap-1.5 rounded-full py-[7px] text-[14.5px] font-semibold transition-colors duration-200 ${on ? 'bg-teinte text-white' : 'bg-doux text-encre'}`

  return (
    <Sheet
      title="Je suis en route"
      onClose={() => etat !== 'envoi' && onClose()}
      footer={
        // envoyé : le bouton reste violet, avec sa coche, le temps que la fiche se ferme
        <Btn onClick={() => void envoyer()} disabled={etat === 'envoi'} manque={choisis.length ? null : 'au moins un proche'}>
          {etat === 'envoye' ? (
            <span key="ok" className="anim-pop flex items-center gap-1.5">
              <Check size={19} strokeWidth={3} /> C’est envoyé
            </span>
          ) : etat === 'envoi' ? (
            'J’envoie…'
          ) : (
            boutonPrevenir(choisis.map((m) => m.display_name), proches.length)
          )}
        </Btn>
      }
    >
      <div className="flex flex-col items-center pb-4 pt-1 text-center">
        <span className="anim-pop flex h-16 w-16 items-center justify-center rounded-full bg-peche-doux text-peche-fonce">
          <Car size={30} strokeWidth={2.2} />
        </span>
        <p className="mt-2.5 max-w-[300px] text-note text-brume">Tes proches reçoivent un petit mot, dans l’appli et sur leur widget.</p>
      </div>

      {/* dans combien de temps */}
      <section className="carte-evt rounded-[20px] bg-carte p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-corps font-bold">J’arrive dans…</h3>
          {heure && (
            <span key={heure} className="anim-entre whitespace-nowrap text-note font-semibold text-teinte-fonce">
              vers {heure}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="J’arrive dans">
          {DELAIS.map((d) => (
            <button
              key={String(d)}
              type="button"
              role="radio"
              aria-checked={dans === d}
              onClick={() => (select(), setDans(d))}
              className={`${puce(dans === d)} justify-center px-2 ${d == null ? 'col-span-2' : ''}`}
            >
              {libelleDelai(d)}
            </button>
          ))}
        </div>
      </section>

      {/* qui prévenir : tout le monde, au départ */}
      <section className="carte-evt mt-3 rounded-[20px] bg-carte p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-corps font-bold">Prévenir</h3>
          {proches.length > 1 && (
            <button type="button" onClick={() => (select(), setPour(tous ? [] : proches.map((m) => m.id)))} className="presse -my-2 min-h-11 px-1 text-note font-semibold text-teinte-fonce">
              {tous ? 'Personne' : 'Tout le monde'}
            </button>
          )}
        </div>
        {proches.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Qui prévenir">
            {proches.map((m) => (
              <PuceProche key={m.id} m={m} on={pour.includes(m.id)} classe={puce(pour.includes(m.id))} onClick={() => basculer(m.id)} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-note text-brume">Personne d’autre n’a encore NIDOO sur son téléphone.</p>
        )}
      </section>

      {/* le petit mot, tel qu'ils le liront */}
      <p className="mb-1.5 mt-5 px-1 text-note font-semibold text-brume">Le petit mot</p>
      <div className="flex items-end gap-2">
        <Avatar m={state.me} size={34} />
        <p key={messageEnRoute(dans, maintenant)} className="anim-entre min-w-0 flex-1 rounded-[20px] rounded-bl-[6px] bg-teinte-doux px-4 py-3 text-corps text-encre">
          {messageEnRoute(dans, maintenant)}
        </p>
      </div>
    </Sheet>
  )
}

function PuceProche({ m, on, classe, onClick }: { m: Member; on: boolean; classe: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${classe} py-1 pl-1 pr-3`}>
      <span className={`rounded-full ${on ? 'ring-2 ring-white' : ''}`}>
        <Avatar m={m} size={26} />
      </span>
      {m.display_name}
    </button>
  )
}
