// Mise à jour à distance de l'appli iPhone, sans repasser par Apple (Elisa, 21 novembre : « peux-tu faire une fonction
// de mise à jour à distance »), comme dans Requête (maj.js).
//
// L'appli envoyée sur TestFlight contient une coque native (Swift, widgets, plugins) et toute l'appli web (dist/).
// Ce fichier remplace l'appli web par la version en ligne sur https://elisabhty.github.io/nidoo/, publiée à chaque
// mise en ligne du site (scripts/maj-paquet.mjs). La coque native, elle, ne change que par TestFlight.
//
// Le plugin : @capgo/capacitor-updater (open source), en mode manuel, sans aucun service tiers (capacitor.config.ts :
// autoUpdate false, adresses de vérification et de statistiques vides). L'appli ne parle qu'au site de Nidoo.
//
// Dans cet ordre :
// 1. Au lancement (main.tsx, avant d'afficher quoi que ce soit) : une version déjà téléchargée et plus récente est
//    installée tout de suite (la page se recharge dessus, sous l'écran d'attente). Jamais en cours d'utilisation.
// 2. L'appli s'est affichée (App) : on confirme au plugin que cette version marche. Sans confirmation dans les
//    20 secondes, il revient tout seul à la version d'avant.
// 3. Quelques secondes après, puis à chaque retour dans l'appli (au plus toutes les 30 minutes) : on lit l'annonce
//    du site. Une version plus récente, que cette appli peut recevoir (ses plugins natifs, une coque assez récente) :
//    le plugin télécharge les fichiers qui ont changé, vérifiés un par un (SHA-256). Elle attend le prochain lancement.
//
// Garde-fous : une version qui ne démarre pas est essayée deux fois au plus, puis écartée sept jours ; les adresses
// doivent être sur le site de Nidoo ; « retirer » (maj/regles.json) ramène chaque iPhone au contenu de son appli ;
// une mise à jour par TestFlight efface les versions téléchargées (le contenu embarqué, plus récent, reprend).
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater, type ManifestEntry } from '@capgo/capacitor-updater'

export const VERSION_WEB: number = __NIDOO_VERSION__
export const COMMIT_WEB: string = __NIDOO_COMMIT__

const ORIGINE = 'https://elisabhty.github.io/nidoo/'
const ANNONCE = `${ORIGINE}maj/version.json`
const PAUSE_MS = 30 * 60 * 1000 // entre deux lectures de l'annonce
const REPRISE_MS = 5 * 60 * 1000 // après une lecture ratée
const ATTENTE_MS = 6000 // après le démarrage, avant la première lecture
const ESSAIS_MAX = 2
const REFUS_MS = 7 * 24 * 3600 * 1000
const DELAI_MS = 12000

const BRANCHEE = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CapacitorUpdater')

const K = {
  prete: 'nidoo.maj.prete', // {id, version} : téléchargée, à installer au prochain lancement
  essais: 'nidoo.maj.essais', // {version: installations sans confirmation}
  refus: 'nidoo.maj.refus', // {version, le} : écartée sur cet iPhone
  retour: 'nidoo.maj.retour', // version : revenir au contenu embarqué au prochain lancement
  vu: 'nidoo.maj.vu', // dernière lecture de l'annonce
  etat: 'nidoo.maj.etat', // le dernier événement, pour comprendre après coup
  coque: 'nidoo.maj.coque', // la version web embarquée dans l'appli installée (sa coque native)
  session: 'nidoo.maj.session', // (sessionStorage) la version déjà tentée depuis l'ouverture
}

type Annonce = {
  version: number
  commit?: string
  publier?: boolean
  retirer?: boolean
  natifMin?: number
  plugins?: string[]
  manifeste: string
}

function lire<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null
  } catch {
    return null
  }
}
function ecrire(k: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* plein ou interdit : sans conséquence */
  }
}
function noter(quoi: string, detail?: unknown) {
  const d = detail == null ? '' : String((detail as { message?: string })?.message ?? detail).slice(0, 200)
  ecrire(K.etat, { le: Date.now(), quoi, detail: d })
  return quoi
}

let installation = false

