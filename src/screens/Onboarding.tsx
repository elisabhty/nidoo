import { ArrowLeft, Copy, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import House from '../components/House'
import { Avatar, Btn } from '../components/ui'
import { AVATARS, COLOR_KEYS, COLORS, HOUSES } from '../lib/data'
import { copy, shareInvite } from '../lib/share'
import { useStore } from '../lib/store'
import type { HouseType } from '../lib/types'
import { errorText } from '../lib/util'

type Step = 'accueil' | 'maison' | 'code' | 'profil' | 'invite'

export function ProfilePicker({
  name, setName, avatar, setAvatar, color, setColor,
}: { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void }) {
  return (
    <>
      <div className="flex justify-center">
        <Avatar m={{ avatar, color }} size={96} />
      </div>
      <input className="champ mt-5 text-center text-[18px] font-bold" placeholder="Ton prénom ou ton surnom" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-4 grid grid-cols-6 gap-2">
        {AVATARS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAvatar(a.key)}
            aria-pressed={avatar === a.key}
            aria-label={a.key}
            className={`appui flex aspect-square items-center justify-center rounded-2xl text-[26px] ${avatar === a.key ? 'bg-lavande-200 ring-2 ring-lavande-400' : 'bg-white shadow-carte'}`}
          >
            {a.emoji}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-3">
        {COLOR_KEYS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-pressed={color === c}
            aria-label={`Couleur ${c}`}
            className="appui h-9 w-9 rounded-full"
            style={{ background: COLORS[c].bg, boxShadow: color === c ? `0 0 0 2.5px #fff, 0 0 0 5px ${COLORS[c].ring}` : 'inset 0 0 0 1.5px rgba(47,42,68,.08)' }}
          />
        ))}
      </div>
    </>
  )
}

