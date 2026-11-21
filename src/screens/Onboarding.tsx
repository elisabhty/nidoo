import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Heart, House as HouseIcon, Images, KeyRound, Mail, MessageCircleHeart, Share, Smile } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import House from '../components/House'
import { CommentAjouter, EcranNotifications, EcranWidgets } from '../components/accueilApercus'
import { Avatar } from '../components/ui'
import { coeurs, confettis, feuxDArtifice, petille } from '../lib/fete'
import { demanderNotifications, noterNotifications, premiereNotification } from '../lib/notifications'
import { WIDGETS } from '../lib/widgets'
import { HousePicker, ProfileStep } from '../components/pickers'
import { select, success, tap, warn } from '../lib/haptic'
import { copy, shareInvite } from '../lib/share'
import { useStore } from '../lib/store'
import type { HouseType } from '../lib/types'
import { encodeLook, lookOf, randomLook } from '../lib/look'
import { PEAUX } from '../lib/peaux'
import { PERSOS } from '../lib/persos'
import { persoImg } from '../lib/personnalise'
import { AGES, cheveuxPossibles, figurinePour, GENRES, noterFigurine, TEINTS, type Age, type Genre, type Presentation } from '../lib/presentation'
import { errorText, familyLabel } from '../lib/util'
import { retenirNaissance } from '../lib/naissance'
import { ONBOARDING as T } from '../lib/textes'

/* L'accueil, dans l'esprit de celui de Requête (un panda qui parle dans une bulle, une question par écran,
   des cartes à choisir, l'étape en cours en haut), aux couleurs de Nidoo.
   Premier passage : bonjour → Panda se présente → prénom → qui es-tu → allure → ce qui t'amène → tes proches → créer ou rejoindre
   → (personnage, maison) ou (code, personnage) → notifications → widgets → connexion → invitation.
   Depuis Famille (« ajouter une maison ») : on va droit au choix, sans les questions ni la connexion. */
type Step = 'bonjour' | 'panda' | 'prenom' | 'qui' | 'allure' | 'naissance' | 'raison' | 'proches' | 'choix' | 'code' | 'perso' | 'maison' | 'notifs' | 'widgets' | 'connexion' | 'invite'

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

/** Des idées de nom pour la maison (un toucher remplit le champ). */
const IDEES_NOMS = (prenom: string) => ['Notre petit cocon', 'Le nid douillet', prenom ? `La tribu de ${prenom}` : 'La tribu', 'La maison du bonheur']

// « Qui es-tu ? » : une tête par réponse, et pour chaque âge une figurine du bon genre (elles changent avec lui)
const TETES: Record<Genre, string[]> = { femme: ['f03'], homme: ['h02'], neutre: ['f06', 'h03'] }
const PAR_AGE: Record<Genre, Record<Age, string>> = {
  femme: { enfant: 'fi1', ado: 'fa1', jeune: 'f01', adulte: 'f03', senior: 'gf1' },
  homme: { enfant: 'gi1', ado: 'ga1', jeune: 'h01', adulte: 'h02', senior: 'gm1' },
  neutre: { enfant: 'fi3', ado: 'ga2', jeune: 'f06', adulte: 'h03', senior: 'gf2' },
}
const TAILLE_AGE: Record<Age, number> = { enfant: 0.74, ado: 0.88, jeune: 1, adulte: 1, senior: 0.97 }
const AGE_COURT: Record<Age, string> = { enfant: 'Moins de 12 ans', ado: '12 à 17 ans', jeune: '18 à 34 ans', adulte: '35 à 59 ans', senior: '60 ans et plus' }

