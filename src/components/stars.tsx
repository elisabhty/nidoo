import type { ReactNode } from 'react'
import { DECOS } from '../lib/data'
import { useHome } from '../lib/store'
import { DoodleIcon } from './drawing'
import { Art, Btn, Sheet } from './ui'

const EARN: { icon: ReactNode; label: string; stars: number; limit?: string }[] = [
  { icon: <Art name="picto-photo" size={40} />, label: 'Partager une photo', stars: 3, limit: 'jusqu’à 5 par jour' },
  { icon: <Art name="picto-bulle" size={40} />, label: 'Répondre à la question du jour', stars: 2 },
  { icon: <Art name="humeur-heureux" size={40} />, label: 'Partager mon humeur', stars: 1, limit: 'une fois par jour' },
  { icon: <Art name="geste-calin" size={40} />, label: 'Envoyer un câlin', stars: 1, limit: 'jusqu’à 5 par jour' },
  { icon: <DoodleIcon size={34} />, label: 'Envoyer un dessin', stars: 1, limit: 'jusqu’à 5 par jour' },
  { icon: <Art name="picto-missions" size={40} />, label: 'Terminer une mission', stars: 1 },
]

/** Le système d'étoiles, expliqué simplement. */
export function StarsSheet({ onClose, onDecorate }: { onClose: () => void; onDecorate?: () => void }) {
  const { state } = useHome()
  const { family, houseItems } = state
  const next = DECOS.find((d) => !houseItems.includes(d.key))
  return (
    <Sheet title="Les étoiles" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Art name="picto-etoile" size={64} className="anim-flotte" />
        <p className="mt-1 font-rond text-titre1">{family.stars} étoile{family.stars > 1 ? 's' : ''}</p>
        <p className="mt-1 max-w-[290px] text-sous text-brume">Elles appartiennent à toute la famille. On les gagne ensemble et on les dépense pour embellir la maison.</p>
      </div>

      <p className="entete mt-5 !px-1">Comment en gagner</p>
      <div className="groupe">
        {EARN.map((e, i) => (
          <div key={e.label} className="flex items-center gap-3 pl-3">
            <span className="flex w-10 shrink-0 justify-center">{e.icon}</span>
            <div className={`flex min-h-[56px] flex-1 items-center gap-2 py-2 pr-4 ${i < EARN.length - 1 ? 'border-b border-trait' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="text-corps">{e.label}</p>
                {e.limit && <p className="text-note text-brume">{e.limit}</p>}
              </div>
              <span className="flex items-center gap-1 text-appel font-semibold text-teinte">
                +{e.stars} <Art name="picto-etoile" size={17} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="entete mt-5 !px-1">À quoi elles servent</p>
      <div className="groupe space-y-2 p-4 text-sous">
        <p>Chaque décoration installée embellit la maison et la fait monter d’un niveau (vous êtes au niveau {houseItems.length + 1}).</p>
        <p>Le défi de la semaine, relevé ensemble, offre en plus une décoration à toute la famille.</p>
        {next && (
          <p className="text-brume">
            Prochaine décoration : {next.name}, {next.cost} étoiles{family.stars >= next.cost ? ', vous pouvez l’installer.' : '.'}
          </p>
        )}
      </div>
      {onDecorate && (
        <Btn className="mt-4" onClick={onDecorate}>
          Décorer la maison
        </Btn>
      )}
    </Sheet>
  )
}
