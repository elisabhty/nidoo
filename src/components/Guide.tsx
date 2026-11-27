import { useState } from 'react'
import { select, success } from '../lib/haptic'
import { Art, Btn } from './ui'

// Le tour de bienvenue : une fonctionnalité par écran, en une phrase.
const STEPS: { art: string; title: string; text: string }[] = [
  { art: 'panda', title: 'Un petit chez-vous', text: 'Retrouve tes proches dans la Maison. Partage ton humeur quand tu en as envie, ou touche un proche pour lui envoyer un câlin.' },
  { art: 'geste-calin', title: 'Un geste suffit', text: 'Une photo, un dessin, un petit mot : crée une attention et choisis à qui l’envoyer. Pour toute la famille, publie-le dans le Fil, avec vos albums.' },
  { art: 'picto-agenda', title: 'À votre rythme', text: 'Organiser rassemble les rendez-vous, les courses et les choses à faire. Famille permet d’inviter tes proches et de personnaliser votre maison.' },
]

export default function Guide({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const next = () => {
    if (last) {
      success()
      onClose()
    } else {
      select()
      setI(i + 1)
    }
  }

  return (
    <div className="absolute inset-0 z-[65] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Comment ça marche">
      <div className="anim-fondu absolute inset-0 bg-black/35 backdrop-blur-md" />
      <div className="anim-monte relative rounded-t-feuille bg-fond px-6 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 18px)' }}>
        <div className="mx-auto h-[5px] w-9 rounded-full bg-pale" />
        <button onClick={onClose} className="presse absolute right-5 top-4 z-10 text-corps text-teinte">Passer</button>
        <div key={i} className="anim-entre flex min-h-[330px] flex-col items-center pt-9 text-center">
          {step.art === 'panda' ? (
            <img src="./panda.webp" alt="" className="h-[124px] w-[124px] rounded-[30px] shadow-carte" />
          ) : (
            <Art name={step.art} size={124} />
          )}
          <h2 className="mt-6 font-rond text-titre1">{step.title}</h2>
          <p className="mt-2 max-w-[310px] text-corps text-brume">{step.text}</p>
        </div>
        <div className="mb-5 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={`h-[7px] rounded-full transition-all duration-300 ${k === i ? 'w-5 bg-teinte' : 'w-[7px] bg-pale'}`} />
          ))}
        </div>
        <Btn onClick={next}>{last ? 'C’est parti' : 'Suivant'}</Btn>
      </div>
    </div>
  )
}