/** Une tête de personnage, recadrée dans la figurine entière. */
function Tete({ id, size = 34 }: { id: string; size?: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded-full bg-[#EEE8FC] ring-2 ring-white" style={{ width: size, height: size }}>
      <img src={`./art/persos/${id}.webp`} alt="" className="block max-w-none" style={{ width: size * 1.56, marginLeft: -size * 0.28, marginTop: -size * 0.04 }} />
    </span>
  )
}

/** Un petit saut (Panda caressé), puis il reprend ce qu'il faisait (flotter, saluer). */
function sauter(el: Element | null | undefined) {
  if (!(el instanceof HTMLElement)) return
  el.classList.remove('panda-saute')
  void el.offsetWidth
  el.classList.add('panda-saute')
  el.addEventListener('animationend', () => el.classList.remove('panda-saute'), { once: true })
}

/** Ce que dit Panda quand on le caresse. */
const CHATOUILLES = ['Hihi, ça chatouille !', 'Encore une caresse ? 🥰', 'Je suis tout doux, hein ?', 'On fait une super équipe !']

/** Le panda et sa bulle, comme la mascotte de Requête. On peut le caresser : il saute, des cœurs s'envolent.
 *  La bulle rebondit à chaque nouvelle phrase. */
function Panda({ humeur = 'heureux', children, visuel }: { humeur?: string; children: ReactNode; visuel?: ReactNode }) {
  const [caresse, setCaresse] = useState(-1)
  const texte = caresse >= 0 ? CHATOUILLES[caresse % CHATOUILLES.length] : children
  const cle = typeof texte === 'string' ? texte : String(caresse)
  return (
    <div className="mt-5 flex items-center gap-3.5">
      {visuel ?? (
        <button
          type="button"
          aria-label="Caresser Panda"
          className="shrink-0"
          onClick={(e) => {
            tap()
            coeurs(e.currentTarget, 7)
            setCaresse((c) => c + 1)
            sauter(e.currentTarget.firstElementChild)
          }}
        >
          <img key={humeur} src={PANDA(humeur)} alt="" width={74} height={74} className="ob-salut h-[74px] w-[74px] drop-shadow-[0_6px_10px_rgba(30,10,90,0.35)]" />
        </button>
      )}
      <p key={cle} className="ob-bulle queue-gauche bulle-rebond min-w-0 flex-1" aria-live="polite">{texte}</p>
    </div>
  )
}

/** Un titre avec un mot mis en avant : « Faisons [connaissance]. » */
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function Titre({ avant = '', mot, apres = '' }: { avant?: string; mot: string; apres?: string }) {
  return (
    <h1 className="ob-titre text-center outline-none">
      {avant}
      <span className="ob-mot">{mot}</span>
      {apres}
    </h1>
  )
}


export default function Onboarding({ onCancel }: { onCancel?: () => void }) {
  const { api, open, toast, reload } = useStore()
  const urlCode = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? ''
  const invite = !!urlCode && !onCancel
  const [step, setStep] = useState<Step>(onCancel ? 'choix' : 'bonjour')
  const [path, setPath] = useState<'creer' | 'rejoindre' | null>(invite ? 'rejoindre' : null)
  const [family, setFamily] = useState<string>('')
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
  // l'anniversaire (jour et mois) : il ira tout seul dans l'agenda de la maison
  const [ne, setNe] = useState<{ j: number | null; m: number | null }>({ j: null, m: null })
  const [proches, setProches] = useState<string[]>([])
  // se présenter, pour qu'on propose la figurine qui ressemble
  const [pres, setPres] = useState<Presentation>({})
  const propose = useRef('')
  const graine = useRef(Math.floor(Math.random() * 2147483646) + 1)
  const hasard = () => {
    let g = graine.current
    return () => ((g = (g * 48271) % 2147483647), g / 2147483647)
  }
  const proposition = (p: Presentation) => figurinePour(p, PERSOS, PEAUX, hasard())
  const apercu = useMemo(() => {
    const f = pres.genre || pres.age ? proposition(pres) : null
    return f ? encodeLook({ ...lookOf(avatar), k: f.k, a: f.a, q: f.q, x: f.x, p: 0 }) : null
  }, [pres]) // eslint-disable-line react-hooks/exhaustive-deps
  const [notifs, setNotifs] = useState<'oui' | 'non' | null>(null)
  const [bulle, setBulle] = useState(0)
  const [copie, setCopie] = useState(false)
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

  // Les images de l'accueil, chargées d'avance : chaque écran arrive entier (pas de panda ni de figurine qui apparaît après).
  useEffect(() => {
    for (const h of ['heureux', 'motive', 'amour', 'fete']) new Image().src = PANDA(h)
    for (const id of new Set([...Object.values(TETES).flat(), ...PROCHES.flatMap((p) => p.persos)])) new Image().src = `./art/persos/${id}.webp`
  }, [])
  // …et les figurines qui ressemblent le plus à ce qu'on vient de dire
  useEffect(() => {
    if (!pres.genre && !pres.age) return
    const t = window.setTimeout(() => {
      PERSOS.map((f) => ({ f, n: noterFigurine(pres, f, PEAUX) }))
        .filter((x) => x.n)
        .sort((a, b) => b.n!.score - a.n!.score)
        .slice(0, 3)
        .forEach(({ f, n }) => (new Image().src = persoImg(f, n!.q)))
    }, 250)
    return () => window.clearTimeout(t)
  }, [pres])
  useEffect(() => {
    if (step === 'perso' && propose.current) {
      const t = window.setTimeout(() => (success(), confettis()), 380)
      return () => window.clearTimeout(t)
    }
    if (step === 'invite') {
      const t = window.setTimeout(() => (success(), feuxDArtifice(3200), window.setTimeout(confettis, 900)), 300)
      return () => window.clearTimeout(t)
    }
  }, [step])

  // Les notifications : la vraie demande d'iOS ; un « oui » fait la fête et envoie un premier petit mot de Panda
  const activerNotifications = async () => {
    const r = await demanderNotifications()
    if (r === 'oui') {
      setNotifs('oui')
      success()
      confettis()
      void premiereNotification(name.trim())
      window.setTimeout(suivant, 1400)
    } else {
      setNotifs('non')
      if (r === 'non') warn()
      toast(r === 'non' ? 'Pas de souci : tu pourras les activer dans les Réglages de ton iPhone.' : 'Les notifications arrivent avec l’appli iPhone.')
      window.setTimeout(suivant, 700)
    }
  }

  // Invité par un lien : on montre tout de suite la maison qui l'attend.
  useEffect(() => {
    if (!invite || urlCode.length !== 6) return
    api.previewFamily(urlCode).then((p) => p && setPreview(p)).catch(() => undefined)
  }, [api, invite, urlCode])

  // Le parcours, selon qu'on crée ou qu'on rejoint
  const flow = useMemo<Step[]>(() => {
    const debut: Step[] = onCancel ? ['choix'] : invite ? ['bonjour', 'panda', 'prenom', 'qui', 'allure', 'naissance'] : ['bonjour', 'panda', 'prenom', 'qui', 'allure', 'naissance', 'raison', 'proches', 'choix']
    const suite: Step[] = path === 'rejoindre' ? ['code', 'perso'] : ['perso', 'maison']
    return [...debut, ...suite, ...(onCancel ? [] : (['notifs', 'widgets', 'connexion'] as Step[]))]
  }, [onCancel, invite, path])
  const etapes: Step[] = flow.filter((s) => s !== 'bonjour' && s !== 'panda')
  const rang = etapes.indexOf(step) + 1
  const minutes = Math.max(1, Math.ceil((etapes.length - rang + 1) / 3))
  const aller = (s: Step) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    // en arrivant au personnage : la figurine qui ressemble à ce qu'on a dit (une fois par réponses données),
    // choisie avant d'afficher l'écran — pas une figurine au hasard remplacée sous les yeux
    const cle = JSON.stringify(pres)
    if (s === 'perso' && cle !== '{}' && propose.current !== cle) {
      propose.current = cle
      const f = proposition(pres)
      if (f) setAvatar((v) => encodeLook({ ...lookOf(v), k: f.k, a: f.a, q: f.q, x: f.x, p: 0 }))
    }
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
  const entrer = () => {
    if (path === 'rejoindre') void join()
    else void create()
  }

  const prenom = name.trim()
  const header = step !== 'bonjour' && step !== 'invite'
  const compte = step !== 'connexion' && step !== 'panda'
  const pied = (() => {
    switch (step) {
      case 'panda':
        return { label: 'C’est parti', ok: true, go: suivant }
      case 'prenom':
        return { label: 'Continuer', ok: !!prenom, go: suivant }
      case 'qui':
        return { label: 'Continuer', ok: !!pres.genre && !!pres.age, go: suivant, passer: true }
      case 'allure':
        return { label: 'Continuer', ok: !!pres.cheveux && pres.teint !== undefined, go: suivant, passer: true }
      case 'naissance':
        return {
          label: 'Continuer',
          ok: !!ne.j && !!ne.m,
          go: () => (retenirNaissance(`${String(ne.m).padStart(2, '0')}-${String(ne.j).padStart(2, '0')}`), suivant()),
          passer: true,
          surPasser: () => retenirNaissance(null),
        }
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
        return { label: busy ? T.create.loading : onCancel ? T.create.submit : 'Continuer', ok: !busy && !!family.trim(), go: validerMaison }
      case 'notifs':
        return notifs === 'oui'
          ? { label: 'C’est activé', ok: false, go: () => undefined }
          : { label: 'Activer les notifications', ok: true, go: () => void activerNotifications(), passer: 'Plus tard', surPasser: () => noterNotifications('plus-tard') }
      case 'widgets':
        return { label: 'J’ai compris', ok: true, go: suivant }
      default:
        return null
    }
  })()

  return (
    <div data-feuilles data-fond-clavier="#5132B4" className="ob relative flex h-full flex-col" style={{ paddingTop: 'var(--sat)' }}>
      {header && (
        <div className="shrink-0 px-5">
          <div className="flex h-[48px] items-center">
            <button onClick={back} className="presse -ml-2 flex h-11 min-w-[88px] items-center gap-0.5 pr-2 text-appel font-bold text-white" aria-label={rang <= 1 && onCancel ? 'Annuler' : 'Retour'}>
              <ChevronLeft size={24} strokeWidth={2.6} /> {rang <= 1 && onCancel ? 'Annuler' : 'Retour'}
            </button>
            {compte && (
              <>
                <p className="flex-1 text-center text-note font-bold text-white/85">
                  Étape {rang} sur {etapes.length}
                </p>
                <p className="min-w-[88px] text-right text-note font-bold text-[#FFD27A]">≈ {minutes} min</p>
              </>
            )}
          </div>
          {compte && (
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
            <div className="flex flex-1 flex-col">
              <div className="mx-auto flex w-full max-w-[370px] flex-1 flex-col items-center py-5 text-center">
                <p className="font-rond text-[22px] font-extrabold tracking-[0.12em] text-[#FFD27A]">NIDOO</p>
                <div className="relative my-5 flex h-[170px] w-[220px] items-center justify-center">
                  <span className="absolute inset-2 rounded-full bg-white/10" />
                  <button type="button" aria-label="Caresser Panda" className="relative" onClick={(e) => (tap(), coeurs(e.currentTarget, 9), sauter(e.currentTarget.firstElementChild))}>
                    <img src={PANDA('heureux')} alt="" width={160} height={160} className="ob-flotte h-40 w-40 object-contain drop-shadow-xl" />
                  </button>
                  <span className="etincelle" style={{ left: 18, top: 26 }} aria-hidden="true">✦</span>
                  <span className="etincelle" style={{ right: 26, top: 8, animationDelay: '0.7s' }} aria-hidden="true">✦</span>
                  <span className="etincelle" style={{ left: 40, bottom: 6, animationDelay: '1.3s' }} aria-hidden="true">✦</span>
                  <span className="absolute bottom-0 right-0 rounded-[18px] bg-white p-3 shadow-lg"><HouseIcon size={26} className="text-teinte" /></span>
                </div>
                <Titre avant="Bienvenue " mot="chez vous" apres="." />
                <p className="ob-sous mt-3 max-w-[320px] text-center">Une maison pour discuter, jouer et garder vos souvenirs en famille.</p>
                {invite && <p className="mt-4 rounded-full bg-white/15 px-4 py-2 text-sous font-semibold">Ton invitation est prête · {urlCode}</p>}
              </div>
              <div className="rounded-[28px] bg-white p-5 text-encre shadow-xl">
                <h2 className="text-center font-rond text-titre2">Connexion</h2>
                <p className="mt-1 text-center text-note text-brume">Entre librement pour découvrir Nidoo.</p>
                <button className="ob-cta violet mt-5" onClick={() => { tap(); aller('panda') }}>
                  Commencer <ChevronRight size={20} strokeWidth={2.8} />
                </button>
                <p className="my-3 text-center text-mini text-brume">Les connexions arrivent bientôt</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Apple', 'Google', 'E-mail'].map((service) => (
                    <button key={service} type="button" className="presse flex min-h-[52px] items-center justify-center gap-1.5 rounded-[16px] border border-[#E4DFF3] px-2 text-note font-semibold"
                      onClick={() => { tap(); toast(`La connexion avec ${service} arrive bientôt. Tu peux déjà découvrir Nidoo.`); aller('panda') }}>
                      {service === 'E-mail' && <Mail size={16} />} {service}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-center text-mini leading-relaxed text-brume">Aucun mot de passe demandé pour le moment.</p>
              </div>
            </div>
          )}

          {step === 'panda' && (
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="mt-5"><Titre avant="Coucou, moi c’est " mot="Panda" apres=" !" /></div>
              <div className="relative mt-4 flex h-[176px] w-[176px] items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-white/[0.12]" aria-hidden="true" />
                <span className="absolute inset-5 rounded-full bg-white/[0.10]" aria-hidden="true" />
                <button type="button" aria-label="Caresser Panda" className="relative" onClick={(e) => (tap(), coeurs(e.currentTarget, 10), setBulle((b) => b + 1))}>
                  <img key={bulle} src={PANDA(bulle ? 'amour' : 'heureux')} alt="" width={140} height={140} className={`${bulle ? 'panda-saute' : 'ob-salut'} h-[140px] w-[140px] drop-shadow-[0_10px_16px_rgba(30,10,90,0.4)]`} />
                </button>
              </div>
              <p key={bulle} className="ob-bulle queue-haut bulle-rebond mt-4 max-w-[340px] !text-center text-[17px] leading-[23px]">
                {bulle ? CHATOUILLES[(bulle - 1) % CHATOUILLES.length] : <>Je vais t’accompagner pour préparer ta maison de famille. Quelques questions, et on s’y met&nbsp;!</>}
              </p>
              <ul className="mt-6 grid w-full max-w-[360px] gap-2.5 text-left" aria-label="Ce qu’on va faire ensemble">
                {([
                  { Icon: Smile, texte: 'Ton personnage, qui te ressemble', fond: '#FFF4D6', encre: '#B07A00' },
                  { Icon: HouseIcon, texte: 'Votre maison, à décorer ensemble', fond: '#EEE8FC', encre: '#6646CC' },
                  { Icon: Heart, texte: 'Tes proches, invités avec un code', fond: '#FFE6EE', encre: '#D23F72' },
                ] as const).map(({ Icon, texte, fond, encre }, i) => (
                  <li key={texte} className="ob-etape flex items-center gap-3 rounded-[16px] bg-white/[0.14] px-3.5 py-2.5 text-[15px] font-bold ring-[1.5px] ring-inset ring-white/25" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: fond, color: encre }}>
                      <Icon size={19} strokeWidth={2.4} />
                    </span>
                    {texte}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-note font-semibold text-white/75">Ça prend à peine deux minutes.</p>
            </div>
          )}

          {step === 'prenom' && (
            <form className="flex flex-1 flex-col" noValidate onSubmit={(e) => (e.preventDefault(), prenom && suivant())}>
              <div className="mt-4"><Titre avant="Faisons " mot="connaissance" apres="." /></div>
              <p className="ob-sous mt-2 text-center">Quelques questions rapides pour préparer votre petit chez-vous.</p>
              <Panda humeur={prenom ? 'amour' : 'heureux'}>{prenom ? `Enchanté, ${prenom} ! Joli prénom 💛` : <>Pour commencer : comment tes proches t’appellent&#8209;ils ?</>}</Panda>
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
              <Panda humeur={pres.genre && pres.age ? 'fete' : 'heureux'}>
                {pres.genre && pres.age ? 'Parfait ! J’ai déjà une petite idée…' : prenom ? `Enchanté, ${prenom} ! Dis-m’en un peu plus.` : 'Enchanté ! Dis-m’en un peu plus.'}
              </Panda>
              <p id="ob-genre" className="mb-2.5 mt-6 px-1 text-sous font-bold">Tu es</p>
              <div className="grid grid-cols-3 gap-2.5" role="group" aria-labelledby="ob-genre">
                {GENRES.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className="ob-carte flex-col !gap-2 !px-1.5 !pb-2.5 !pt-3"
                    aria-pressed={pres.genre === g.key}
                    aria-label={g.label}
                    onClick={(e) => (select(), pres.genre !== g.key && petille(e.currentTarget), setPres((p) => ({ ...p, genre: g.key })))}
                  >
                    <span className="flex h-[52px] items-center justify-center">
                      {TETES[g.key].map((id, k) => (
                        <span key={id} style={{ marginLeft: k ? -12 : 0 }}><Tete id={id} size={TETES[g.key].length > 1 ? 42 : 52} /></span>
                      ))}
                    </span>
                    <span className="text-[14px] leading-[17px]">{g.key === 'neutre' ? 'Je préfère ne pas dire' : g.label}</span>
                  </button>
                ))}
              </div>
              <p id="ob-age" className="mb-2.5 mt-6 px-1 text-sous font-bold">Ton âge</p>
              <div className="grid grid-cols-5 gap-1.5" role="group" aria-labelledby="ob-age">
                {AGES.map((g) => {
                  const id = PAR_AGE[pres.genre ?? 'neutre'][g.key]
                  return (
                    <button
                      key={g.key}
                      type="button"
                      className="ob-carte flex-col !justify-end !gap-1.5 !px-0.5 !pb-2 !pt-2"
                      aria-pressed={pres.age === g.key}
                      aria-label={g.label}
                      onClick={(e) => (select(), pres.age !== g.key && petille(e.currentTarget), setPres((p) => ({ ...p, age: g.key, cheveux: p.cheveux && cheveuxPossibles({ ...p, age: g.key }).some((c) => c.key === p.cheveux) ? p.cheveux : undefined })))}
                    >
                      <span className="flex h-[92px] w-full items-end justify-center">
                        <img key={id} src={`./art/persos/${id}.webp`} alt="" draggable={false} className="ob-age-perso block w-auto select-none" style={{ height: `${TAILLE_AGE[g.key] * 92}px` }} />
                      </span>
                      <span className="text-[11.5px] leading-[14px]">{AGE_COURT[g.key]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'allure' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ton " mot="allure" apres="." /></div>
              <p className="ob-sous mt-2 text-center">Encore quelques détails, et ton personnage est prêt.</p>
              <Panda
                visuel={apercu ? (
                  <span key={apercu} className="apercu-pop shrink-0"><Avatar m={{ avatar: apercu, color: 'lavande' }} size={74} ring /></span>
                ) : undefined}
                humeur="motive"
              >
                {pres.cheveux && pres.teint !== undefined ? 'Ça te ressemble ? Je peaufine ton personnage !' : apercu ? 'Le voilà qui se dessine… et tes cheveux ?' : 'Et tes cheveux, ils sont comment ?'}
              </Panda>
              <p id="ob-cheveux" className="mb-2 mt-6 px-1 text-sous font-bold">Tes cheveux</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-cheveux">
                {cheveuxPossibles(pres).map((c) => (
                  <button key={c.key} type="button" className="ob-puce !pl-2.5" aria-pressed={pres.cheveux === c.key} onClick={(e) => (select(), pres.cheveux !== c.key && petille(e.currentTarget), setPres((p) => ({ ...p, cheveux: c.key })))}>
                    <span className="h-6 w-6 shrink-0 rounded-full ring-2 ring-white/70" style={{ background: c.couleur }} aria-hidden="true" />
                    {c.label}
                  </button>
                ))}
              </div>
              <p id="ob-peau" className="mb-2 mt-6 px-1 text-sous font-bold">Ta peau</p>
              <div className="flex justify-between gap-2 px-1" role="group" aria-labelledby="ob-peau">
                {TEINTS.map((t, i) => (
                  <button key={t.couleur} type="button" className="ob-teint" style={{ background: t.couleur }} aria-label={t.label} aria-pressed={pres.teint === i} onClick={(e) => (select(), pres.teint !== i && petille(e.currentTarget), setPres((p) => ({ ...p, teint: i })))} />
                ))}
              </div>
              <p id="ob-lunettes" className="mb-2 mt-6 px-1 text-sous font-bold">Des lunettes ?</p>
              <div className="flex gap-2" role="group" aria-labelledby="ob-lunettes">
                {([[true, 'Oui'], [false, 'Non']] as const).map(([v, l]) => (
                  <button key={l} type="button" className="ob-puce min-w-[96px]" aria-pressed={pres.lunettes === v} onClick={(e) => (select(), pres.lunettes !== v && petille(e.currentTarget), setPres((p) => ({ ...p, lunettes: v })))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'naissance' && (() => {
            const max = ne.m ? new Date(2024, ne.m, 0).getDate() : 31
            const prochain = ne.j && ne.m ? (() => {
              const auj = new Date()
              const d = new Date(auj.getFullYear(), ne.m - 1, ne.j)
              if (d < new Date(auj.getFullYear(), auj.getMonth(), auj.getDate())) d.setFullYear(d.getFullYear() + 1)
              return d
            })() : null
            const choisir = (v: { j?: number | null; m?: number | null }) => {
              const n = { ...ne, ...v }
              const lim = n.m ? new Date(2024, n.m, 0).getDate() : 31
              if (n.j && n.j > lim) n.j = lim
              if (n.j && n.m && !(ne.j && ne.m)) success()
              else select()
              setNe(n)
            }
            return (
              <div className="flex flex-1 flex-col">
                <div className="mt-4"><Titre avant="Ton " mot="anniversaire" apres=" ?" /></div>
                <p className="ob-sous mt-2 text-center">Il s’ajoute tout seul à l’agenda de la maison : plus personne ne l’oublie.</p>
                <Panda humeur={prochain ? 'fete' : 'heureux'}>
                  {prochain ? `Le ${ne.j === 1 ? '1er' : ne.j} ${MOIS_LONGS[ne.m! - 1]} ! Je préparerai les bougies 🎂` : `${prenom ? `${prenom}, tu` : 'Tu'} souffles tes bougies quel jour ?`}
                </Panda>
                <div key={`${ne.j}-${ne.m}`} className="ob-calendrier apercu-pop mx-auto mt-6" aria-hidden="true">
                  <p className="ob-calendrier-mois">{ne.m ? MOIS_LONGS[ne.m - 1] : 'mois'}</p>
                  <p className="ob-calendrier-jour">{ne.j ?? '?'}</p>
                  <p className="ob-calendrier-pied">{prochain ? `cette fois, un ${prochain.toLocaleDateString('fr-FR', { weekday: 'long' })}` : 'jour et mois'}</p>
                </div>
                <div className="mt-6 grid grid-cols-[1fr_1.7fr] gap-2.5">
                  <label className="block">
                    <span className="mb-1.5 block px-1 text-sous font-bold">Jour</span>
                    <select className="ob-champ ob-choix-liste" value={ne.j ?? ''} onChange={(e) => choisir({ j: Number(e.target.value) || null })} aria-label="Jour de ton anniversaire">
                      <option value="" disabled>Jour</option>
                      {Array.from({ length: max }, (_, i) => i + 1).map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block px-1 text-sous font-bold">Mois</span>
                    <select className="ob-champ ob-choix-liste" value={ne.m ?? ''} onChange={(e) => choisir({ m: Number(e.target.value) || null })} aria-label="Mois de ton anniversaire">
                      <option value="" disabled>Mois</option>
                      {MOIS_LONGS.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-2 px-1 text-note text-white/75">Pas besoin de l’année : seulement le jour qu’on fête.</p>
              </div>
            )
          })()}

          {step === 'raison' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ce qui " mot="compte" apres=" pour toi." /></div>
              <p className="ob-sous mt-2 text-center">Nidoo s’adapte à ce que vous aimez partager.</p>
              <Panda humeur={raison ? 'amour' : 'motive'}>{raison ? 'Oh, j’adore ! On va en faire quelque chose de beau.' : `${prenom ? `${prenom}, qu’est-ce` : 'Qu’est-ce'} qui t’amène sur Nidoo ?`}</Panda>
              <div className="mt-5 grid gap-3" role="group" aria-label="Ce qui t’amène">
                {RAISONS.map(({ key, label, Icon, fond, encre }) => (
                  <button key={key} type="button" aria-pressed={raison === key} className="ob-choix" onClick={(e) => (select(), raison !== key && petille(e.currentTarget), setRaison(key))}>
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
              <Panda humeur={proches.length ? 'fete' : 'amour'}>{proches.length > 2 ? 'Quelle belle tribu ! La maison va être animée 🎉' : proches.length ? 'Super, on leur gardera une place !' : 'Avec qui veux-tu partager ta maison ?'}</Panda>
              <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Tes proches (plusieurs choix possibles)">
                {PROCHES.map(({ key, label, persos }) => {
                  const on = proches.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      className="ob-choix !flex-col !items-start !gap-2 !py-3"
                      onClick={(e) => (select(), !on && coeurs(e.currentTarget, 6), setProches((p) => (on ? p.filter((x) => x !== key) : [...p, key])))}
                    >
                      <span className="flex">
                        {persos.map((id, k) => (
                          <span key={id} className={on ? 'tete-saute' : ''} style={{ marginLeft: k ? -9 : 0, animationDelay: `${k * 0.08}s` }}><Tete id={id} size={38} /></span>
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
                  <button key={key} type="button" aria-pressed={path === key} className="ob-choix !min-h-[76px]" onClick={(e) => (select(), path !== key && petille(e.currentTarget), setPath(key))}>
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
              <ProfileStep name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} sansNom pres={pres} />
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
              {/* la maison telle qu'elle sera : le décor choisi, et son nom sur l'écriteau, à mesure qu'on l'écrit */}
              <div className="relative mt-4 overflow-hidden rounded-[24px] bg-white p-1 shadow-[0_5px_0_rgba(36,16,110,0.3)]">
                <div key={houseType} className="maison-hop overflow-hidden rounded-[20px]">
                  <House type={houseType} items={[]} phase="jour" ratio={16 / 7.5} />
                </div>
                <span key={family.trim() ? 'nom' : 'vide'} className="anim-pop pointer-events-none absolute bottom-3 left-1/2 max-w-[86%] -translate-x-1/2 truncate rounded-full bg-white/95 px-4 py-1.5 font-rond text-[17px] font-extrabold text-teinte-fonce shadow-[0_4px_14px_rgba(36,16,110,0.28)]">
                  {family.trim() || 'Votre maison'}
                </span>
              </div>
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
              {nameError || nameTooLong || family.length > NAME_MAX - 10 ? (
                <p id="nom-maison-aide" role={nameError || nameTooLong ? 'alert' : undefined} className={`mt-1.5 min-h-[20px] px-1 text-note font-semibold ${nameError || nameTooLong ? 'text-[#FFD0CC]' : 'text-white/75'}`}>
                  {nameError || (nameTooLong ? T.create.name_too_long : `${family.trim().length}/${NAME_MAX}`)}
                </p>
              ) : (
                <div id="nom-maison-aide" className="no-bar -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Des idées de nom">
                  {IDEES_NOMS(prenom).map((idee) => (
                    <button key={idee} type="button" className="ob-puce !min-h-[38px] shrink-0 !px-3.5 !text-[14px]" aria-pressed={family === idee} onClick={(e) => (select(), family !== idee && petille(e.currentTarget), setFamily(idee))}>
                      {idee}
                    </button>
                  ))}
                </div>
              )}
              <p className="mb-0 mt-5 px-1 text-sous font-bold text-white">{T.create.decor}</p>
              <HousePicker value={houseType} onChange={setHouseType} />
              <p className="mt-3 text-center text-note font-semibold text-white/75">{T.create.decor_later}</p>
            </form>
          )}

          {step === 'notifs' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Ne rate aucun " mot="bisou" apres="." /></div>
              <p className="ob-sous mt-2 text-center">Un proche pense à toi, une date approche, c’est ton tour de jouer : on te prévient.</p>
              <EcranNotifications active={notifs === 'oui'} />
              <Panda humeur={notifs === 'oui' ? 'fete' : 'amour'}>
                {notifs === 'oui' ? 'Youpi ! Regarde, je t’envoie un premier petit mot…' : 'Promis, je ne t’embête pas : seulement ce qui compte.'}
              </Panda>
            </div>
          )}

          {step === 'widgets' && (
            <div className="flex flex-1 flex-col">
              <div className="mt-4"><Titre avant="Les " mot="widgets" apres=" Nidoo." /></div>
              <p className="ob-sous mt-2 text-center">
                {WIDGETS ? 'Des widgets pour envoyer un bisou, cocher une course ou jouer, sans ouvrir l’appli.' : 'Avec l’appli iPhone : des widgets pour envoyer un bisou, cocher une course ou jouer, sans ouvrir l’appli.'}
              </p>
              <Panda humeur="motive">Touche-les, ils marchent pour de vrai !</Panda>
              <EcranWidgets />
              <CommentAjouter />
            </div>
          )}

          {step === 'connexion' && (
            <div className="flex flex-1 flex-col">
              <div className="px-5 text-center">
                <h1 className="ob-titre mt-3 outline-none">Presque fini !</h1>
                <p className="ob-sous mt-1.5">Un dernier regard, et votre histoire commence.</p>
              </div>
              <div className="flex-1" />
              <div className="relative mt-10">
                <img src={PANDA('amour')} alt="" className="ob-salut absolute -top-[64px] right-6 h-[92px] w-[92px] drop-shadow-[0_8px_12px_rgba(30,10,90,0.35)]" />
                <div className="ob-feuille px-5 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}>
                  <span className="mx-auto mb-4 block h-[5px] w-10 rounded-full bg-[#E4DFF3]" aria-hidden="true" />
                  <h2 className="ob-titre text-center !text-[27px] !leading-[32px] text-encre">
                    Tout est <span className="ob-mot">prêt</span>.
                  </h2>
                  <p className="mt-2 text-center text-sous text-[#625A75] [text-wrap:pretty]">Voici ce que tu as préparé. Tu pourras le modifier ensuite dans Famille.</p>
                  <div className="mt-5 rounded-[20px] bg-[#F5F1FD] p-4">
                    <div className="flex items-center gap-3">
                      <span className="tete-saute"><Avatar m={{ avatar, color }} size={52} ring /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-encre">{path === 'rejoindre' ? preview?.name ?? 'La maison de tes proches' : family.trim()}</p>
                        <p className="mt-0.5 text-note text-brume">Ton personnage · {name.trim()}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-note text-brume">{path === 'rejoindre' ? 'Un responsable recevra ta demande et pourra t’accueillir.' : 'Tu pourras inviter tes proches avec un code, puis partager votre premier moment.'}</p>
                  </div>
                  <button className="ob-cta violet mt-5" onClick={() => (tap(), entrer())} disabled={busy}>
                    {busy ? (path === 'rejoindre' ? 'Un instant…' : T.create.loading) : path === 'rejoindre' ? 'Demander à entrer' : 'Créer ma maison'} {!busy && <ChevronRight size={20} strokeWidth={2.8} />}
                  </button>
                  <p className="mt-3 text-center text-note text-[#8C86A3] [text-wrap:pretty]">En attendant la connexion, ta maison est gardée sur cet appareil.</p>
                </div>
              </div>
            </div>
          )}

          {step === 'invite' && created && (
            <div className="flex flex-1 flex-col pt-4 text-center">
              {/* la maison un peu plus petite : le titre et le code remontent */}
              <div className="mx-auto w-[82%] overflow-hidden rounded-[24px] bg-white p-1.5 shadow-[0_5px_0_rgba(36,16,110,0.32)]">
                <div className="maison-hop overflow-hidden rounded-[19px]"><House type={houseType} items={[]} /></div>
              </div>
              <h1 className="ob-titre mx-auto mt-5 max-w-[340px] outline-none">
                <span className="ob-mot">{family.trim() || 'Votre petit chez-vous'}</span>, c’est prêt ✨
              </h1>
              <p className="ob-sous mx-auto mt-2 max-w-[300px]">{T.invite.description}</p>
              <button
                onClick={async (e) => {
                  const el = e.currentTarget
                  if (!(await copy(created.code))) return
                  success()
                  petille(el)
                  setCopie(true)
                  window.setTimeout(() => setCopie(false), 2200)
                }}
                className="ob-choix relative mx-auto mt-5 !w-auto !justify-center !gap-3 !px-5 !py-3"
                aria-label={`Copier le code ${created.code}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FFF4D6] text-[#B07A00]" aria-hidden="true">
                  <KeyRound size={19} strokeWidth={2.4} />
                </span>
                <span className="font-rond text-[30px] font-extrabold tracking-[0.2em] text-encre">{created.code}</span>
                {copie ? <Check size={20} strokeWidth={3} className="anim-pop text-[#14955A]" /> : <Copy size={18} className="text-teinte" />}
                {copie && (
                  <span role="status" className="anim-pop absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#14955A] px-3 py-1 text-[13px] font-extrabold text-white shadow-[0_4px_10px_rgba(20,149,90,0.4)]">
                    Code copié !
                  </span>
                )}
              </button>
              <p className="mx-auto mt-3 max-w-[310px] text-note font-semibold text-white/85 [text-wrap:pretty]">{T.invite.code_hint}</p>
              <p className="mt-1 text-note font-semibold text-white/65">{T.invite.code_validite}</p>
              <div className="flex-1" />
              {/* après tout l'accueil, on a envie de découvrir sa maison : c'est le bouton principal ; inviter vient juste après */}
              <button className="ob-cta ob-cta-pret mt-6" onClick={() => (tap(), void open(created.id).then(() => onCancel?.()))}>
                <HouseIcon size={20} strokeWidth={2.5} /> {T.invite.enter}
              </button>
              <button
                className="ob-cta leger mt-3"
                onClick={async () => {
                  tap()
                  const r = await shareInvite(family.trim(), created.code)
                  if (r === 'copie') toast('Invitation copiée')
                }}
              >
                <Share size={19} strokeWidth={2.5} /> {T.invite.share}
              </button>
              <p className="mt-3 text-note font-semibold text-white/75">{T.invite.later}</p>
            </div>
          )}
        </div>
      </div>

      {pied && (
        <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}>
          <button key={`${step}-${pied.ok}`} className={`ob-cta ${pied.ok ? 'ob-cta-pret' : ''}`} disabled={!pied.ok} onClick={() => (tap(), pied.go())}>
            {pied.label} {pied.ok && !busy && !checking && <ChevronRight size={20} strokeWidth={2.8} />}
          </button>
          {pied.passer && (
            <button className="presse mx-auto mt-1.5 flex min-h-11 items-center px-4 text-sous font-bold text-white/80" onClick={() => (tap(), 'surPasser' in pied && pied.surPasser?.(), suivant())}>
              {typeof pied.passer === 'string' ? pied.passer : 'Passer'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
