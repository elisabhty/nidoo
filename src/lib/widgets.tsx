// Les widgets de l'écran d'accueil (iPhone). L'appli leur donne deux choses par le pont natif « Nidoo » :
//  • la clé widget de ce téléphone (demandée une fois au serveur) : avec elle, les widgets lisent la maison et agissent
//    sans ouvrir l'appli, et sans jamais toucher à la session du compte ;
//  • le buste de chaque proche, photographié ici (les widgets ne savent pas composer une figurine).
// (Quand l'appli passe derrière, le pont dit de lui-même aux widgets de se remettre à jour.)
// En retour, un widget touché dit à l'appli où s'ouvrir (« organiser », « recus »…).
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import { Character } from '../components/Character'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import { photographier } from './bustes'
import { lookOf } from './look'
import type { Backend, FamilyState, Member } from './types'

type Pont = {
  configurer(o: { url: string; apikey: string; cle: string; famille: string; moi: string }): Promise<{ refusee?: boolean }>
  personnages(o: { images: Record<string, string>; garder: string[] }): Promise<void>
  rafraichir(): Promise<void>
  oublier(): Promise<void>
  depart(): Promise<{ chemin?: string }>
  addListener(nom: 'ouvrir', f: (e: { chemin: string }) => void): Promise<PluginListenerHandle>
}

/** Vrai dans l'appli iPhone (le pont existe) ; sur le web et en démo, rien de tout ceci ne tourne. */
export const WIDGETS = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform()
const pont = WIDGETS ? registerPlugin<Pont>('Nidoo') : null

const PREFIXE = 'nidoo.widgets.'
/** À changer si la photo des bustes change (taille, cadrage) : tous seront refaits. */
const VERSION_BUSTE = 'b1'
const COTE = 240

const lire = (cle: string) => {
  try {
    return localStorage.getItem(PREFIXE + cle)
  } catch {
    return null
  }
}
const ecrire = (cle: string, valeur: string) => {
  try {
    localStorage.setItem(PREFIXE + cle, valeur)
  } catch {
    /* on redemandera au prochain lancement */
  }
}

const attendre = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms))

/**
 * Le buste d'un personnage, en PNG (data URL) sur fond transparent : le même cadrage que les pastilles rondes de l'appli.
 * Le personnage est dessiné hors de l'écran, puis photographié une fois complet.
 */
export async function buste(avatar: string, graine: string, cote = COTE): Promise<string | null> {
  const boite = document.createElement('div')
  boite.setAttribute('aria-hidden', 'true')
  boite.style.cssText = `position:fixed;left:-10000px;top:0;width:${cote}px;height:${cote}px;overflow:hidden;pointer-events:none`
  document.body.appendChild(boite)
  const racine = createRoot(boite)
  try {
    const pret = await new Promise<boolean>((ok) => {
      const t = window.setTimeout(() => ok(false), 6000)
      racine.render(
        <Character
          look={lookOf(avatar, graine)}
          bust
          recul={1.22}
          still
          className="block h-full w-full"
          onPret={() => {
            window.clearTimeout(t)
            ok(true)
          }}
        />,
      )
    })
    if (!pret) return null
    // les habits arrivent en fondu : on attend qu'ils soient bien là
    await attendre(320)
    const figurine = boite.firstElementChild
    return figurine instanceof HTMLElement ? await photographier(figurine, cote) : null
  } catch {
    return null
  } finally {
    racine.unmount()
    boite.remove()
  }
}

let branche = ''
let enCours: Promise<void> | null = null

/** La clé widget de ce téléphone pour cette maison : demandée une fois, puis gardée. */
async function brancher(api: Backend, famille: string, moi: string): Promise<boolean> {
  if (!pont) return false
  const ou = `${famille}.${moi}`
  if (branche === ou) return true
  let cle = lire(`cle.${ou}`) ?? ''
  for (let essai = 0; essai < 2; essai++) {
    if (!cle) {
      cle = await api.widgetCle(famille)
      if (!cle) return false
      ecrire(`cle.${ou}`, cle)
    }
    const r = await pont.configurer({ url: SUPABASE_URL.replace(/\/+$/, ''), apikey: SUPABASE_KEY, cle, famille, moi })
    if (!r?.refusee) {
      branche = ou
      return true
    }
    // le serveur ne connaît plus cette clé (réinstallation, trop d'appareils) : une autre
    cle = ''
  }
  return false
}

