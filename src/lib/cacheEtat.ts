// La dernière maison vue, gardée sur l'appareil (IndexedDB) : au lancement, l'appli l'affiche tout de suite
// pendant que la version à jour arrive du serveur. Ce n'est qu'une copie pour démarrer vite : la vérité reste en ligne.

const BASE = 'nidoo-cache'
const TABLE = 'etats'

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(TABLE)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ko(r.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir()
  try {
    return await new Promise<T>((ok, ko) => {
      const r = f(db.transaction(TABLE, mode).objectStore(TABLE))
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ko(r.error)
    })
  } finally {
    db.close()
  }
}

export type Copie<T> = { at: number; uid: string; valeur: T }

/** Lit la copie (null s'il n'y en a pas, si elle est d'un autre compte, ou si le téléphone refuse). */
export async function lireCopie<T>(cle: string, uid: string): Promise<Copie<T> | null> {
  try {
    const c = (await tx('readonly', (s) => s.get(cle))) as Copie<T> | undefined
    return c && c.uid === uid ? c : null
  } catch {
    return null
  }
}

export async function ecrireCopie<T>(cle: string, uid: string, valeur: T): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put({ at: Date.now(), uid, valeur } satisfies Copie<T>, cle))
  } catch {
    /* pas de place ou navigation privée : on démarrera sans copie */
  }
}

export async function effacerCopies(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear())
  } catch {
    /* rien à effacer */
  }
}

/** Les liens signés des photos ne durent qu'un temps : passé ce délai, on les retire de la copie
 *  (les images se rechargent avec la version à jour, au lieu d'afficher des liens morts). */
export function sansLiens<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sansLiens) as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = /_url$/.test(k) && typeof x === 'string' ? null : sansLiens(x)
    return out as T
  }
  return v
}
