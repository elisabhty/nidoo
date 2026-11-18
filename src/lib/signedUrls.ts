/** Évite de redemander à Supabase les mêmes liens signés à chaque mise à jour Realtime. */
export type SignedLink = { path: string; signedUrl: string }
type Entry = { url: string; refreshAt: number }

export function createSignedUrlCache(
  sign: (bucket: string, paths: string[]) => Promise<SignedLink[]>,
  now: () => number = () => Date.now(),
) {
  const entries = new Map<string, Entry>()
  return async (bucket: string, paths: (string | null | undefined)[]): Promise<Map<string, string>> => {
    const unique = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))]
    const missing = unique.filter((path) => {
      const cached = entries.get(bucket + ':' + path)
      return !cached || cached.refreshAt <= now()
    })
    if (missing.length) {
      const signed = await sign(bucket, missing)
      // Les URLs sont valables 60 minutes ; on les renouvelle au bout de 55.
      const refreshAt = now() + 55 * 60000
      for (const item of signed) {
        if (item.path && item.signedUrl && missing.includes(item.path)) {
          entries.set(bucket + ':' + item.path, { url: item.signedUrl, refreshAt })
        }
      }
    }
    return new Map(unique.flatMap((path) => {
      const entry = entries.get(bucket + ':' + path)
      return entry && entry.refreshAt > now() ? [[path, entry.url] as const] : []
    }))
  }
}