export default function Onboarding({ onCancel }: { onCancel?: () => void }) {
  const { api, open, toast } = useStore()
  const urlCode = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? ''
  const [step, setStep] = useState<Step>(urlCode && !onCancel ? 'code' : 'accueil')
  const [path, setPath] = useState<'creer' | 'rejoindre'>(urlCode ? 'rejoindre' : 'creer')
  const [family, setFamily] = useState('')
  const [houseType, setHouseType] = useState<HouseType>('maison')
  const [code, setCode] = useState(urlCode)
  const [preview, setPreview] = useState<{ name: string; house_type: HouseType; member_count: number } | null>(null)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('panda')
  const [color, setColor] = useState('lavande')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null)

  // Dès que le code est complet, on montre la maison qu'il ouvre.
  useEffect(() => {
    setPreview(null)
    if (code.length !== 6) return
    let alive = true
    api.previewFamily(code).then((p) => alive && setPreview(p)).catch(() => undefined)
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
        setCreated({ id, code: cs.find((c) => c.family.id === id)?.family.invite_code ?? '' })
        setStep('invite')
      } else {
        const id = await api.joinFamily({ code, displayName: name.trim(), avatar, color })
        history.replaceState(null, '', location.pathname)
        await open(id)
        onCancel?.()
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

  return (
    <div className="fond no-bar flex h-full flex-col overflow-y-auto px-6" style={{ paddingTop: 'calc(var(--sat) + 14px)', paddingBottom: 'calc(var(--sab) + 22px)' }}>
      {(step !== 'accueil' || onCancel) && step !== 'invite' && (
        <button onClick={back} className="appui -ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-encre shadow-carte" aria-label="Retour">
          <ArrowLeft size={19} />
        </button>
      )}

      {step === 'accueil' && (
        <div className="anim-entre flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <img src="./panda.webp" alt="Nidoo, le panda roux" className="anim-flotte h-48 w-48 rounded-[3rem] shadow-doux" />
            <h1 className="titre mt-7 text-[44px] leading-none">NIDOO</h1>
            <p className="mt-3 max-w-[270px] text-[17px] leading-snug text-brume">Le petit chez-nous qui tient dans un widget.</p>
          </div>
          <Btn onClick={() => { setPath('creer'); setStep('maison') }}>Créer notre maison</Btn>
          <Btn kind="fantome" className="mt-3" onClick={() => { setPath('rejoindre'); setStep('code') }}>J’ai un code d’invitation</Btn>
        </div>
      )}

      {step === 'maison' && (
        <div className="anim-entre flex flex-1 flex-col pt-4">
          <h1 className="titre text-[30px] leading-tight">Comment s’appelle votre maison ?</h1>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-lavande-100 bg-white px-4 focus-within:border-lavande-400">
            <span className="titre text-[19px] text-brume">Famille</span>
            <input className="h-[52px] min-w-0 flex-1 bg-transparent text-[19px] font-bold outline-none placeholder:font-semibold placeholder:text-brume/50" placeholder="Martin" maxLength={32} value={family} onChange={(e) => setFamily(e.target.value)} autoFocus />
          </div>
          <p className="mt-6 text-[14px] font-bold text-brume">Votre petit chez-vous</p>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {HOUSES.map((h) => (
              <button
                key={h.key}
                onClick={() => setHouseType(h.key)}
                aria-pressed={houseType === h.key}
                className={`appui overflow-hidden rounded-3xl border-2 bg-white pb-2 ${houseType === h.key ? 'border-lavande-400 shadow-doux' : 'border-transparent shadow-carte'}`}
              >
                <div className="h-[84px] overflow-hidden">
                  <House type={h.key} members={[]} items={[]} phase="jour" className="-mx-[38%] -mt-3 w-[176%] max-w-none" />
                </div>
                <span className="mt-1 block text-[13.5px] font-extrabold">{h.label}</span>
                <span className="block text-[11px] leading-tight text-brume">{h.hint}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Btn className="mt-6" onClick={() => setStep('profil')} disabled={!family.trim()}>Continuer</Btn>
        </div>
      )}

      {step === 'code' && (
        <div className="anim-entre flex flex-1 flex-col pt-4">
          <h1 className="titre text-[30px] leading-tight">Ton code d’invitation</h1>
          <p className="mt-2 text-[15px] text-brume">Six caractères, envoyés par un proche déjà installé dans la maison.</p>
          <input
            className="champ mt-5 text-center font-titre text-[30px] font-semibold uppercase tracking-[0.3em]"
            placeholder="······"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoFocus
          />
          {preview && (
            <div className="anim-pop carte mt-4 flex items-center gap-3 p-3">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-2xl">
                <House type={preview.house_type} members={[]} items={[]} phase="jour" className="-mx-[40%] -mt-3 w-[180%] max-w-none" />
              </div>
              <div>
                <p className="titre text-[18px]">Famille {preview.name}</p>
                <p className="text-[13.5px] text-brume">{preview.member_count} {preview.member_count > 1 ? 'membres t’attendent' : 'membre t’attend'}</p>
              </div>
            </div>
          )}
          {code.length === 6 && !preview && <p className="mt-3 text-center text-[14px] text-brume">On cherche cette maison…</p>}
          <div className="flex-1" />
          <Btn className="mt-6" onClick={() => setStep('profil')} disabled={!preview}>C’est bien ma famille</Btn>
        </div>
      )}

      {step === 'profil' && (
        <div className="anim-entre flex flex-1 flex-col pt-4">
          <h1 className="titre text-center text-[30px] leading-tight">Et toi, qui es-tu ?</h1>
          <p className="mb-5 mt-1 text-center text-[15px] text-brume">C’est ce que ta famille verra à la fenêtre.</p>
          <ProfilePicker name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} />
          <div className="flex-1" />
          <Btn className="mt-6" onClick={finish} disabled={busy || !name.trim()}>
            {busy ? 'Un instant…' : path === 'creer' ? 'Construire la maison' : 'Entrer dans la maison'}
          </Btn>
        </div>
      )}

      {step === 'invite' && created && (
        <div className="anim-entre flex flex-1 flex-col pt-6 text-center">
          <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-4xl shadow-doux">
            <House type={houseType} members={[]} items={[]} className="w-full" />
          </div>
          <h1 className="titre mt-6 text-[30px] leading-tight">La maison est prête</h1>
          <p className="mx-auto mt-2 max-w-[280px] text-[15px] text-brume">Elle s’animera à chaque proche qui arrive. Envoie-leur ce code.</p>
          <button
            onClick={async () => (await copy(created.code)) && toast('Code copié')}
            className="appui mx-auto mt-5 flex items-center gap-3 rounded-3xl bg-white px-6 py-4 shadow-carte"
            aria-label={`Copier le code ${created.code}`}
          >
            <span className="font-titre text-[32px] font-semibold tracking-[0.22em]">{created.code}</span>
            <Copy size={18} className="text-brume" />
          </button>
          <div className="flex-1" />
          <Btn
            className="mt-6"
            onClick={async () => {
              const r = await shareInvite(family.trim(), created.code)
              if (r === 'copie') toast('Invitation copiée')
            }}
          >
            <Share2 size={18} /> Inviter mes proches
          </Btn>
          <Btn kind="fantome" className="mt-3" onClick={() => void open(created.id).then(() => onCancel?.())}>Entrer dans la maison</Btn>
        </div>
      )}
    </div>
  )
}