/** Les bustes des proches dont le personnage a changé depuis la dernière fois. */
async function photographierProches(famille: string, membres: Member[]): Promise<void> {
  if (!pont) return
  let faits: Record<string, string> = {}
  try {
    faits = JSON.parse(lire(`bustes.${famille}`) ?? '{}') as Record<string, string>
  } catch {
    /* on les refera tous */
  }
  const garder = membres.map((m) => m.id)
  const signature = (m: Member) => `${VERSION_BUSTE}|${m.avatar}|${m.user_id ?? m.id}`
  const aFaire = membres.filter((m) => faits[m.id] !== signature(m))
  const partis = Object.keys(faits).filter((id) => !garder.includes(id))
  if (!aFaire.length && !partis.length) return
  const suite: Record<string, string> = Object.fromEntries(Object.entries(faits).filter(([id]) => garder.includes(id)))
  for (const m of aFaire) {
    const png = await buste(m.avatar, m.user_id ?? m.id ?? '')
    if (!png) continue
    await pont.personnages({ images: { [m.id]: png }, garder })
    suite[m.id] = signature(m)
    ecrire(`bustes.${famille}`, JSON.stringify(suite))
    // l'appli reste fluide pendant qu'on prépare les suivants
    await attendre(120)
  }
  if (partis.length) {
    await pont.personnages({ images: {}, garder })
    ecrire(`bustes.${famille}`, JSON.stringify(suite))
  }
}

let dernier: FamilyState | null = null
let minuteur: number | undefined

/**
 * À appeler chaque fois que la maison change : branche les widgets s'il le faut et refait les bustes qui ont changé.
 */
export function synchroniserWidgets(api: Backend, state: FamilyState) {
  if (!pont || api.mode !== 'supabase') return
  dernier = state
  window.clearTimeout(minuteur)
  minuteur = window.setTimeout(() => {
    if (enCours) return
    const s = dernier
    if (!s) return
    enCours = (async () => {
      try {
        if (!(await brancher(api, s.family.id, s.me.id))) return
        await photographierProches(s.family.id, s.members)
      } catch {
        /* pas de réseau, pont absent : on réessaiera au prochain changement */
      } finally {
        enCours = null
        // la maison a encore changé pendant ce temps : on recommence avec le dernier état
        if (dernier && dernier !== s) synchroniserWidgets(api, dernier)
      }
    })()
  }, 900)
}

/** Plus de maison (on l'a quittée, ou le compte est effacé) : les widgets n'ont plus rien à montrer. */
export function oublierWidgets() {
  if (!pont) return
  dernier = null
  branche = ''
  window.clearTimeout(minuteur)
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIXE)) localStorage.removeItem(k)
  } catch {
    /* sans conséquence */
  }
  void pont.oublier().catch(() => undefined)
}

/** Où un widget veut ouvrir l'appli : au lancement, puis à chaque fois qu'on en touche un. */
export function ecouterWidgets(ouvrir: (chemin: string) => void): () => void {
  if (!pont) return () => undefined
  let fini = false
  let ecoute: PluginListenerHandle | null = null
  void pont
    .depart()
    .then((d) => !fini && d?.chemin && ouvrir(d.chemin))
    .catch(() => undefined)
  void pont
    .addListener('ouvrir', (e) => {
      // noté comme lu, pour ne pas le rejouer au prochain lancement
      void pont.depart().catch(() => undefined)
      if (!fini && e?.chemin) ouvrir(e.chemin)
    })
    .then((h) => {
      if (fini) void h.remove()
      else ecoute = h
    })
    .catch(() => undefined)
  return () => {
    fini = true
    void ecoute?.remove()
  }
}

// En démo (jamais en ligne) : de quoi vérifier, depuis les outils de test, que la photo d'un buste est fidèle à l'écran.
if (import.meta.env.MODE === 'demo') {
  const w = window as unknown as { __buste?: typeof buste; __busteVisible?: (avatar: string, graine: string, cote?: number) => Promise<void> }
  w.__buste = buste
  /** Le même buste, affiché pour de bon en haut à gauche de l'écran (#buste-temoin), pour le comparer à sa photo. */
  w.__busteVisible = (avatar, graine, cote = COTE) =>
    new Promise<void>((ok) => {
      document.getElementById('buste-temoin')?.remove()
      const boite = document.createElement('div')
      boite.id = 'buste-temoin'
      boite.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${cote}px;height:${cote}px;overflow:hidden;background:#EFE8FD`
      document.body.appendChild(boite)
      createRoot(boite).render(<Character look={lookOf(avatar, graine)} bust recul={1.22} still className="block h-full w-full" onPret={() => window.setTimeout(ok, 400)} />)
    })
}