/** 1. Au lancement : installer la version téléchargée. Vrai si la page va être remplacée (ne rien afficher). */
export async function installerAuLancement(): Promise<boolean> {
  if (!BRANCHEE) return false
  const retour = lire<number>(K.retour)
  if (retour) {
    ecrire(K.retour, null)
    if (retour === VERSION_WEB) {
      ecrire(K.prete, null)
      ecrire(K.essais, null)
      installation = true
      try {
        await CapacitorUpdater.reset()
        return true
      } catch (e) {
        installation = false
        noter('retour raté', e)
      }
    }
  }
  const prete = lire<{ id: string; version: number }>(K.prete)
  const v = prete?.version ?? 0
  if (!prete?.id || !(v > VERSION_WEB)) return false
  const essais = lire<Record<string, number>>(K.essais) ?? {}
  const n = essais[v] ?? 0
  if (n >= ESSAIS_MAX) {
    // installée deux fois sans jamais confirmer son démarrage : elle ne marche pas sur cet iPhone
    ecrire(K.refus, { version: v, le: Date.now() })
    ecrire(K.prete, null)
    ecrire(K.essais, null)
    noter('version écartée', v)
    return false
  }
  try {
    if (sessionStorage.getItem(K.session) === String(v)) return false // le plugin vient de revenir en arrière
    sessionStorage.setItem(K.session, String(v))
  } catch {
    /* rien */
  }
  ecrire(K.essais, { [v]: n + 1 })
  installation = true
  noter('installation', `${VERSION_WEB} → ${v}`)
  try {
    await CapacitorUpdater.set({ id: prete.id })
    return true
  } catch (e) {
    // le paquet n'existe plus (appli mise à jour par TestFlight, ou effacé) : on l'oublie, il sera retéléchargé
    installation = false
    ecrire(K.prete, null)
    ecrire(K.essais, n > 0 ? { [v]: n } : null)
    noter('installation ratée', e)
    return false
  }
}

let confirme = false
/** 2. L'appli s'est affichée : cette version marche. Puis on regarde s'il y a plus récent. */
export function appliPrete() {
  if (!BRANCHEE || confirme || installation) return
  confirme = true
  void (async () => {
    try {
      await CapacitorUpdater.notifyAppReady()
      const cur = await CapacitorUpdater.current()
      // le contenu embarqué dans l'appli installée : c'est l'âge de sa coque native
      if (!cur.bundle?.id || cur.bundle.id === 'builtin') ecrire(K.coque, VERSION_WEB)
    } catch {
      /* rien */
    }
    const prete = lire<{ version: number }>(K.prete)
    if (prete && !(prete.version > VERSION_WEB)) ecrire(K.prete, null)
    const essais = lire<Record<string, number>>(K.essais)
    if (essais && essais[VERSION_WEB] != null) ecrire(K.essais, null)
    window.setTimeout(() => void verifier(true), ATTENTE_MS)
  })()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verifier()
  })
}

async function chercher<T>(url: string): Promise<T> {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), DELAI_MS)
  try {
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store', credentials: 'omit', signal: ctl.signal })
    if (!r.ok) throw new Error(`réponse ${r.status}`)
    return (await r.json()) as T
  } finally {
    window.clearTimeout(t)
  }
}
const surLeSite = (u: unknown): u is string => typeof u === 'string' && u.startsWith(ORIGINE) && !u.includes('..') && !u.includes('\\')
function manifesteSur(m: unknown): m is ManifestEntry[] {
  if (!Array.isArray(m) || m.length < 20 || m.length > 8000) return false
  let index = false
  for (const e of m as ManifestEntry[]) {
    const f = e?.file_name
    if (typeof f !== 'string' || !f || f.startsWith('/') || f.includes('..') || f.includes('\\')) return false
    if (!/^[0-9a-f]{64}$/.test(String(e.file_hash))) return false
    if (!surLeSite(e.download_url)) return false
    if (f === 'index.html') index = true
  }
  return index
}
function ecartee(v: number) {
  const r = lire<{ version: number; le: number }>(K.refus)
  if (!r || r.version !== v) return false
  if (Date.now() - r.le > REFUS_MS) {
    ecrire(K.refus, null)
    return false
  }
  return true
}

