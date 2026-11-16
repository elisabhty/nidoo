import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import { createLocalBackend } from './localBackend'
import { createSupabaseBackend } from './supabaseBackend'
import type { Backend, Circle, FamilyState, MyRequest } from './types'
import { errorText, familyLabel } from './util'

const backend: Backend = SUPABASE_URL && SUPABASE_KEY ? createSupabaseBackend() : createLocalBackend()
const LAST = 'nidoo.maison'
// Une seule connexion à la fois, même si l'effet de démarrage est relancé.
let boot: Promise<string> | null = null

type Toast = { id: number; text: string; tone: 'ok' | 'err' }

type Store = {
  api: Backend
  status: 'loading' | 'ready' | 'error'
  error: string | null
  circles: Circle[]
  /** Mes demandes d'entrée envoyées, en attente ou refusées. */
  requests: MyRequest[]
  state: FamilyState | null
  toasts: Toast[]
  toast(text: string, tone?: 'ok' | 'err'): void
  /** Exécute une action, rafraîchit la maison, affiche l'erreur s'il y en a une. */
  run(fn: (api: Backend) => Promise<unknown>, ok?: string): Promise<boolean>
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

  const toast = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])
  const toastRef = useRef(toast)
  toastRef.current = toast

  const reload = useCallback(async () => {
    const [cs, rq] = await Promise.all([backend.circles(), backend.myRequests()])
    // Une demande qui disparaît alors que la famille est là : on vient d'être accepté, on y entre.
    const welcomed = asked.current.find((r) => r.status === 'attente' && !rq.some((x) => x.id === r.id) && cs.some((c) => c.family.id === r.family_id))
    asked.current = rq
    setRequests(rq)
    if (welcomed) {
      current.current = welcomed.family_id
      try {
        localStorage.setItem(LAST, welcomed.family_id)
      } catch {
        /* sans conséquence */
      }
      toastRef.current?.(`Bienvenue dans « ${familyLabel(welcomed.family_name)} » !`)
    }
    setCircles(cs)
    const wanted = current.current && cs.some((c) => c.family.id === current.current) ? current.current : (cs[0]?.family.id ?? null)
    current.current = wanted
    if (!wanted) {
      setState(null)
      return
    }
    setState(await backend.load(wanted))
  }, [])

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
    async (fn, ok) => {
      try {
        await fn(backend)
        await reload()
        if (ok) toast(ok)
        return true
      } catch (e) {
        toast(errorText(e), 'err')
        return false
      }
    },
    [reload, toast],
  )

  useEffect(() => {
    let alive = true
    setStatus('loading')
    ;(async () => {
      try {
        await (boot ??= backend.start())
        try {
          current.current = localStorage.getItem(LAST)
        } catch {
          current.current = null
        }
        await reload()
        if (alive) setStatus('ready')
      } catch (e) {
        if (alive) {
          setError(errorText(e))
          setStatus('error')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [attempt, reload])

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
    return () => {
      off()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
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
    () => ({ api: backend, status, error, circles, requests, state, toasts, toast, run, open, reload, retry: () => {
        boot = null
        setAttempt((a) => a + 1)
      } }),
    [status, error, circles, requests, state, toasts, toast, run, open, reload],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
