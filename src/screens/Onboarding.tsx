import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Heart, House as HouseIcon, Images, Mail, MessageCircleHeart, Share, Smile } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import House from '../components/House'
import { HousePicker, ProfileStep } from '../components/pickers'
import { select, success, tap } from '../lib/haptic'
import { copy, shareInvite } from '../lib/share'
import { useStore } from '../lib/store'
import type { HouseType } from '../lib/types'
import { encodeLook, lookOf, randomLook } from '../lib/look'
import { PEAUX } from '../lib/peaux'
import { PERSOS } from '../lib/persos'
import { AGES, cheveuxPossibles, figurinePour, GENRES, TEINTS, type Presentation } from '../lib/presentation'
import { errorText, familyLabel } from '../lib/util'
import { ONBOARDING as T } from '../lib/textes'

/* L'accueil, dans l'esprit de celui de Requête (un panda qui parle dans une bulle, une question par écran,
   des cartes à choisir, l'étape en cours en haut), aux couleurs de Nidoo.
   Premier passage : bonjour → prénom → ce qui t'amène → tes proches → créer ou rejoindre
   → (personnage, maison) ou (code, personnage) → connexion → invitation.
   Depuis Famille (« ajouter une maison ») : on va droit au choix, sans les questions ni la connexion. */
type Step = 'bonjour' | 'prenom' | 'qui' | 'allure' | 'raison' | 'proches' | 'choix' | 'code' | 'perso' | 'maison' | 'connexion' | 'invite'

const RAISONS = [
  { key: 'lien', label: 'Garder le lien avec mes proches éloignés', Icon: Heart, fond: '#FFE6EE', encre: '#D23F72' },
  { key: 'photos', label: 'Partager nos photos et nos souvenirs', Icon: Images, fond: '#E3F0FF', encre: '#2F6FD6' },
  { key: 'quotidien', label: 'Organiser le quotidien de la famille', Icon: CalendarDays, fond: '#E3F6EC', encre: '#14955A' },
  { key: 'nouvelles', label: 'Prendre des nouvelles d’un proche âgé', Icon: MessageCircleHeart, fond: '#FFEDE2', encre: '#E26F3C' },
  { key: 'jouer', label: 'Jouer et rire ensemble', Icon: Smile, fond: '#FFF4D6', encre: '#B07A00' },
] as const

// chaque cercle de proches, avec deux têtes de personnages de l'appli
const PROCHES = [
  { key: 'parents', label: 'Mes parents', persos: ['f03', 'h02'] },
  { key: 'grands-parents', label: 'Mes grands-parents', persos: ['gf1', 'gm1'] },
  { key: 'enfants', label: 'Mes enfants', persos: ['fi1', 'gi1'] },
  { key: 'petits-enfants', label: 'Mes petits-enfants', persos: ['b1', 'fi2'] },
  { key: 'fratrie', label: 'Mes frères et sœurs', persos: ['fa1', 'ga1'] },
  { key: 'amoureux', label: 'Mon amoureux·se', persos: ['f14', 'h13'] },
] as const

const PANDA = (humeur: string) => `./art/stickers/panda-${humeur}.webp`

