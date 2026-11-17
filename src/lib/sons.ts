// Les petits sons de la maison, générés avec ElevenLabs (public/sons/).
// Web Audio plutôt que <audio> : départ immédiat, plusieurs sons à la fois,
// et sur iPhone le bouton silencieux coupe les sons, comme pour les autres apps.

const PREF = 'nidoo.sons'

export type Son =
  | 'geste-calin' | 'geste-bisou' | 'geste-coeur' | 'geste-courage' | 'geste-mot'
  | 'chat' | 'chien' | 'lapin' | 'renard' | 'panda' | 'koala' | 'pingouin' | 'hibou'
  | 'croquettes' | 'oiseaux' | 'arrosage' | 'etoiles' | 'jouet'

type Ctx = AudioContext
let ctx: Ctx | null = null
const buffers = new Map<Son, Promise<AudioBuffer | null>>()

export function sonsActives() {
  try {
    return localStorage.getItem(PREF) !== 'off'
  } catch {
    return true
  }
}

export function activerSons(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off')
  } catch {
    /* tant pis : le réglage ne sera pas retenu */
  }
}

function audio(): Ctx | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    return null
  }
  return ctx
}

// iOS ne laisse jouer un son qu'après un premier toucher : on réveille l'audio à ce moment-là.
if (typeof window !== 'undefined') {
  let ready = false
  const wake = () => {
    const c = audio()
    if (c && c.state !== 'running') void c.resume().catch(() => undefined)
    if (!ready) {
      ready = true
      precharger('geste-calin', 'geste-bisou', 'geste-coeur', 'geste-courage', 'geste-mot')
    }
  }
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('touchend', wake, { passive: true })
}

function load(name: Son) {
  let p = buffers.get(name)
  if (!p) {
    const c = audio()
    p = !c
      ? Promise.resolve(null)
      : fetch(`./sons/${name}.mp3`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((b) => new Promise<AudioBuffer>((ok, ko) => c.decodeAudioData(b, ok, ko)))
          .catch(() => {
            buffers.delete(name) // on réessaiera la prochaine fois
            return null
          })
    buffers.set(name, p)
  }
  return p
}

/** Prépare des sons à l'avance pour qu'ils partent sans délai. */
export function precharger(...names: Son[]) {
  if (!sonsActives()) return
  names.forEach((n) => void load(n))
}

/** Joue un son (sans effet si les sons sont coupés ou si le navigateur ne sait pas). */
const last = new Map<Son, number>()
export function jouer(name: Son, volume = 0.9) {
  if (!sonsActives()) return
  // plusieurs maisons à l'écran (aperçus des widgets…) : un seul son, pas un écho
  const now = Date.now()
  if (now - (last.get(name) ?? 0) < 300) return
  last.set(name, now)
  const c = audio()
  if (!c) return
  void load(name).then((buf) => {
    if (!buf) return
    try {
      if (c.state !== 'running') void c.resume().catch(() => undefined)
      const src = c.createBufferSource()
      const gain = c.createGain()
      gain.gain.value = volume
      src.buffer = buf
      src.connect(gain).connect(c.destination)
      src.start()
    } catch {
      /* pas de son, pas grave */
    }
  })
}

const GESTES: Record<string, Son> = { calin: 'geste-calin', bisou: 'geste-bisou', coeur: 'geste-coeur', courage: 'geste-courage', mot: 'geste-mot' }
/** Le son d'une attention (câlin, bisou, cœur, courage, petit mot). */
export const sonGeste = (kind: string): Son => GESTES[kind] ?? 'geste-coeur'

const CRIS: Record<string, Son> = { chat: 'chat', chien: 'chien', lapin: 'lapin', renard: 'renard', panda: 'panda', koala: 'koala', pingouin: 'pingouin', hibou: 'hibou' }
/** Le petit cri du compagnon, selon son espèce. */
export const sonCompagnon = (species: string | null | undefined): Son => CRIS[species ?? ''] ?? 'chat'