let enCours = false
/** 3. Que dit le site ? (force : même si on a regardé il y a moins d'une demi-heure) */
export async function verifier(force = false): Promise<string> {
  if (!BRANCHEE || enCours || installation) return 'rien'
  if (navigator.onLine === false) return 'hors ligne'
  if (!force && Date.now() - (lire<number>(K.vu) ?? 0) < PAUSE_MS) return 'attente'
  enCours = true
  ecrire(K.vu, Date.now())
  try {
    const pub = await chercher<Annonce>(ANNONCE)
    if (!pub || typeof pub.version !== 'number') return noter('annonce illisible')
    const cur = await CapacitorUpdater.current()
    const actuel = cur.bundle?.id || 'builtin'
    if (pub.retirer) {
      if (actuel !== 'builtin') {
        ecrire(K.retour, VERSION_WEB)
        return noter('version retirée')
      }
      return noter('à jour', 'publication retirée')
    }
    if (pub.publier === false) return noter('à jour', 'publication arrêtée')
    const v = pub.version
    let prete = lire<{ id: string; version: number }>(K.prete)
    if (prete && prete.version !== v) {
      ecrire(K.prete, null)
      prete = null
    }
    if (v === VERSION_WEB) return noter('à jour')
    if (v < VERSION_WEB) {
      // l'annonce est plus ancienne : si la version en cours a été téléchargée, la publication a été retirée
      if (actuel !== 'builtin') {
        ecrire(K.retour, VERSION_WEB)
        return noter('version retirée', v)
      }
      return noter('à jour')
    }
    if (ecartee(v)) return noter('version écartée', v)
    const coque = lire<number>(K.coque) ?? 0
    if (!coque || (pub.natifMin && coque < pub.natifMin)) return noter('appli à mettre à jour', `coque ${coque || '?'} < ${pub.natifMin}`)
    const manque = (pub.plugins ?? []).filter((n) => !Capacitor.isPluginAvailable(n))
    if (manque.length) return noter('appli à mettre à jour', `il manque ${manque.join(', ')}`)
    if (!surLeSite(pub.manifeste)) return noter('adresse refusée', pub.manifeste)
    const nom = `v${v}`
    let paquets: { id: string; version: string; status: string }[] | null = null
    try {
      paquets = (await CapacitorUpdater.list()).bundles
    } catch {
      paquets = null
    }
    if (prete?.id) {
      if (!paquets || paquets.some((b) => b.id === prete!.id && (b.status === 'pending' || b.status === 'success'))) return noter('prête', nom)
      ecrire(K.prete, null)
    }
    let menage = 0
    for (const b of paquets ?? []) {
      if (!b?.id || b.id === 'builtin' || b.id === actuel || b.status !== 'pending') continue
      // un téléchargement fini dont la page n'a pas eu la réponse : on le reprend
      if (b.version === nom) {
        ecrire(K.prete, { id: b.id, version: v })
        return noter('prête', nom)
      }
      if (menage++ < 3) CapacitorUpdater.delete({ id: b.id }).catch(() => undefined)
    }
    const m = await chercher<unknown>(pub.manifeste)
    if (!manifesteSur(m)) throw new Error('manifeste refusé')
    const paquet = await CapacitorUpdater.download({ url: pub.manifeste, version: nom, manifest: m })
    if (!paquet?.id) throw new Error('paquet sans identifiant')
    ecrire(K.prete, { id: paquet.id, version: v })
    return noter('prête', nom)
  } catch (e) {
    ecrire(K.vu, Date.now() - PAUSE_MS + REPRISE_MS)
    return noter('vérification ratée', e)
  } finally {
    enCours = false
  }
}

/** Pour la ligne « Version » de Famille. */
export function etatMaj() {
  const prete = lire<{ version: number }>(K.prete)
  return {
    branchee: BRANCHEE,
    version: VERSION_WEB,
    commit: COMMIT_WEB,
    prete: prete && prete.version > VERSION_WEB ? prete.version : 0,
    dernier: lire<{ le: number; quoi: string; detail: string }>(K.etat),
  }
}

/** 20261121104430 (heure universelle) → « 21/11 11:44 » (heure de l'iPhone) */
export function dateVersion(v: number) {
  const s = String(v)
  if (s.length < 12) return s
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)))
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')
}
