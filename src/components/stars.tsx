import type { ReactNode } from 'react'
import { DECOS, STAR_REASONS } from '../lib/data'
import { useHome } from '../lib/store'
import { CareIcon, HandIcon } from './care'
import { DoodleIcon } from './drawing'
import { ago } from '../lib/util'
import { Art, Avatar, Btn, Sheet } from './ui'

const EARN: { icon: ReactNode; label: string; stars: number; limit?: string }[] = [
  { icon: <Art name="picto-photo" size={40} />, label: 'Partager une photo', stars: 3, limit: 'jusqu’à 5 par jour' },
  { icon: <Art name="picto-bulle" size={40} />, label: 'Répondre à la question du jour', stars: 2 },
  { icon: <Art name="humeur-heureux" size={40} />, label: 'Partager mon humeur', stars: 1, limit: 'une fois par jour' },
  { icon: <Art name="geste-calin" size={40} />, label: 'Envoyer un câlin', stars: 1, limit: 'jusqu’à 5 par jour' },
  { icon: <DoodleIcon size={34} />, label: 'Envoyer un dessin', stars: 1, limit: 'jusqu’à 5 par jour' },
  { icon: <Art name="picto-missions" size={40} />, label: 'Terminer une mission', stars: 1 },
  { icon: <img src="./art/jeu-puissance4.webp" alt="" className="h-9 w-9 object-contain" />, label: 'Gagner une partie', stars: 2, limit: 'jusqu’à 5 par jour' },
  { icon: <img src="./art/jeu-mot.webp" alt="" className="h-9 w-9 object-contain" />, label: 'Trouver le mot mystère', stars: 2, limit: 'une fois par jour' },
  { icon: <img src="./art/jeu-dessin.webp" alt="" className="h-9 w-9 object-contain" />, label: 'Deviner un dessin', stars: 1, limit: 'jusqu’à 10 par jour' },
  { icon: <img src="./art/jeu-quidenous.webp" alt="" className="h-9 w-9 object-contain" />, label: 'Être tous d’accord à Qui de nous ?', stars: 1, limit: 'jusqu’à 10 par jour' },
  { icon: <img src="./art/avent-sapin-mini.webp" alt="" className="h-9 w-9 object-contain" />, label: 'Ouvrir une case du calendrier de l’Avent', stars: 1, limit: 'en décembre · 3 étoiles le 24' },
  { icon: <CareIcon k="chat" size={32} />, label: 'Nourrir le compagnon ou les oiseaux', stars: 3, limit: 'une fois par jour chacun · un repas de croquettes' },
  { icon: <CareIcon k="fleurs" size={32} />, label: 'Arroser les fleurs ou le potager', stars: 1, limit: 'une fois par jour chacun, pour toute la famille' },
  { icon: <HandIcon size={32} />, label: 'Caresser le compagnon ou les oiseaux', stars: 1, limit: 'une fois par jour, pour chacun' },
  { icon: <Art name="jeu-balle" size={36} />, label: 'Jouer avec le compagnon', stars: 1, limit: 'une fois par jour, pour chacun' },
  { icon: <Art name="carotte" size={38} />, label: 'Récolter au potager', stars: 8, limit: 'de 8 à 22 selon la plante' },
]

/** Le système d'étoiles, expliqué simplement. */
export function StarsSheet({ onClose, onDecorate }: { onClose: () => void; onDecorate?: () => void }) {
  const { state } = useHome()
  const { family, houseItems, members, me } = state
  const next = DECOS.find((d) => !houseItems.includes(d.key))
  const log = state.starLog.filter((s) => s.amount > 0).slice(0, 5)
  return (
    <Sheet title="Les étoiles" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Art name="picto-etoile" size={64} className="anim-flotte" />
        <p className="mt-1 font-rond text-titre1">{family.stars} étoile{family.stars > 1 ? 's' : ''}</p>
        <p className="mt-1 max-w-[290px] text-sous text-brume">Elles appartiennent à toute la famille : chaque petit geste en rapporte, et on les dépense ensemble pour décorer la maison.</p>
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

      {log.length > 0 && (
        <>
          <p className="entete mt-6 !px-1">Dernières étoiles</p>
          <div className="groupe">
            {log.map((s, i) => {
              const m = members.find((x) => x.id === s.member_id)
              const what = STAR_REASONS[s.reason] ?? ''
              return (
                <div key={s.id} className="flex items-center gap-3 pl-3.5">
                  {m ? <Avatar m={m} size={34} /> : <span className="h-[34px] w-[34px] rounded-full bg-remplissage" />}
                  <div className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 ${i < log.length - 1 ? 'border-b border-trait' : ''}`}>
                    <p className="min-w-0 flex-1 text-sous">
                      <span className="font-semibold">{m ? (m.id === me.id ? 'Tu' : m.display_name) : 'Un proche'}</span>{' '}
                      {m?.id === me.id ? what.replace(/^a /, 'as ').replace('son humeur', 'ton humeur') : what}
                      <span className="block text-note text-brume">{ago(s.created_at)}</span>
                    </p>
                    <span className="flex items-center gap-1 text-sous font-semibold text-brume">
                      +{s.amount} <Art name="picto-etoile" size={16} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
