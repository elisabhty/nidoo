import { ChevronLeft, Copy, Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import House from '../components/House'
import { HousePicker, ProfileStep } from '../components/pickers'
import { Btn } from '../components/ui'
import { success } from '../lib/haptic'
import { copy, shareInvite } from '../lib/share'
import { useStore } from '../lib/store'
import type { HouseType } from '../lib/types'
import { encodeLook, randomLook } from '../lib/look'
import { errorText, familyLabel } from '../lib/util'
import { ONBOARDING as T } from '../lib/textes'

type Step = 'accueil' | 'maison' | 'code' | 'profil' | 'invite'

export default function Onboarding({ onCancel }: { onCancel?: () => void }) {
  const { api, open, toast, reload } = useStore()
  const urlCode = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? ''
  const [step, setStep] = useState<Step>(urlCode && !onCancel ? 'code' : 'accueil')
  const [path, setPath] = useState<'creer' | 'rejoindre'>(urlCode ? 'rejoindre' : 'creer')
  const [family, setFamily] = useState<string>(T.create.default_name)
  const [houseType, setHouseType] = useState<HouseType>('maison')
  const [code, setCode] = useState(urlCode)
  const [preview, setPreview] = useState<{ name: string; house_type: HouseType; member_count: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [nameError, setNameError] = useState('')
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

  // Les codes d'invitation font 6 caractères (lettres et chiffres, sans espace).
  const CODE_LEN = 6
  const NAME_MAX = 40
  const verify = async () => {
    if (checking) return
    setCodeError('')
    if (!code) return setCodeError(T.join.empty_code)
    if (code.length !== CODE_LEN) return setCodeError(T.join.invalid_code)
    setChecking(true)
    try {
      const p = await api.previewFamily(code)
      if (!p) setCodeError(T.join.invalid_code)
      else {
        setPreview(p)
        setStep('profil')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e)
      // un code expiré ou trop d'essais : on garde le message précis ; le reste, c'est la connexion
      setCodeError(/CODE_EXPIRE|TROP_D_ESSAIS|NON_CONNECTE/.test(msg) ? errorText(e) : /CODE_INCONNU/.test(msg) ? T.join.invalid_code : T.join.network_error)
    }
    setChecking(false)
  }
  const nameTooLong = family.trim().length > NAME_MAX

  const create = async () => {
    if (busy) return
    setNameError('')
    if (!family.trim()) return setNameError(T.create.empty_name)
    if (nameTooLong) return setNameError(T.create.name_too_long)
    setBusy(true)
    try {
      const id = await api.createFamily({ name: family.trim(), houseType, displayName: name.trim(), avatar, color })
      const cs = await api.circles()
      success()
      setCreated({ id, code: cs.find((c) => c.family.id === id)?.family.invite_code ?? '' })
      setStep('invite')
    } catch {
      setNameError(T.create.create_error)
    }
    setBusy(false)
  }

  const finish = async () => {
    if (busy || !name.trim()) return
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (path === 'creer') return setStep('maison')
    setBusy(true)
    try {
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
          toast(preview ? `Demande envoyée à « ${familyLabel(preview.name)} »` : 'Demande envoyée')
          onCancel()
        }
      }
    } catch (e) {
      toast(errorText(e), 'err')
    }
    setBusy(false)
  }

  const back = () => {
    if (step === 'maison') setStep('profil')
    else if (step === 'profil') setStep(path === 'creer' ? 'accueil' : 'code')
    else if (step === 'accueil' && onCancel) onCancel()
    else setStep('accueil')
  }
  // créer : personnage, maison, bienvenue ; rejoindre : invitation, personnage, bienvenue
  const progress =
    path === 'creer'
      ? step === 'profil' ? 1 : step === 'maison' ? 2 : step === 'invite' ? 3 : 0
      : step === 'code' ? 1 : step === 'profil' ? 2 : 0
  const showBack = (step !== 'accueil' || !!onCancel) && step !== 'invite'

  return (
    <div data-feuilles className="relative flex h-full flex-col bg-fond" style={{ paddingTop: 'var(--sat)' }}>
    <div ref={container} className="no-bar flex min-h-0 flex-1 flex-col overflow-y-auto px-5" style={{ paddingBottom: step === 'profil' ? '20px' : 'calc(var(--sab) + 18px)' }}>
      <div className={showBack ? "flex h-[52px] shrink-0 items-center" : "hidden"}>
        {showBack && (
          <button onClick={back} className="presse -ml-2 flex h-11 items-center gap-0.5 pr-3 text-corps text-teinte" aria-label="Retour">
            <ChevronLeft size={26} strokeWidth={2.4} /> {step === 'accueil' ? 'Annuler' : T.join.back}
          </button>
        )}
      </div>

      {progress > 0 && (
        <ol aria-label="Étapes de démarrage" className="mb-5 grid grid-cols-3 gap-2">
          {(path === 'creer' ? ['Personnage', 'Maison', 'Bienvenue'] : ['Invitation', 'Personnage', 'Bienvenue']).map((label, i) => (
            <li key={label} aria-current={progress === i + 1 ? 'step' : undefined} className={`text-note font-semibold ${progress >= i + 1 ? 'text-teinte-fonce' : 'text-[#625A75]'}`}>
              <span aria-hidden="true" className={`mb-2 block h-1 rounded-full ${progress >= i + 1 ? 'bg-teinte' : 'bg-remplissage'}`} />
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}
      {step === 'accueil' && (
        <div className="welcome-layout anim-entre">
          <div className="welcome-intro">
            <div className="flex items-center gap-3">
              <img src="./panda.webp" alt="" width={58} height={58} className="rounded-2xl shadow-carte" />
              <span className="font-rond text-[23px] font-extrabold">NIDOO</span>
            </div>
            <h1 className="mt-5 font-rond text-titre1 outline-none [text-wrap:balance]">{T.home.headline}</h1>
            <p className="mt-2 text-sous text-[#625A75] [text-wrap:pretty]">{T.home.description}</p>
          </div>
          <div className="welcome-scene">
            <div role="img" aria-label="Une maison virtuelle à partager avec tes proches" className="overflow-hidden rounded-groupe">
              <House type="maison" items={[]} phase="jour" className="!aspect-[2/1] lg:!aspect-[5/4]" />
            </div>
            <div className="relative mx-4 -mt-7 flex w-fit max-w-full items-center gap-3 rounded-2xl bg-carte py-2 pl-2 pr-5 text-left shadow-carte">
              <img src="./art/persos/gf1-v.webp" alt="" width={44} height={44} className="h-11 w-11 rounded-full bg-teinte-doux object-contain" />
              <div>
                <p className="text-note font-semibold text-teinte-fonce">Mamie</p>
                <p className="font-rond text-appel font-bold">Je pense à toi 💜</p>
              </div>
            </div>
          </div>
          <div className="welcome-actions">
            <Btn onClick={() => { setPath('creer'); setStep('profil') }}>{T.home.create_cta}</Btn>
            <Btn kind="teinte" className="mt-2.5" onClick={() => { setPath('rejoindre'); setStep('code') }}>{T.home.join_cta}</Btn>
          </div>
        </div>
      )}

      {step === 'maison' && (
        <form className="anim-entre flex flex-1 flex-col" noValidate onSubmit={(e) => (e.preventDefault(), void create())}>
          <h1 className="outline-none font-rond text-grand">{T.create.title}</h1>
          <p className="mt-1 text-sous text-brume">{T.create.description}</p>
          <div className="mb-1.5 mt-5 flex items-baseline justify-between gap-3 px-1">
            <label htmlFor="nom-maison" className="text-corps font-semibold text-encre">
              {T.create.field_label}
            </label>
            <span className="text-note font-semibold text-teinte-fonce">Obligatoire</span>
          </div>
          <input
            id="nom-maison"
            autoComplete="off"
            enterKeyHint="done"
            className={`champ !bg-carte border font-semibold focus:border-teinte ${nameError ? 'border-rouge/50 ring-2 ring-rouge/50' : 'border-teinte/25'}`}
            placeholder={T.create.placeholder}
            maxLength={NAME_MAX + 20}
            value={family}
            aria-invalid={!!nameError || nameTooLong}
            aria-describedby="nom-maison-aide"
            onChange={(e) => {
              setFamily(e.target.value)
              setNameError('')
            }}
          />
          <p id="nom-maison-aide" role={nameError || nameTooLong ? 'alert' : undefined} className={`mt-1.5 min-h-[20px] px-1 text-note ${nameError || nameTooLong ? 'text-rouge' : 'text-brume'}`}>
            {nameError || (nameTooLong ? T.create.name_too_long : family.length > NAME_MAX - 10 ? `${family.trim().length}/${NAME_MAX}` : '')}
          </p>
          <p className="mb-0 mt-3 px-1 text-note font-semibold text-brume">{T.create.decor}</p>
          <HousePicker value={houseType} onChange={setHouseType} />
          <p className="mt-3 text-center text-note text-brume">{T.create.decor_later}</p>
          <div className="flex-1" />
          <Btn className="mt-6" type="submit" disabled={busy}>
            {busy ? T.create.loading : T.create.submit}
          </Btn>
        </form>
      )}

      {step === 'code' && (
        <form className="anim-entre flex flex-1 flex-col" noValidate onSubmit={(e) => (e.preventDefault(), void verify())}>
          <h1 className="outline-none font-rond text-grand">{T.join.title}</h1>
          <p className="mt-1 text-sous text-brume">{T.join.description}</p>
          <label htmlFor="code-invitation" className="mb-1.5 mt-5 px-1 text-note font-semibold text-brume">
            {T.join.field_label}
          </label>
          <input
            id="code-invitation"
            className={`h-[68px] w-full rounded-groupe bg-carte text-center font-rond text-[30px] font-semibold uppercase tracking-[0.3em] outline-none placeholder:text-[20px] placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-pale focus:ring-2 focus:ring-teinte/40 ${codeError ? 'ring-2 ring-rouge/50' : ''}`}
            placeholder={T.join.placeholder}
            maxLength={CODE_LEN}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!codeError}
            aria-describedby="code-aide"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN))
              setCodeError('')
            }}
            autoFocus
          />
          <p id="code-aide" role={codeError ? 'alert' : 'status'} className={`mt-2 min-h-[20px] px-1 text-center text-sous ${codeError ? 'text-rouge' : 'text-brume'}`}>
            {codeError || (checking ? T.join.loading : '')}
          </p>
          <div className="flex-1" />
          <p className="mt-6 text-center text-sous text-brume">{T.join.helper}</p>
          <Btn className="mt-3" type="submit" disabled={checking}>
            {checking ? T.join.loading : T.join.submit}
          </Btn>
        </form>
      )}

      {step === 'profil' && (
        <div className="anim-entre flex flex-1 flex-col">
          {path === 'rejoindre' && preview && (
            <div className="groupe mb-4 flex items-center gap-3 p-3">
              <div className="h-[58px] w-[76px] shrink-0 overflow-hidden rounded-[14px]">
                <House type={preview.house_type} items={[]} phase="jour" className="h-full !aspect-auto" bare />
              </div>
              <div className="min-w-0">
                <p className="truncate font-rond text-titre3">{familyLabel(preview.name)}</p>
                <p className="text-note text-brume">
                  {preview.member_count} {preview.member_count > 1 ? 'membres' : 'membre'} · entrée sur acceptation
                </p>
              </div>
            </div>
          )}
          <h1 className="outline-none font-rond text-grand">Fais comme chez toi</h1>
          <p className="mb-4 mt-1 text-sous text-brume">Choisis ton prénom et ton personnage. Tu pourras les modifier plus tard.</p>
          <ProfileStep name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} />
        </div>
      )}

      {step === 'invite' && created && (
        <div className="anim-entre flex flex-1 flex-col text-center">
          <div className="mx-auto w-full overflow-hidden rounded-[28px] shadow-carte">
            <House type={houseType} items={[]} />
          </div>
          <h1 className="outline-none mx-auto mt-6 max-w-[320px] font-rond text-titre1 [text-wrap:balance]">
            {T.invite.title.split(/(chez-vous)/).map((x, i) => (x === 'chez-vous' ? <span key={i} className="whitespace-nowrap">{x}</span> : x))}
          </h1>
          <p className="mx-auto mt-1.5 max-w-[300px] text-sous text-brume [text-wrap:balance]">{T.invite.description}</p>
          <button
            onClick={async () => (await copy(created.code)) && toast('Code copié')}
            className="presse groupe mx-auto mt-5 flex h-[64px] items-center gap-3 px-6"
            aria-label={`Copier le code ${created.code}`}
          >
            <span className="font-rond text-[30px] font-extrabold tracking-[0.22em]">{created.code}</span>
            <Copy size={18} className="text-teinte" />
          </button>
          <p className="mt-2 text-note text-brume">{T.invite.code_hint}</p>
          <div className="flex-1" />
          <Btn
            className="mt-6"
            onClick={async () => {
              const r = await shareInvite(family.trim(), created.code)
              if (r === 'copie') toast('Invitation copiée')
            }}
          >
            <Share size={18} strokeWidth={2.4} /> {T.invite.share}
          </Btn>
          <Btn kind="teinte" className="mt-2.5" onClick={() => void open(created.id).then(() => onCancel?.())}>{T.invite.enter}</Btn>
          <p className="mt-3 text-note text-brume">{T.invite.later}</p>
        </div>
      )}
    </div>
    {step === 'profil' && (
      <div className="shrink-0 border-t border-trait bg-fond px-5 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 18px)' }}>
        <p className="mb-2 text-center text-note text-brume">{name.trim() ? 'Tout se modifie plus tard, dans Famille.' : 'Ajoute ton prénom pour continuer.'}</p>
        <Btn onClick={finish} disabled={busy || !name.trim()}>
          {busy ? 'Un instant…' : path === 'creer' ? 'Continuer' : 'Demander à entrer'}
        </Btn>
      </div>
    )}
    </div>
  )
}
