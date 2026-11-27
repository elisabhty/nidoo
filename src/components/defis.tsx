import { Camera, Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { challengeOfDay, questionOfDay } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { MOT_ESSAIS } from '../lib/parties'
import { useHome } from '../lib/store'
import { todayKey } from '../lib/util'
import { Art, Avatar, Btn, choisir, Sheet } from './ui'
import { prendrePhoto } from './appareil'

// Les défis du jour, sur l'accueil : la question du jour, le défi photo, le mot mystère,
// la case du calendrier (en décembre), chacun avec les étoiles à gagner.

export type Defi = 'question' | 'photo' | 'mot' | 'avent'

function Etoiles({ n, texte }: { n?: number; texte?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-teinte-doux py-1 pl-2.5 pr-2 text-sous font-bold text-teinte-fonce">
      {texte ?? `+${n}`} <Art name="picto-etoile" size={16} />
    </span>
  )
}

const Fait = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vert text-white" aria-label="fait">
    <Check size={18} strokeWidth={3} />
  </span>
)

export function DefisDuJour({ avent, onOpen }: { avent: null | { aOuvrir: boolean; etoiles: number }; onOpen: (d: Defi) => void }) {
  const { state } = useHome()
  const { me, answers, moments, mot } = state
  const q = questionOfDay()
  const photo = challengeOfDay()
  const repondu = answers.some((a) => a.member_id === me.id)
  const autres = answers.filter((a) => a.member_id !== me.id).length
  const photoFaite = moments.some((m) => m.member_id === me.id && m.challenge === photo && todayKey(new Date(m.created_at)) === todayKey())
  const monMot = mot.find((l) => l.member_id === me.id)
  const motFini = !!monMot && (monMot.trouve || monMot.motifs.length >= MOT_ESSAIS)

  const lignes: { k: Defi; art: string; titre: string; texte: string; fait: boolean; etoiles: number; aide?: string }[] = [
    { k: 'question', art: 'picto-bulle', titre: 'Question du jour', texte: q.text, fait: repondu, etoiles: 2, aide: repondu ? (autres ? `${autres} réponse${autres > 1 ? 's' : ''} à lire` : 'Les autres répondront à leur rythme') : undefined },
    { k: 'photo', art: 'picto-photo', titre: 'Défi photo', texte: photo, fait: photoFaite, etoiles: 3 },
    {
      k: 'mot',
      art: 'jeu-mot',
      titre: 'Mot mystère',
      texte: !monMot ? 'Le même mot pour toute la famille' : monMot.trouve ? `Trouvé en ${monMot.motifs.length} essai${monMot.motifs.length > 1 ? 's' : ''}` : motFini ? 'Pas trouvé aujourd’hui, à demain !' : `${monMot.motifs.length} essai${monMot.motifs.length > 1 ? 's' : ''} sur ${MOT_ESSAIS}`,
      fait: motFini,
      etoiles: 2,
    },
    ...(avent ? [{ k: 'avent' as const, art: 'avent-sapin-mini', titre: 'Calendrier de l’Avent', texte: avent.aOuvrir ? 'La case du jour t’attend' : 'Case du jour ouverte', fait: !avent.aOuvrir, etoiles: avent.etoiles }] : []),
  ]
  const reste = lignes.filter((l) => !l.fait).reduce((n, l) => n + l.etoiles, 0)

  const ligne = (l: (typeof lignes)[number], i: number) => (
    <button
      key={l.k}
      onClick={() => {
        tap()
        onOpen(l.k)
      }}
      className={`presse-ligne flex w-full items-center gap-3 py-3 pl-3 pr-3.5 text-left ${i > 0 ? 'border-t border-trait' : ''}`}
    >
      <img src={`./art/${l.art}.webp`} alt="" className={`h-11 w-11 shrink-0 object-contain ${l.fait ? 'opacity-60' : ''}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-note font-semibold uppercase tracking-[0.03em] text-teinte">{l.titre}</span>
        <span className={`line-clamp-2 block text-sous font-semibold ${l.fait ? 'text-brume' : ''}`}>{l.texte}</span>
        {l.aide && <span className="block text-note text-brume">{l.aide}</span>}
      </span>
      {l.fait ? <Fait /> : <Etoiles n={l.etoiles} />}
    </button>
  )

  return (
    <section className="mx-4 mt-6" aria-label="Les défis du jour">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="font-rond text-titre3">Les défis du jour</h2>
        <p className="text-note font-semibold text-teinte-fonce">{reste > 0 ? `Encore ${reste} étoiles à gagner` : 'Tout est fait, bravo !'}</p>
      </div>
      <div className="groupe mt-2 overflow-hidden shadow-carte">
        {lignes.map(ligne)}
      </div>
    </section>
  )
}

/** La question du jour : y répondre (un mot, une photo ou les deux), puis lire les réponses de la famille. */
export function QuestionSheet({ onClose }: { onClose: () => void }) {
  const { state, run } = useHome()
  const { family, me, members, answers } = state
  const q = questionOfDay()
  const [text, setText] = useState('')
  const [pic, setPic] = useState<{ blob: Blob; url: string } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  useEffect(() => () => void (pic && URL.revokeObjectURL(pic.url)), [pic])
  const mine = answers.find((a) => a.member_id === me.id)

  return (
    <Sheet title="Question du jour" onClose={onClose}>
      {/* les étoiles à gagner sont dites sur le bouton « Répondre · +2 étoiles » : pas deux fois */}
      {mine && (
        <div className="flex items-center gap-2.5">
          <Art name="picto-bulle" size={30} />
          <p className="text-note font-semibold uppercase tracking-[0.03em] text-teinte">Vos réponses</p>
        </div>
      )}
      <p className={`font-rond text-titre2 ${mine ? 'mt-2' : ''}`}>{q.text}</p>
      {mine ? (
        <div className="mt-3.5 space-y-2.5">
          {members.map((m) => {
            const a = answers.find((x) => x.member_id === m.id)
            return (
              <div key={m.id} className="flex items-start gap-2.5">
                <Avatar m={m} size={34} />
                <div className={`min-w-0 flex-1 rounded-[18px] rounded-tl-[6px] px-3.5 py-2 ${a ? (m.id === me.id ? 'bg-teinte text-white' : 'bg-remplissage') : 'bg-transparent px-0'}`}>
                  {a ? (
                    <>
                      {m.id !== me.id && <p className="text-legende font-semibold text-brume">{m.display_name}</p>}
                      {a.photo_url && <img src={a.photo_url} alt={`Photo de ${m.display_name}`} className="my-1.5 block max-h-[220px] w-full rounded-[14px] object-cover" />}
                      {a.answer && <p className="text-appel">{a.answer}</p>}
                    </>
                  ) : (
                    <p className="pt-1 text-sous text-brume">{m.display_name} pourra répondre à son rythme</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <form
          className="mt-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim() || pic) {
              success()
              void run((api) => api.answer(family.id, me.id, q.key, text, pic?.blob ?? null), '2 étoiles pour la maison')
            }
          }}
        >
          <input
            ref={picker}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setPic({ blob: f, url: URL.createObjectURL(f) })
            }}
          />
          {/* la réponse : une carte blanche, le mot et (si on veut) une photo ; plus de bloc gris (Elisa, 27 novembre) */}
          <div className="overflow-hidden rounded-[20px] bg-carte shadow-carte transition-shadow focus-within:shadow-[0_0_0_2px_#9B85E8,0_6px_18px_-10px_rgba(102,70,204,0.35)]">
            {pic && (
              <div className="relative overflow-hidden">
                <img src={pic.url} alt="Ta photo" className="block max-h-[220px] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    tap()
                    setPic(null)
                  }}
                  className="presse verre absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-encre"
                  aria-label="Retirer la photo"
                >
                  <X size={17} strokeWidth={2.8} />
                </button>
              </div>
            )}
            <textarea
              aria-label="Ta réponse à la question du jour"
              rows={pic ? 2 : 3}
              className="block w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-corps text-encre outline-none placeholder:text-pale"
              placeholder={pic ? 'Un mot avec ta photo (facultatif)' : 'Écris ta réponse ici…'}
              maxLength={140}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between border-t border-trait py-1 pl-1.5 pr-3.5">
              <button
                type="button"
                onClick={async () => {
                  tap()
                  // prendre la photo avec l'appareil de Nidoo (la question posée sur l'image), ou en choisir une
                  const i = await choisir({ title: pic ? 'Changer la photo' : 'Répondre avec une photo', actions: [{ label: 'Prendre une photo' }, { label: 'Choisir dans la photothèque' }] })
                  if (i === 1) return picker.current?.click()
                  if (i !== 0) return
                  const r = await prendrePhoto({ titre: 'Question du jour', consigne: q.text, galerie: true })
                  if (r instanceof File) setPic({ blob: r, url: URL.createObjectURL(r) })
                  else if (r === 'galerie' || r === 'natif') picker.current?.click()
                }}
                className="presse flex h-11 items-center gap-2 rounded-full px-3 text-sous font-semibold text-teinte-fonce"
              >
                <Camera size={19} strokeWidth={2.3} /> {pic ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              <span className="text-note tabular-nums text-pale" aria-hidden="true">{text.length}/140</span>
            </div>
          </div>
          <p className="px-1 pt-2 text-note text-brume">Les réponses des autres apparaissent dès que tu as envoyé la tienne.</p>
          <Btn type="submit" className="mt-3" disabled={!text.trim() && !pic}>
            Répondre · +2 étoiles
          </Btn>
        </form>
      )}
    </Sheet>
  )
}
