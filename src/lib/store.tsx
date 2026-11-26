import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import { ecrireCopie, effacerCopies, lireCopie, sansLiens } from './cacheEtat'
import { createLocalBackend } from './localBackend'
import { createSupabaseBackend } from './supabaseBackend'
import type { Backend, Circle, FamilyState, MyRequest } from './types'
import { errorText, familyLabel } from './util'

/** Faux en démo : pas de serveur, les proches sont fictifs. */
export const EN_LIGNE = !!(SUPABASE_URL && SUPABASE_KEY)
const backend: Backend = EN_LIGNE ? createSupabaseBackend() : createLocalBackend()
const LAST = 'nidoo.maison'
/** La copie de démarrage : ce qu'on a vu la dernière fois (seulement avec le vrai serveur ; en démo tout est déjà sur l'appareil). */
type Demarrage = { circles: Circle[]; state: FamilyState }
const COPIE = 'demarrage'
/** Au-delà, les liens signés des photos de la copie peuvent ne plus être valables
 *  (ils durent 7 jours et sont renouvelés au bout de 6 : il leur reste au moins un jour quand la copie est écrite). */
const LIENS_MS = 20 * 3600000
const pareil = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
// Une seule connexion à la fois, même si l'effet de démarrage est relancé.
let boot: Promise<string> | null = null

/** Un bandeau ; `action` : un bouton dedans (« Annuler »), qui le ferme une fois touché. */
export type ActionToast = { label: string; run: () => void }
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'info'; action?: ActionToast }

