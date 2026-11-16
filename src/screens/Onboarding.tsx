import { ChevronLeft, Copy, Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import House from '../components/House'
import { HousePicker, ProfilePicker } from '../components/pickers'
import { Btn } from '../components/ui'
import { success } from '../lib/haptic'
import { copy, shareInvite } from '../lib/share'
import { useStore } from '../lib/store'
import type { HouseType } from '../lib/types'
import { encodeLook, randomLook } from '../lib/look'
import { errorText } from '../lib/util'

type Step = 'accueil' | 'maison' | 'code' | 'profil' | 'invite'

export default function Onboarding({ onCancel }: { onCancel?: () => void }) {
  const { api, open, toast, reload } = useStore()
  const urlCode = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? ''
  const [step, setStep] = useState<Step>(urlCode && !onCancel ? 'code' : 'accueil')
  const [path, setPath] = useState<'creer' | 'rejoindre'>(urlCode ? 'rejoindre' : 'creer')
  const [family, setFamily] = useState('')
  const [houseType, setHouseType] = useState<HouseType>('maison')
  const [code, setCode] = useState(urlCode)
  const [preview, setPreview] = useState<{ name: string; house_type: HouseType; member_count: number } | null>(null)
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'none' | string>('idle')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(() => encodeLook(randomLook()))
  const [color, setColor] = useState('lavande')
  const [busy, setBusy] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    container.current.scrollTop = 0
    const heading = container.current.querySelector('h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus({ preventScroll: true })
  }, [step])
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null)

  // Dès que le code est complet, on montre la maison qu'il ouvre.
  useEffect(() => {
    setPreview(null)
    if (code.length !== 6) {
      setLookup('idle')
      return
    }
    let alive = true
    setLookup('loading')
    api
      .previewFamily(code)
      .then((p) => {
        if (!alive) return
        setPreview(p)
        setLookup(p ? 'idle' : 'none')
      })
      .catch((e) => alive && setLookup(errorText(e)))
    return () => {
      alive = false
    }
  }, [api, code])

  const finish = async () => {
    setBusy(true)
    try {
      if (path === 'creer') {
        const id = await api.createFamily({ name: family.trim(), houseType, displayName: name.trim(), avatar, color })
        const cs = await api.circles()
        success()
        setCreated({ id, code: cs.find((c) => c.family.id === id)?.family.invite_code ?? '' })
        setStep('invite')
      } else {
        // Le code ne fait pas entrer : il envoie une demande à la famille.
        const id = await api.joinFamily({ code, displayName: name.trim(), avatar, color })
        history.replaceState(null, '', location.pathname)
        success()
        if ((await api.circles()).some((c) => c.family.id === id)) {
          await open(id)
          onCancel?.()
        } else {
          await reload()
          if (onCancel) {
            toast(`Demande envoyée à la famille ${preview?.name ?? ''}`.trim())
            onCancel()
          }
        }
      }
    } catch (e) {
      toast(errorText(e), 'err')
    }
    setBusy(false)
  }

  const back = () => {
    if (step === 'profil') setStep(path === 'creer' ? 'maison' : 'code')
    else if (step === 'accueil' && onCancel) onCancel()
    else setStep('accueil')
  }
  const progress = step === 'maison' || step === 'code' ? 1 : step === 'profil' ? 2 : step === 'invite' ? 3 : 0
  const showBack = (step !== 'accueil' || !!onCancel) && step !== 'invite'

  return (
    <div ref={container} className="no-bar flex h-full flex-col overflow-y-auto bg-fond px-5" style={{ paddingTop: 'var(--sat)', paddingBottom: 'calc(var(--sab) + 18px)' }}>
      <div className="flex h-[52px] shrink-0 items-center">
        {showBack && (
          <button onClick={back} className="presse -ml-2 flex h-11 items-center gap-0.5 pr-3 text-corps text-teinte" aria-label="Retour">
            <ChevronLeft size={26} strokeWidth={2.4} /> {step === 'accueil' ? 'Annuler' : 'Retour'}
          </button>
        )}
      </div>

      {progress > 0 && (
        <ol aria-label="Étapes de démarrage" className="mb-5 grid grid-cols-3 gap-2">
          {[path === 'creer' ? 'Maison' : 'Invitation', 'Personnage', 'Bienvenue'].map((label, i) => (
            <li key={label} aria-current={progress === i + 1 ? 'step' : undefined} className={`text-note font-semibold ${progress >= i + 1 ? 'text-teinte-fonce' : 'text-[#625A75]'}`}>
              <span aria-hidden="true" className={`mb-2 block h-1 rounded-full ${progress >= i + 1 ? 'bg-teinte' : 'bg-remplissage'}`} />
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}
      {step === 'accueil' && (
        <div className="anim-entre flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center pb-6 pt-3 text-center">
            <img src="./panda.webp" alt="Nidoo, le panda roux" className="anim-flotte h-[132px] w-[132px] rounded-[30px] shadow-[0_24px_50px_-18px_rgba(102,70,204,0.55)]" />
            <h1 className="outline-none mt-6 font-rond text-[40px] font-bold leading-none tracking-[-0.5px]">NIDOO</h1>
            <p className="mt-3 max-w-[290px] font-rond text-titre2">Un petit chez-vous, même à distance.</p>
            <p className="mt-3 max-w-[290px] text-corps text-[#625A75]">Une maison pour vos proches. Une photo ou un dessin pour leur faire signe.</p>
            <div className="onboarding-preview mt-5 w-full max-w-[300px] overflow-hidden rounded-groupe shadow-carte" role="img" aria-label="Aperçu de votre maison virtuelle">
              <House type="maison" items={[]} phase="jour" className="!aspect-[2/1]" />
            </div>
          </div>
          <Btn onClick={() => { setPath('creer'); setStep('maison') }}>Créer notre maison</Btn>
          <Btn kind="teinte" className="mt-2.5" onClick={() => { setPath('rejoindre'); setStep('code') }}>J’ai un code d’invitation</Btn>
        </div>
      )}

      {step === 'maison' && (
        <div className="anim-entre flex flex-1 flex-col">
          <h1 className="outline-none font-rond text-grand">Votre maison</h1>
          <p className="mt-1 text-sous text-brume">Donnez-lui un nom et choisissez votre petit chez-vous.</p>
          <div className="groupe mt-5 flex items-center gap-2 px-4">
            <span className="text-corps text-brume">Famille</span>
            <input aria-label="Nom de la famille" autoComplete="off" enterKeyHint="next" className="h-[52px] min-w-0 flex-1 bg-transparent text-corps font-semibold outline-none placeholder:font-normal placeholder:text-pale" placeholder="Martin" maxLength={32} value={family} onChange={(e) => setFamily(e.target.value)} />
          </div>
          <HousePicker value={houseType} onChange={setHouseType} />
          <div className="flex-1" />
          <Btn className="mt-6" onClick={() => setStep('profil')} disabled={!family.trim()}>Continuer</Btn>
        </div>
      )}

      {step === 'code' && (
        <div className="anim-entre flex flex-1 flex-col">
          <h1 className="outline-none font-rond text-grand">Ton code</h1>
          <p className="mt-1 text-sous text-brume">Six caractères, envoyés par un proche. Un responsable de la famille acceptera ta demande avant que tu entres.</p>
          <input
            className="mt-5 h-[68px] w-full rounded-groupe bg-carte text-center font-rond text-[30px] font-semibold uppercase tracking-[0.3em] outline-none placeholder:text-pale focus:ring-2 focus:ring-teinte/40"
            aria-label="Code d’invitation à six caractères"
            placeholder="······"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoFocus
          />
          {preview && (
            <div className="anim-pop groupe mt-3 flex items-center gap-3 p-3">
              <div className="h-[58px] w-[76px] shrink-0 overflow-hidden rounded-[14px]">
                <House type={preview.house_type} items={[]} phase="jour" className="h-full !aspect-auto" bare />
              </div>
              <div>
                <p className="font-rond text-titre3">Famille {preview.name}</p>
                <p className="text-note text-brume">{preview.member_count} {preview.member_count > 1 ? 'membres' : 'membre'} · entrée sur acceptation</p>
              </div>
            </div>
          )}
          {lookup === 'loading' && <p className="mt-3 text-center text-sous text-brume">Recherche de la maison…</p>}
          {lookup === 'none' && <p className="mt-3 text-center text-sous text-rouge">Aucune maison avec ce code. Vérifie-le avec la personne qui te l’a envoyé.</p>}
          {lookup !== 'idle' && lookup !== 'loading' && lookup !== 'none' && <p className="mt-3 text-center text-sous text-rouge">{lookup}</p>}
          <div className="flex-1" />
          <Btn className="mt-6" onClick={() => setStep('profil')} disabled={!preview}>C’est bien ma famille</Btn>
        </div>
      )}

      {step === 'profil' && (
        <div className="anim-entre flex flex-1 flex-col">
          <h1 className="outline-none font-rond text-grand">Et toi ?</h1>
          <p className="mb-4 mt-1 text-sous text-brume">Un prénom suffit pour commencer. Ton personnage pourra évoluer avec toi.</p>
          <ProfilePicker compact name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} />
          <div className="flex-1" />
          <Btn className="mt-6 shrink-0" onClick={finish} disabled={busy || !name.trim()}>
            {busy ? 'Un instant…' : path === 'creer' ? 'Construire la maison' : 'Demander à entrer'}
          </Btn>
        </div>
      )}

      {step === 'invite' && created && (
        <div className="anim-entre flex flex-1 flex-col text-center">
          <div className="mx-auto w-full overflow-hidden rounded-[28px] shadow-carte">
            <House type={houseType} items={[]} />
          </div>
          <h1 className="outline-none mt-6 font-rond text-titre1">La maison est prête</h1>
          <p className="mx-auto mt-1.5 max-w-[300px] text-sous text-brume">Envoie ce code à tes proches. Chaque personne qui le tape t’envoie une demande : c’est toi qui acceptes. Il reste valable 7 jours. Tu peux aussi découvrir ta maison et les inviter plus tard depuis Famille.</p>
          <button
            onClick={async () => (await copy(created.code)) && toast('Code copié')}
            className="presse groupe mx-auto mt-5 flex h-[64px] items-center gap-3 px-6"
            aria-label={`Copier le code ${created.code}`}
          >
            <span className="font-rond text-[30px] font-semibold tracking-[0.22em]">{created.code}</span>
            <Copy size={18} className="text-teinte" />
          </button>
          <div className="flex-1" />
          <Btn
            className="mt-6"
            onClick={async () => {
              const r = await shareInvite(family.trim(), created.code)
              if (r === 'copie') toast('Invitation copiée')
            }}
          >
            <Share size={18} strokeWidth={2.4} /> Inviter mes proches
          </Btn>
          <Btn kind="teinte" className="mt-2.5" onClick={() => void open(created.id).then(() => onCancel?.())}>Entrer dans la maison</Btn>
        </div>
      )}
    </div>
  )
}