/** Une tête de personnage, recadrée dans la figurine entière. */
function Tete({ id, size = 34 }: { id: string; size?: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded-full bg-[#EEE8FC] ring-2 ring-white" style={{ width: size, height: size }}>
      <img src={`./art/persos/${id}.webp`} alt="" className="block max-w-none" style={{ width: size * 1.56, marginLeft: -size * 0.28, marginTop: -size * 0.04 }} />
    </span>
  )
}

/** Le panda et sa bulle, comme la mascotte de Requête. */
function Panda({ humeur = 'heureux', children }: { humeur?: string; children: ReactNode }) {
  return (
    <div className="mt-5 flex items-center gap-3.5">
      <img src={PANDA(humeur)} alt="" width={74} height={74} className="ob-salut h-[74px] w-[74px] shrink-0 drop-shadow-[0_6px_10px_rgba(30,10,90,0.35)]" />
      <p className="ob-bulle queue-gauche min-w-0 flex-1">{children}</p>
    </div>
  )
}

/** Un titre avec un mot mis en avant : « Faisons [connaissance]. » */
function Titre({ avant = '', mot, apres = '' }: { avant?: string; mot: string; apres?: string }) {
  return (
    <h1 className="ob-titre text-center outline-none">
      {avant}
      <span className="ob-mot">{mot}</span>
      {apres}
    </h1>
  )
}

function Bientot() {
  return <span className="ob-bientot">BIENTÔT</span>
}

export default function Onboarding({ onCancel }: { onCancel?: () => void }) {
  const { api, open, toast, reload } = useStore()
  const urlCode = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? ''
  const invite = !!urlCode && !onCancel
  const [step, setStep] = useState<Step>(onCancel ? 'choix' : 'bonjour')
  const [path, setPath] = useState<'creer' | 'rejoindre' | null>(invite ? 'rejoindre' : null)
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
  const [raison, setRaison] = useState<string | null>(null)
  const [proches, setProches] = useState<string[]>([])
  // se présenter, pour qu'on propose la figurine qui ressemble
  const [pres, setPres] = useState<Presentation>({})
  const propose = useRef('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    container.current.scrollTop = 0
    const heading = container.current.querySelector('h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus({ preventScroll: true })
  }, [step])

  // En arrivant au personnage : la figurine qui ressemble à ce qu'on a dit (une seule fois par réponses données).
  const cleProposition = JSON.stringify(pres)
  useEffect(() => {
    if (step !== 'perso' || cleProposition === '{}' || propose.current === cleProposition) return
    propose.current = cleProposition
    const f = figurinePour(pres, PERSOS, PEAUX)
    if (f) setAvatar((v) => encodeLook({ ...lookOf(v), k: f.k, a: f.a, q: f.q, x: f.x, p: 0 }))
  }, [step, cleProposition, pres])

  // Invité par un lien : on montre tout de suite la maison qui l'attend.
  useEffect(() => {
    if (!invite || urlCode.length !== 6) return
    api.previewFamily(urlCode).then((p) => p && setPreview(p)).catch(() => undefined)
  }, [api, invite, urlCode])

  // Le parcours, selon qu'on crée ou qu'on rejoint
  const flow = useMemo<Step[]>(() => {
    const debut: Step[] = onCancel ? ['choix'] : invite ? ['bonjour', 'prenom', 'qui', 'allure'] : ['bonjour', 'prenom', 'qui', 'allure', 'raison', 'proches', 'choix']
    const suite: Step[] = path === 'rejoindre' ? ['code', 'perso'] : ['perso', 'maison']
    return [...debut, ...suite, ...(onCancel ? [] : ['connexion' as Step])]
  }, [onCancel, invite, path])
  const etapes: Step[] = flow.filter((s) => s !== 'bonjour')
  const rang = etapes.indexOf(step) + 1
  const minutes = Math.max(1, Math.ceil((etapes.length - rang + 1) / 3))
  const aller = (s: Step) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setStep(s)
  }
  const suivant = () => {
    const i = flow.indexOf(step)
    if (i >= 0 && i < flow.length - 1) aller(flow[i + 1])
  }
  const back = () => {
    const i = flow.indexOf(step)
    if (i > 0) aller(flow[i - 1])
    else onCancel?.()
  }

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
        aller('perso')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e)
      // un code expiré ou trop d'essais : on garde le message précis ; le reste, c'est la connexion
      setCodeError(/CODE_EXPIRE|TROP_D_ESSAIS|NON_CONNECTE/.test(msg) ? errorText(e) : /CODE_INCONNU/.test(msg) ? T.join.invalid_code : T.join.network_error)
    }
    setChecking(false)
  }
  const nameTooLong = family.trim().length > NAME_MAX

  // on garde les réponses pour plus tard (elles ne quittent pas l'appareil)
  const garderReponses = () => {
    try {
      localStorage.setItem('nidoo.bienvenue', JSON.stringify({ raison, proches, ...pres }))
    } catch {
      /* rien */
    }
  }

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      garderReponses()
      const id = await api.createFamily({ name: family.trim(), houseType, displayName: name.trim(), avatar, color })
      const cs = await api.circles()
      success()
      setCreated({ id, code: cs.find((c) => c.family.id === id)?.family.invite_code ?? '' })
      setStep('invite')
    } catch {
      setNameError(T.create.create_error)
      if (step === 'connexion') toast(T.create.create_error, 'err')
    }
    setBusy(false)
  }

  const join = async () => {
    if (busy) return
    setBusy(true)
    try {
      garderReponses()
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

  // la maison nommée : on passe à la connexion (ou on la crée tout de suite, depuis Famille)
  const validerMaison = () => {
    setNameError('')
    if (!family.trim()) return setNameError(T.create.empty_name)
    if (nameTooLong) return setNameError(T.create.name_too_long)
    if (onCancel) void create()
    else suivant()
  }
  // Se connecter : Apple, Google et l'e-mail arrivent bientôt ; en attendant, n'importe quel bouton fait entrer.
  const entrer = (via?: string) => {
    if (via) toast(`${via} arrive bientôt : en attendant, ta maison est gardée sur cet appareil.`)
    if (path === 'rejoindre') void join()
    else void create()
  }

  const prenom = name.trim()
  const header = step !== 'bonjour' && step !== 'invite'
  const pied = (() => {
    switch (step) {
      case 'prenom':
        return { label: 'Continuer', ok: !!prenom, go: suivant }
      case 'qui':
        return { label: 'Continuer', ok: !!pres.genre && !!pres.age, go: suivant, passer: true }
      case 'allure':
        return { label: 'Continuer', ok: !!pres.cheveux && pres.teint !== undefined, go: suivant, passer: true }
      case 'raison':
        return { label: 'Continuer', ok: !!raison, go: suivant, passer: true }
      case 'proches':
        return { label: 'Continuer', ok: proches.length > 0, go: suivant, passer: true }
      case 'choix':
        return { label: 'Continuer', ok: !!path, go: suivant }
      case 'code':
        return { label: checking ? T.join.loading : T.join.submit, ok: !checking, go: () => void verify() }
      case 'perso':
        return {
          label: busy ? 'Un instant…' : onCancel && path === 'rejoindre' ? 'Demander à entrer' : 'Continuer',
          ok: !!prenom && !busy,
          go: () => (onCancel && path === 'rejoindre' ? void join() : suivant()),
        }
      case 'maison':
        return { label: busy ? T.create.loading : onCancel ? T.create.submit : 'Continuer', ok: !busy, go: validerMaison }
      default:
        return null
    }
  })()

  return (
    <div data-feuilles className="ob relative flex h-full flex-col" style={{ paddingTop: 'var(--sat)' }}>
      {header && (
        <div className="shrink-0 px-5">
          <div className="flex h-[48px] items-center">
            <button onClick={back} className="presse -ml-2 flex h-11 min-w-[88px] items-center gap-0.5 pr-2 text-appel font-bold text-white" aria-label={rang <= 1 && onCancel ? 'Annuler' : 'Retour'}>
              <ChevronLeft size={24} strokeWidth={2.6} /> {rang <= 1 && onCancel ? 'Annuler' : 'Retour'}
            </button>
            {step !== 'connexion' && (
              <>
                <p className="flex-1 text-center text-note font-bold text-white/85">
                  Étape {rang} sur {etapes.length}
                </p>
                <p className="min-w-[88px] text-right text-note font-bold text-[#FFD27A]">≈ {minutes} min</p>
              </>
            )}
          </div>
          {step !== 'connexion' && (
            <div className="ob-traits mt-1" style={{ gridTemplateColumns: `repeat(${etapes.length}, 1fr)` }} aria-hidden="true">
              {etapes.map((s, i) => (
                <i key={s} className={i + 1 < rang ? 'fait' : i + 1 === rang ? 'ici' : ''} />
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={container} className="no-bar flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ paddingBottom: pied ? 12 : step === 'connexion' ? 0 : 'calc(var(--sab) + 18px)' }}>
        <div key={step} className={`anim-entre flex flex-1 flex-col ${step === 'connexion' ? '' : 'px-5'}`}>
          {step === 'bonjour' && (
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="flex-1" />
              <div className="ob-bulle queue-bas mx-auto mt-4 px-6 py-4 font-rond text-[19px] leading-6">Coucou ! Bienvenue chez vous 🧡</div>
              {/* le panda au milieu de petites cartes de la vie de la maison */}
              <div className="relative mt-5 h-[300px] w-full max-w-[340px]" aria-hidden="true">
                {/* centré par son cadre : l'animation du salut prend la transformation de l'image */}
                <div className="absolute left-1/2 top-[34px] -translate-x-1/2">
                  <img src={PANDA('heureux')} alt="" className="ob-salut h-[210px] w-[210px] drop-shadow-[0_14px_22px_rgba(30,10,90,0.4)]" />
                </div>
                <div className="ob-flotte absolute left-0 top-[26px] w-[118px] rounded-[10px] bg-white p-1.5 pb-4 shadow-[0_4px_0_rgba(36,16,110,0.3)]" style={{ ['--r' as string]: '-7deg' }}>
                  <div className="h-[78px] overflow-hidden rounded-[6px]"><House type="maison" items={[]} phase="jour" className="!aspect-auto h-full" bare /></div>
                </div>
                <div className="ob-flotte absolute -right-1 top-[6px] flex items-center gap-2 rounded-2xl bg-white py-2 pl-2 pr-3 text-left shadow-[0_4px_0_rgba(36,16,110,0.3)]" style={{ ['--r' as string]: '5deg', animationDelay: '-1.4s' }}>
                  <Tete id="gf1" size={34} />
                  <div>
                    <p className="text-[11px] font-bold leading-3 text-teinte-fonce">Mamie</p>
                    <p className="text-[13.5px] font-extrabold leading-4 text-encre">Je pense à toi 💜</p>
                  </div>
                </div>
                <div className="ob-flotte absolute bottom-6 left-1 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left shadow-[0_4px_0_rgba(36,16,110,0.3)]" style={{ ['--r' as string]: '4deg', animationDelay: '-2.6s' }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#E3F6EC] text-[#14955A]"><CalendarDays size={17} strokeWidth={2.4} /></span>
                  <div>
                    <p className="text-[11px] font-bold leading-3 text-[#625A75]">Dimanche · 12 h</p>
                    <p className="text-[13.5px] font-extrabold leading-4 text-encre">Déjeuner chez Mamie</p>
                  </div>
                </div>
                <img src="./art/reaction-amour.webp" alt="" className="ob-flotte absolute bottom-10 right-3 h-[58px] w-[58px] drop-shadow-[0_4px_0_rgba(36,16,110,0.3)]" style={{ ['--r' as string]: '-8deg', animationDelay: '-0.7s' }} />
              </div>
              <p className="mt-2 font-rond text-[46px] font-extrabold leading-[50px] tracking-[0.06em] text-[#FFD27A] drop-shadow-[0_3px_0_rgba(36,16,110,0.35)]">NIDOO</p>
              <h1 className="mx-auto mt-2 max-w-[300px] text-[19px] font-extrabold leading-6 outline-none [text-wrap:balance]">{T.home.headline}</h1>
              {invite && (
                <div className="mt-4 flex w-full items-center gap-3 rounded-[18px] border-[1.5px] border-white/30 bg-white/[0.14] py-2.5 pl-2.5 pr-4 text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-teinte-fonce"><HouseIcon size={22} strokeWidth={2.3} /></span>
                  <span className="min-w-0">
                    <b className="block truncate text-appel font-extrabold">{preview ? `« ${familyLabel(preview.name)} » t’attend` : 'Tu as reçu une invitation'}</b>
                    <small className="block text-note font-semibold text-white/85">Code {urlCode} · on s’occupe du reste</small>
                  </span>
                </div>
              )}
              <div className="flex-1" />
              <button className="ob-cta mt-6" onClick={() => (tap(), aller('prenom'))}>
                {invite ? 'Rejoindre mes proches' : 'Commencer'} <ChevronRight size={20} strokeWidth={2.8} />
              </button>
              <p className="mt-3 text-note font-semibold text-white/75">Photos, petits mots, rendez-vous… tout votre quotidien.</p>
            </div>
          )}

          {step === 'prenom' && (
            <form className="flex flex-1 flex-col" noValidate onSubmit={(e) => (e.preventDefault(), prenom && suivant())}>
              <div className="mt-4"><Titre avant="Faisons " mot="connaissance" apres="." /></div>
              <p className="ob-sous mt-2 text-center">Quelques questions rapides pour préparer votre petit chez-vous.</p>
              <Panda>Coucou ! Comment tes proches t’appellent&#8209;ils ?</Panda>
              <label htmlFor="ob-prenom" className="mb-1.5 mt-6 px-1 text-sous font-bold text-white">Ton prénom ou ton surnom</label>
              <input
                id="ob-prenom"
                className="ob-champ"
                placeholder="Ex. Léa, Mamie Jo…"
                autoComplete="given-name"
                enterKeyHint="next"
                maxLength={32}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mt-2 px-1 text-note text-white/75">Il apparaît sous ton personnage, pour toute la famille.</p>
            </form>
          )}

          {step === 'qui' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Qui " mot="es-tu" apres=" ?" /></div>
              <p className="ob-sous mt-2 text-center">Pour te proposer un personnage qui te ressemble.</p>
              <Panda>{prenom ? `Enchanté, ${prenom} ! Dis-m’en un peu plus.` : 'Enchanté ! Dis-m’en un peu plus.'}</Panda>
              <p id="ob-genre" className="mb-2 mt-6 px-1 text-sous font-bold">Tu es</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-genre">
                {GENRES.map((g) => (
                  <button key={g.key} type="button" className="ob-puce" aria-pressed={pres.genre === g.key} onClick={() => (select(), setPres((p) => ({ ...p, genre: g.key })))}>
                    {g.label}
                  </button>
                ))}
              </div>
              <p id="ob-age" className="mb-2 mt-6 px-1 text-sous font-bold">Ton âge</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="ob-age">
                {AGES.map((g, i) => (
                  <button key={g.key} type="button" className={`ob-puce ${i === AGES.length - 1 ? 'col-span-2' : ''}`} aria-pressed={pres.age === g.key} onClick={() => (select(), setPres((p) => ({ ...p, age: g.key, cheveux: p.cheveux && cheveuxPossibles({ ...p, age: g.key }).some((c) => c.key === p.cheveux) ? p.cheveux : undefined })))}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'allure' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ton " mot="allure" apres="." /></div>
              <p className="ob-sous mt-2 text-center">Encore quelques détails, et ton personnage est prêt.</p>
              <Panda humeur="motive">Et tes cheveux, ils sont comment ?</Panda>
              <p id="ob-cheveux" className="mb-2 mt-6 px-1 text-sous font-bold">Tes cheveux</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-cheveux">
                {cheveuxPossibles(pres).map((c) => (
                  <button key={c.key} type="button" className="ob-puce !pl-2.5" aria-pressed={pres.cheveux === c.key} onClick={() => (select(), setPres((p) => ({ ...p, cheveux: c.key })))}>
                    <span className="h-6 w-6 shrink-0 rounded-full ring-2 ring-white/70" style={{ background: c.couleur }} aria-hidden="true" />
                    {c.label}
                  </button>
                ))}
              </div>
              <p id="ob-peau" className="mb-2 mt-6 px-1 text-sous font-bold">Ta peau</p>
              <div className="flex justify-between gap-2 px-1" role="group" aria-labelledby="ob-peau">
                {TEINTS.map((t, i) => (
                  <button key={t.couleur} type="button" className="ob-teint" style={{ background: t.couleur }} aria-label={t.label} aria-pressed={pres.teint === i} onClick={() => (select(), setPres((p) => ({ ...p, teint: i })))} />
                ))}
              </div>
              <p id="ob-lunettes" className="mb-2 mt-6 px-1 text-sous font-bold">Des lunettes ?</p>
              <div className="flex gap-2" role="group" aria-labelledby="ob-lunettes">
                {([[true, 'Oui'], [false, 'Non']] as const).map(([v, l]) => (
                  <button key={l} type="button" className="ob-puce min-w-[96px]" aria-pressed={pres.lunettes === v} onClick={() => (select(), setPres((p) => ({ ...p, lunettes: v })))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'raison' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ce qui " mot="compte" apres=" pour toi." /></div>
              <p className="ob-sous mt-2 text-center">Nidoo s’adapte à ce que vous aimez partager.</p>
              <Panda humeur="motive">{prenom ? `${prenom}, qu’est-ce` : 'Qu’est-ce'} qui t’amène sur Nidoo ?</Panda>
              <div className="mt-5 grid gap-3" role="group" aria-label="Ce qui t’amène">
                {RAISONS.map(({ key, label, Icon, fond, encre }) => (
                  <button key={key} type="button" aria-pressed={raison === key} className="ob-choix" onClick={() => (select(), setRaison(key))}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: fond, color: encre }}>
                      <Icon size={19} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 flex-1">{label}</span>
                    {raison === key && <span className="ob-coche anim-pop"><Check size={15} strokeWidth={3.4} /></span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'proches' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ta " mot="tribu" apres=", en un clin d’œil." /></div>
              <p className="ob-sous mt-2 text-center">Choisis tous ceux qui comptent : on préparera la maison pour eux.</p>
              <Panda humeur="amour">Avec qui veux-tu partager ta maison ?</Panda>
              <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Tes proches (plusieurs choix possibles)">
                {PROCHES.map(({ key, label, persos }) => {
                  const on = proches.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      className="ob-choix !flex-col !items-start !gap-2 !py-3"
                      onClick={() => (select(), setProches((p) => (on ? p.filter((x) => x !== key) : [...p, key])))}
                    >
                      <span className="flex">
                        {persos.map((id, k) => (
                          <span key={id} style={{ marginLeft: k ? -9 : 0 }}><Tete id={id} size={38} /></span>
                        ))}
                      </span>
                      <span className="text-[15px] leading-[19px]">{label}</span>
                      {on && <span className="ob-coche anim-pop"><Check size={15} strokeWidth={3.4} /></span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'choix' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ta " mot="maison" apres=" t’attend." /></div>
              <p className="ob-sous mt-2 text-center">Tu peux en créer une, ou rejoindre celle de tes proches.</p>
              <Panda humeur="fete">On crée votre maison, ou tu as reçu un code d’invitation ?</Panda>
              <div className="mt-5 grid gap-3" role="group" aria-label="Créer ou rejoindre">
                {([
                  { key: 'creer', titre: T.home.create_cta, sous: 'Tu inviteras tes proches juste après.', Icon: HouseIcon, fond: '#EEE8FC', encre: '#6646CC' },
                  { key: 'rejoindre', titre: T.home.join_cta, sous: 'Avec le code reçu d’un proche.', Icon: Mail, fond: '#FFEDE2', encre: '#E26F3C' },
                ] as const).map(({ key, titre, sous, Icon, fond, encre }) => (
                  <button key={key} type="button" aria-pressed={path === key} className="ob-choix !min-h-[76px]" onClick={() => (select(), setPath(key))}>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: fond, color: encre }}>
                      <Icon size={24} strokeWidth={2.3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-extrabold">{titre}</span>
                      <span className="mt-0.5 block text-note font-semibold text-[#625A75]">{sous}</span>
                    </span>
                    {path === key && <span className="ob-coche anim-pop"><Check size={15} strokeWidth={3.4} /></span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'code' && (
            <form className="flex flex-1 flex-col" noValidate onSubmit={(e) => (e.preventDefault(), void verify())}>
              <div className="mt-4"><Titre avant="Ton code d’" mot="invitation" apres="." /></div>
              <p className="ob-sous mt-2 text-center">{T.join.description}</p>
              <Panda humeur="motive">Ton proche t’a envoyé un code à 6 caractères.</Panda>
              <label htmlFor="code-invitation" className="mb-1.5 mt-6 px-1 text-sous font-bold text-white">{T.join.field_label}</label>
              <input
                id="code-invitation"
                className={`ob-champ !h-[68px] text-center font-rond !text-[30px] font-extrabold uppercase tracking-[0.3em] placeholder:!text-[18px] placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal ${codeError ? '!shadow-[0_0_0_3px_#FF8A80,0_4px_0_3px_rgba(36,16,110,0.28)]' : ''}`}
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
              />
              <p id="code-aide" role={codeError ? 'alert' : 'status'} className={`mt-2 min-h-[20px] px-1 text-center text-sous font-semibold ${codeError ? 'text-[#FFD0CC]' : 'text-white/75'}`}>
                {codeError || (checking ? T.join.loading : T.join.helper)}
              </p>
            </form>
          )}

          {step === 'perso' && (
            <div className="flex flex-1 flex-col">
              {path === 'rejoindre' && preview && (
                <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-white/[0.14] p-2.5 ring-[1.5px] ring-inset ring-white/30">
                  <div className="h-[52px] w-[68px] shrink-0 overflow-hidden rounded-[12px]">
                    <House type={preview.house_type} items={[]} phase="jour" className="h-full !aspect-auto" bare />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-appel font-extrabold">{familyLabel(preview.name)}</p>
                    <p className="text-note font-semibold text-white/80">
                      {preview.member_count} {preview.member_count > 1 ? 'membres' : 'membre'} · entrée sur acceptation
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4"><Titre avant="Ton " mot="personnage" apres="." /></div>
              <p className="ob-sous mb-4 mt-2 text-center">
                {propose.current ? `Voilà ton personnage${prenom ? `, ${prenom}` : ''} ! Change-le si tu veux, quand tu veux.` : `${prenom ? `À quoi tu ressembles, ${prenom} ? ` : ''}Tu pourras le changer quand tu veux.`}
              </p>
              <ProfileStep name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} sansNom />
              {onCancel && (
                <>
                  <label htmlFor="ob-prenom" className="mb-1.5 mt-5 px-1 text-sous font-bold text-white">Ton prénom ou ton surnom</label>
                  <input id="ob-prenom" className="ob-champ" placeholder="Ex. Léa, Mamie Jo…" autoComplete="given-name" enterKeyHint="done" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
                  <p className="mt-2 px-1 text-note text-white/75">Il apparaît sous ton personnage, pour toute la famille.</p>
                </>
              )}
            </div>
          )}

          {step === 'maison' && (
            <form className="flex flex-1 flex-col" noValidate onSubmit={(e) => (e.preventDefault(), validerMaison())}>
              <div className="mt-4"><Titre avant="Votre petit " mot="chez-vous" apres="." /></div>
              <p className="ob-sous mt-2 text-center">{T.create.description}</p>
              <label htmlFor="nom-maison" className="mb-1.5 mt-5 px-1 text-sous font-bold text-white">{T.create.field_label}</label>
              <input
                id="nom-maison"
                autoComplete="off"
                enterKeyHint="done"
                className={`ob-champ ${nameError || nameTooLong ? '!shadow-[0_0_0_3px_#FF8A80,0_4px_0_3px_rgba(36,16,110,0.28)]' : ''}`}
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
              <p id="nom-maison-aide" role={nameError || nameTooLong ? 'alert' : undefined} className={`mt-1.5 min-h-[20px] px-1 text-note font-semibold ${nameError || nameTooLong ? 'text-[#FFD0CC]' : 'text-white/75'}`}>
                {nameError || (nameTooLong ? T.create.name_too_long : family.length > NAME_MAX - 10 ? `${family.trim().length}/${NAME_MAX}` : '')}
              </p>
              <p className="mb-0 mt-2 px-1 text-sous font-bold text-white">{T.create.decor}</p>
              <HousePicker value={houseType} onChange={setHouseType} />
              <p className="mt-3 text-center text-note font-semibold text-white/75">{T.create.decor_later}</p>
            </form>
          )}

          {step === 'connexion' && (
            <div className="flex flex-1 flex-col">
              <div className="px-5 text-center">
                <h1 className="ob-titre mt-3 outline-none">Presque fini !</h1>
                <p className="ob-sous mt-1.5">Connecte-toi en un geste, et c’est parti.</p>
              </div>
              <div className="flex-1" />
              <div className="relative mt-10">
                <img src={PANDA('amour')} alt="" className="ob-salut absolute -top-[64px] right-6 h-[92px] w-[92px] drop-shadow-[0_8px_12px_rgba(30,10,90,0.35)]" />
                <div className="ob-feuille px-5 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}>
                  <span className="mx-auto mb-4 block h-[5px] w-10 rounded-full bg-[#E4DFF3]" aria-hidden="true" />
                  <h2 className="ob-titre text-center !text-[27px] !leading-[32px] text-encre">
                    Ta maison, <span className="ob-mot">partout avec toi</span>.
                  </h2>
                  <p className="mt-2 text-center text-sous text-[#625A75] [text-wrap:pretty]">Connecte-toi pour retrouver ta maison, tes photos et tes proches sur tous tes appareils.</p>
                  <div className="mt-5 grid gap-2.5">
                    <button className="presse flex h-[52px] items-center gap-3 rounded-[15px] bg-black px-4 text-appel font-bold text-white" onClick={() => (tap(), entrer('La connexion avec Apple'))} disabled={busy}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.3-3.5ZM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22Z" /></svg>
                      <span className="flex-1 text-left">Continuer avec Apple</span>
                      <Bientot />
                    </button>
                    <button className="presse flex h-[52px] items-center gap-3 rounded-[15px] bg-white px-4 text-appel font-bold text-encre ring-[1.5px] ring-inset ring-[#E4DFF3]" onClick={() => (tap(), entrer('La connexion avec Google'))} disabled={busy}>
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" /></svg>
                      <span className="flex-1 text-left">Continuer avec Google</span>
                      <Bientot />
                    </button>
                    <p className="my-0.5 text-center text-note font-semibold text-[#8C86A3]">ou</p>
                    <button className="presse flex h-[52px] items-center gap-3 rounded-[15px] bg-white px-4 text-appel font-semibold text-[#8C86A3] ring-[1.5px] ring-inset ring-[#E4DFF3]" onClick={() => (tap(), entrer('La connexion par e-mail'))} disabled={busy}>
                      <Mail size={19} strokeWidth={2.2} className="text-teinte" />
                      <span className="flex-1 text-left">Ton adresse e-mail</span>
                      <Bientot />
                    </button>
                  </div>
                  <button className="ob-cta violet mt-5" onClick={() => (tap(), entrer())} disabled={busy}>
                    {busy ? (path === 'rejoindre' ? 'Un instant…' : T.create.loading) : path === 'rejoindre' ? 'Demander à entrer' : 'Continuer'} {!busy && <ChevronRight size={20} strokeWidth={2.8} />}
                  </button>
                  <p className="mt-3 text-center text-note text-[#8C86A3] [text-wrap:pretty]">En attendant la connexion, ta maison est gardée sur cet appareil.</p>
                </div>
              </div>
            </div>
          )}

          {step === 'invite' && created && (
            <div className="flex flex-1 flex-col pt-6 text-center">
              <div className="mx-auto w-full overflow-hidden rounded-[26px] bg-white p-1.5 shadow-[0_5px_0_rgba(36,16,110,0.32)]">
                <div className="overflow-hidden rounded-[21px]"><House type={houseType} items={[]} /></div>
              </div>
              <h1 className="ob-titre mx-auto mt-6 max-w-[330px] outline-none">
                Votre petit <span className="ob-mot">chez-vous</span> est prêt ✨
              </h1>
              <p className="ob-sous mx-auto mt-2 max-w-[300px]">{T.invite.description}</p>
              <button
                onClick={async () => (await copy(created.code)) && toast('Code copié')}
                className="ob-choix mx-auto mt-5 !w-auto !justify-center !gap-3 !px-6 !py-3"
                aria-label={`Copier le code ${created.code}`}
              >
                <span className="font-rond text-[30px] font-extrabold tracking-[0.22em] text-encre">{created.code}</span>
                <Copy size={18} className="text-teinte" />
              </button>
              <p className="mt-3 text-note font-semibold text-white/80">{T.invite.code_hint}</p>
              <div className="flex-1" />
              <button
                className="ob-cta mt-6"
                onClick={async () => {
                  tap()
                  const r = await shareInvite(family.trim(), created.code)
                  if (r === 'copie') toast('Invitation copiée')
                }}
              >
                <Share size={19} strokeWidth={2.5} /> {T.invite.share}
              </button>
              <button className="ob-cta leger mt-3" onClick={() => (tap(), void open(created.id).then(() => onCancel?.()))}>{T.invite.enter}</button>
              <p className="mt-3 text-note font-semibold text-white/75">{T.invite.later}</p>
            </div>
          )}
        </div>
      </div>

      {pied && (
        <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}>
          <button className="ob-cta" disabled={!pied.ok} onClick={() => (tap(), pied.go())}>
            {pied.label} {pied.ok && !busy && !checking && <ChevronRight size={20} strokeWidth={2.8} />}
          </button>
          {pied.passer && (
            <button className="presse mx-auto mt-1.5 flex h-10 items-center px-4 text-sous font-bold text-white/80" onClick={() => (tap(), suivant())}>
              Passer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