type Store = {
  api: Backend
  status: 'loading' | 'ready' | 'error'
  error: string | null
  circles: Circle[]
  /** Mes demandes d'entrée envoyées, en attente ou refusées. */
  requests: MyRequest[]
  state: FamilyState | null
  toasts: Toast[]
  toast(text: string, tone?: 'ok' | 'err' | 'info', action?: ActionToast): void
  fermerToast(id: number): void
  /** Exécute une action, rafraîchit la maison, affiche l'erreur s'il y en a une.
   *  `tout_de_suite` : ce que l'action change, montré sans attendre le serveur (annulé si elle échoue). */
  run(fn: (api: Backend) => Promise<unknown>, ok?: string, tout_de_suite?: (s: FamilyState) => FamilyState): Promise<boolean>
  open(familyId: string): Promise<void>
  reload(): Promise<void>
  retry(): void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('Store manquant')
  return s
}
/** À utiliser dans les écrans affichés une fois la maison chargée. */
export const useHome = () => {
  const s = useStore()
  if (!s.state) throw new Error('Maison non chargée')
  return { ...s, state: s.state }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Store['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [circles, setCircles] = useState<Circle[]>([])
  const [requests, setRequests] = useState<MyRequest[]>([])
  const asked = useRef<MyRequest[]>([])
  const [state, setState] = useState<FamilyState | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [attempt, setAttempt] = useState(0)
  const current = useRef<string | null>(null)
  const uid = useRef('')
  const sauve = useRef<number | undefined>(undefined)
  // Ne remplacer la maison (et tout redessiner) que si quelque chose a vraiment changé.
  const etat = useRef<FamilyState | null>(null)
  const poser = useCallback((next: FamilyState | null) => {
    if (pareil(etat.current, next)) return
    etat.current = next
    setState(next)
  }, [])

  const toast = useCallback((text: string, tone: 'ok' | 'err' | 'info' = 'ok', action?: ActionToast) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone, action }])
    // avec un bouton (« Annuler »), on laisse le temps de le toucher
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 2800)
  }, [])
  const fermerToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toastRef = useRef(toast)
  toastRef.current = toast

  const reload = useCallback(async () => {
    // lancé sans réseau, sur la copie de démarrage : la session n'a pas encore pu s'ouvrir, on la rouvre d'abord
    if (!uid.current) {
      boot = null
      uid.current = await (boot = backend.start())
    }
    const [cs, rq] = await Promise.all([backend.circles(), backend.myRequests()])
    // Une demande qui disparaît alors que la famille est là : on vient d'être accepté, on y entre.
    const welcomed = asked.current.find((r) => r.status === 'attente' && !rq.some((x) => x.id === r.id) && cs.some((c) => c.family.id === r.family_id))
    asked.current = rq
    setRequests((prev) => (pareil(prev, rq) ? prev : rq))
    if (welcomed) {
      current.current = welcomed.family_id
      try {
        localStorage.setItem(LAST, welcomed.family_id)
      } catch {
        /* sans conséquence */
      }
      toastRef.current?.(`Bienvenue dans « ${familyLabel(welcomed.family_name)} » !`)
    }
    setCircles((prev) => (pareil(prev, cs) ? prev : cs))
    const wanted = current.current && cs.some((c) => c.family.id === current.current) ? current.current : (cs[0]?.family.id ?? null)
    current.current = wanted
    if (!wanted) {
      poser(null)
      // plus de maison : la copie de démarrage ne doit pas la remontrer au prochain lancement
      if (EN_LIGNE) {
        window.clearTimeout(sauve.current)
        void effacerCopies()
      }
      return
    }
    const next = await backend.load(wanted)
    poser(next)
    if (EN_LIGNE && uid.current) {
      // la copie pour le prochain lancement, écrite un peu plus tard pour ne pas gêner l'affichage
      window.clearTimeout(sauve.current)
      const u = uid.current
      sauve.current = window.setTimeout(() => void ecrireCopie<Demarrage>(COPIE, u, { circles: cs, state: next }), 1500)
    }
  }, [poser])

  const open = useCallback(
    async (familyId: string) => {
      current.current = familyId
      try {
        localStorage.setItem(LAST, familyId)
      } catch {
        /* préférence non mémorisée, sans conséquence */
      }
      await reload()
    },
    [reload],
  )

  const run = useCallback<Store['run']>(
    async (fn, ok, tout_de_suite) => {
      const avant = etat.current
      try {
        if (tout_de_suite && avant) {
          const vite = tout_de_suite(avant)
          etat.current = vite
          setState(vite)
        }
        await fn(backend)
        await reload()
        if (ok) toast(ok)
        return true
      } catch (e) {
        // l'action a échoué : on revient à ce que dit le serveur (ou, sans réseau, à ce qu'on voyait avant)
        if (tout_de_suite) await reload().catch(() => poser(avant))
        toast(errorText(e), 'err')
        return false
      }
    },
    [reload, toast, poser],
  )

  useEffect(() => {
    let alive = true
    setStatus('loading')
    ;(async () => {
      let copie = false
      try {
        try {
          current.current = localStorage.getItem(LAST)
        } catch {
          current.current = null
        }
        // Démarrage immédiat : la maison telle qu'on l'a laissée, le temps que la version à jour arrive.
        const montrer = async (id: string) => {
          const c = await lireCopie<Demarrage>(COPIE, id)
          const vu = c && (!current.current || c.valeur.state.family.id === current.current) ? c : null
          if (!vu || !alive) return false
          const frais = Date.now() - vu.at < LIENS_MS
          setCircles(vu.valeur.circles)
          // une copie gardée par une version d'avant n'a pas encore tout (positions, nos adresses) : des listes vides
          const garde: FamilyState = { ...vu.valeur.state, positions: vu.valeur.state.positions ?? [], endroits: vu.valeur.state.endroits ?? [], endroitsPartages: vu.valeur.state.endroitsPartages ?? true }
          poser(frais ? garde : sansLiens(garde))
          setStatus('ready')
          return true
        }
        // Avant même la session (qui peut attendre le réseau pour se prolonger) : le compte gardé sur l'appareil.
        let connu: string | null = null
        if (EN_LIGNE && !etat.current) {
          try {
            connu = (JSON.parse(localStorage.getItem('nidoo.auth') ?? 'null')?.user?.id as string | undefined) ?? null
          } catch {
            connu = null
          }
          if (connu) copie = await montrer(connu)
        }
        uid.current = await (boot ??= backend.start())
        if (copie && connu !== uid.current) {
          // ce n'était pas le bon compte : on retire ce qu'on montrait
          copie = false
          poser(null)
          if (alive) setStatus('loading')
        }
        if (EN_LIGNE && !etat.current && !copie) copie = await montrer(uid.current)
        await reload()
        if (alive) setStatus('ready')
      } catch (e) {
        // sans réseau mais avec la copie : on reste sur ce qu'on voyait, la suite se rattrapera toute seule
        if (alive && !copie) {
          setError(errorText(e))
          setStatus('error')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [attempt, reload, poser])

  // Temps réel : dès qu'un proche bouge, on recharge la maison (regroupé pour éviter les rafales).
  const familyId = state?.family.id
  useEffect(() => {
    if (!familyId) return
    let timer: number | undefined
    const off = backend.subscribe(familyId, () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void reload().catch(() => undefined), 250)
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisible)
    // le réseau revient : on rattrape ce qui a bougé pendant ce temps
    const onLigne = () => void reload().catch(() => undefined)
    window.addEventListener('online', onLigne)
    return () => {
      off()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onLigne)
    }
  }, [familyId, reload])

  // En attendant qu'un responsable accepte : on regarde régulièrement si la porte s'est ouverte.
  const waiting = requests.some((r) => r.status === 'attente')
  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => void reload().catch(() => undefined), 4000)
    return () => window.clearInterval(t)
  }, [waiting, reload])

  const value = useMemo<Store>(
    () => ({ api: backend, status, error, circles, requests, state, toasts, toast, fermerToast, run, open, reload, retry: () => {
        boot = null
        setAttempt((a) => a + 1)
      } }),
    [status, error, circles, requests, state, toasts, toast, fermerToast, run, open, reload],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
