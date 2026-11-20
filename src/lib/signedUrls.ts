/** Évite de redemander à Supabase les mêmes liens signés à chaque mise à jour Realtime.
 *  Avec `garde`, les liens sont aussi gardés sur l'appareil d'un lancement à l'autre : une photo garde la même
 *  adresse tant que son lien est valable, donc le téléphone la ressort de son cache au lieu de la retélécharger
 *  (plus de cases blanches qui se remplissent une à une à chaque ouverture). */
export type SignedLink = { path: string; signedUrl: string }
type Entry = { url: string; refreshAt: number }
export type Garde = { lire(): Promise<Record<string, Entry> | null>; ecrire(liens: Record<string, Entry>): void }

export function createSignedUrlCache(
  sign: (bucket: string, paths: string[]) => Promise<SignedLink[]>,
  now: () => number = () => Date.now(),
  /** Les URLs sont valables 60 minutes par défaut ; on les renouvelle au bout de 55. */
  refreshMs = 55 * 60000,
  garde?: Garde,
) {
  const entries = new Map<string, Entry>()
  let relu: Promise<void> | null = null
  const relire = () =>
    (relu ??= (garde ? garde.lire() : Promise.resolve(null)).then(
      (g) => {
        for (const [k, e] of Object.entries(g ?? {})) if (e && typeof e.url === 'string' && e.refreshAt > now() && !entries.has(k)) entries.set(k, e)
      },
      () => undefined,
    ))
  return async (bucket: string, paths: (string | null | undefined)[]): Promise<Map<string, string>> => {
    if (garde) await relire()
    const unique = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))]
    const missing = unique.filter((path) => {
      const cached = entries.get(bucket + ':' + path)
      return !cached || cached.refreshAt <= now()
    })
    if (missing.length) {
      const signed = await sign(bucket, missing)
      const refreshAt = now() + refreshMs
      for (const item of signed) {
        if (item.path && item.signedUrl && missing.includes(item.path)) {
          entries.set(bucket + ':' + item.path, { url: item.signedUrl, refreshAt })
        }
      }
      if (garde) {
        // on ne garde que les liens encore valables
        for (const [k, e] of entries) if (e.refreshAt <= now()) entries.delete(k)
        garde.ecrire(Object.fromEntries(entries))
      }
    }
    return new Map(unique.flatMap((path) => {
      const entry = entries.get(bucket + ':' + path)
      return entry && entry.refreshAt > now() ? [[path, entry.url] as const] : []
    }))
  }
}
