import { Check } from 'lucide-react'
import { useState } from 'react'
import { DECOS } from '../lib/data'
import { success } from '../lib/haptic'
import { useHome } from '../lib/store'
import { challenge, daysLeft, nextReward } from '../lib/weekly'
import { Art, Btn } from './ui'

/** Le défi de la semaine : un objectif commun, une décoration offerte à toute la famille. */
export function WeeklyChallenge({ className = '' }: { className?: string }) {
  const { state, run } = useHome()
  const { weekly, houseItems, family } = state
  const ch = challenge(weekly.counts)
  const reward = nextReward(houseItems)
  const won = weekly.claimed ? DECOS.find((d) => d.key === weekly.claimed) : null
  const [busy, setBusy] = useState(false)
  const left = daysLeft()

  const claim = async () => {
    setBusy(true)
    success()
    await run((api) => api.claimWeekly(family.id), reward ? `Nouvelle décoration : ${reward.name}` : '20 étoiles pour la maison')
    setBusy(false)
  }

  return (
    <div className={`groupe mx-4 p-4 shadow-carte ${className}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-rond text-titre3">Notre défi de la semaine</p>
          <p className="mt-0.5 text-sous text-brume">{ch.title}</p>
        </div>
        <Art name={won ? `deco-${won.key}` : reward ? `deco-${reward.key}` : 'picto-etoile'} size={50} className={weekly.claimed ? '' : 'anim-flotte'} />
      </div>

      <div className="mt-3.5 space-y-3">
        {ch.goals.map((g) => {
          const ok = g.done >= g.n
          return (
            <div key={g.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-corps ${ok ? 'text-brume line-through decoration-pale' : ''}`}>{g.label}</span>
                <span className={`flex items-center gap-1 text-sous font-semibold ${ok ? 'text-vert-fonce' : 'text-brume'}`}>
                  {ok && <Check size={14} strokeWidth={3} />}
                  {g.done}/{g.n}
                </span>
              </div>
              <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-remplissage">
                <div className={`h-full rounded-full transition-[width] duration-700 ${ok ? 'bg-vert' : 'bg-teinte'}`} style={{ width: `${(g.done / g.n) * 100}%`, transitionTimingFunction: 'var(--ressort)' }} />
              </div>
            </div>
          )
        })}
      </div>

      {weekly.claimed ? (
        <p className="mt-4 flex items-center gap-2 rounded-[14px] bg-[#E6F5E9] px-3.5 py-2.5 text-sous font-medium text-[#2F7A45]">
          <Check size={16} strokeWidth={3} className="shrink-0" />
          {won ? `Défi relevé ! Nouvelle décoration dans la maison : ${won.name}.` : 'Défi relevé ! 20 étoiles pour la maison.'}
        </p>
      ) : ch.complete ? (
        <Btn className="mt-4" onClick={claim} disabled={busy}>
          Recevoir la récompense
        </Btn>
      ) : (
        <p className="mt-3.5 text-note text-brume">
          Récompense pour la maison : {reward ? reward.name : '20 étoiles'} · encore {left} jour{left > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
