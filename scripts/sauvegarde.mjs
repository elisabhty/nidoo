// La sauvegarde de nuit (Elisa, 27 novembre) : chaque nuit, GitHub (.github/workflows/sauvegarde.yml) lance ce script.
//   node scripts/sauvegarde.mjs corbeille   efface pour de bon ce qui est à la corbeille depuis plus de 30 jours
//   node scripts/sauvegarde.mjs fichiers    copie les photos, vidéos et dessins de Supabase dans Cloudflare R2
//   node scripts/sauvegarde.mjs base        envoie la copie chiffrée de la base (DUMP_FICHIER) dans R2, garde 30 jours
// Supabase ne sauvegarde pas les fichiers, même en Pro : R2 en garde une copie (10 Go gratuits).
// Le dépôt est public : le journal ne montre que des nombres, jamais un nom de fichier.
// Mode d'emploi : docs/sauvegarde.md
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, statSync } from 'node:fs'

const env = process.env
const URL_SUPABASE = env.SUPABASE_URL || 'https://udhxnxuhyziuiwqotgle.supabase.co'
const TRENTE_JOURS = 30 * 86400000
const etape = process.argv[2]

function exiger(...noms) {
  const manque = noms.filter((n) => !env[n])
  if (manque.length) {
    console.log(`::notice::Sauvegarde pas encore réglée (il manque ${manque.join(', ')}) : voir docs/sauvegarde.md`)
    process.exit(0)
  }
}

const supabase = () => {
  exiger('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(URL_SUPABASE, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}
const r2 = () => {
  exiger('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  })
}
const check = (r) => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}
const paquets = (l, n) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n))

/** Tout ce qui répond à `f` (requête paginée par 1000). */
async function tout(f) {
  const out = []
  for (let de = 0; ; de += 1000) {
    const page = check(await f().range(de, de + 999))
    out.push(...page)
    if (page.length < 1000) return out
  }
}

// ───────── La corbeille : plus de 30 jours, on efface pour de bon ─────────
async function corbeille() {
  const sb = supabase()
  // la base ne connaît pas encore la corbeille (supabase/migrations/20261127230000_corbeille.sql) : rien à faire
  if ((await sb.from('moments').select('deleted_at').limit(1)).error) return console.log('Corbeille : pas encore dans la base.')
  const avant = new Date(Date.now() - TRENTE_JOURS).toISOString()

  // les publications (et leurs fichiers dans « moments »)
  const mo = await tout(() => sb.from('moments').select('id, image_path, audio_path, video_path, poster_path').lt('deleted_at', avant))
  const fichiersMo = mo.flatMap((m) => [m.image_path, m.audio_path, m.video_path, m.poster_path]).filter(Boolean)
  for (const p of paquets(mo.map((m) => m.id), 200)) check(await sb.from('moments').delete().in('id', p))
  for (const p of paquets(fichiersMo, 100)) await sb.storage.from('moments').remove(p)

  // un fichier d'album peut servir à plusieurs souvenirs (ou de couverture) : on ne l'efface que s'il ne sert plus
  const dossiersAEffacer = new Set()
  const encoreUtilise = async (path) => {
    const [a, b] = await Promise.all([
      sb.from('folder_items').select('id').or(`image_path.eq.${path},media_path.eq.${path}`).limit(1),
      sb.from('folders').select('id').eq('cover_path', path).limit(1),
    ])
    return !!(a.data?.length || b.data?.length)
  }

  // les albums (avec leurs sous-albums et leur contenu)
  const albums = await tout(() => sb.from('folders').select('id').lt('deleted_at', avant))
  let nbAlbums = 0
  for (const { id } of albums) {
    const sous = check(await sb.from('folders').select('id, cover_path').eq('root_id', id))
    const ids = [id, ...sous.map((d) => d.id)]
    const items = await tout(() => sb.from('folder_items').select('image_path, media_path').in('folder_id', ids))
    items.flatMap((i) => [i.image_path, i.media_path]).filter(Boolean).forEach((p) => dossiersAEffacer.add(p))
    sous.map((d) => d.cover_path).filter((p) => p?.includes('/couverture-')).forEach((p) => dossiersAEffacer.add(p))
    check(await sb.from('folders').delete().eq('id', id))
    nbAlbums++
  }

  // les souvenirs mis à la corbeille un par un
  const items = await tout(() => sb.from('folder_items').select('id, image_path, media_path').lt('deleted_at', avant))
  items.flatMap((i) => [i.image_path, i.media_path]).filter(Boolean).forEach((p) => dossiersAEffacer.add(p))
  for (const p of paquets(items.map((i) => i.id), 200)) check(await sb.from('folder_items').delete().in('id', p))

  const libres = []
  for (const p of dossiersAEffacer) if (!(await encoreUtilise(p))) libres.push(p)
  for (const p of paquets(libres, 100)) await sb.storage.from('dossiers').remove(p)
  console.log(`Corbeille : ${mo.length} publication(s), ${nbAlbums} album(s), ${items.length} souvenir(s) effacés pour de bon ; ${fichiersMo.length + libres.length} fichier(s).`)
}

// ───────── Les fichiers : ce qui manque dans R2 y est copié ─────────
async function listerR2(s3, prefixe) {
  const tailles = new Map()
  let suite
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix: prefixe, ContinuationToken: suite }))
    for (const o of r.Contents ?? []) tailles.set(o.Key, o.Size)
    suite = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (suite)
  return tailles
}

async function listerSupabase(sb, bucket, dossier = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const page = check(await sb.storage.from(bucket).list(dossier, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }))
    for (const e of page) {
      const chemin = dossier ? `${dossier}/${e.name}` : e.name
      if (e.id === null) out.push(...(await listerSupabase(sb, bucket, chemin)))
      else if (e.name !== '.emptyFolderPlaceholder') out.push({ chemin, taille: e.metadata?.size ?? -1, type: e.metadata?.mimetype })
    }
    if (page.length < 1000) return out
  }
}

async function fichiers() {
  const sb = supabase()
  const s3 = r2()
  const buckets = check(await sb.storage.listBuckets())
  let copies = 0
  let deja = 0
  let octets = 0
  let echecs = 0
  for (const b of buckets) {
    const prefixe = `fichiers/${b.id}/`
    const dansR2 = await listerR2(s3, prefixe)
    const aCopier = (await listerSupabase(sb, b.id)).filter((f) => {
      const t = dansR2.get(prefixe + f.chemin)
      if (t !== undefined && (f.taille < 0 || t === f.taille)) return deja++, false
      return true
    })
    // quatre à la fois
    const file = [...aCopier]
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let f = file.shift(); f; f = file.shift()) {
          try {
            const blob = check(await sb.storage.from(b.id).download(f.chemin))
            const corps = Buffer.from(await blob.arrayBuffer())
            await s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: prefixe + f.chemin, Body: corps, ContentType: f.type || blob.type || 'application/octet-stream' }))
            copies++
            octets += corps.length
          } catch {
            echecs++
          }
        }
      }),
    )
  }
  console.log(`Fichiers : ${copies} copié(s) cette nuit (${(octets / 1048576).toFixed(1)} Mo), ${deja} déjà à l'abri${echecs ? `, ${echecs} en échec (réessayés la nuit prochaine)` : ''}.`)
  if (echecs) process.exitCode = 1
}

// ───────── La base : la copie chiffrée de la nuit, 30 jours gardés ─────────
async function base() {
  const s3 = r2()
  const f = env.DUMP_FICHIER
  if (!f) throw new Error('DUMP_FICHIER manquant')
  const jour = new Date().toISOString().slice(0, 10)
  const nom = `base/${jour}${f.endsWith('.enc') ? '.dump.enc' : '.dump'}`
  await s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: nom, Body: readFileSync(f), ContentType: 'application/octet-stream' }))
  const r = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix: 'base/' }))
  const vieux = (r.Contents ?? []).filter((o) => o.LastModified && Date.now() - o.LastModified.getTime() > TRENTE_JOURS).map((o) => ({ Key: o.Key }))
  if (vieux.length) await s3.send(new DeleteObjectsCommand({ Bucket: env.R2_BUCKET, Delete: { Objects: vieux } }))
  console.log(`Base : copie du ${jour} gardée (${(statSync(f).size / 1048576).toFixed(1)} Mo) ; ${vieux.length} copie(s) de plus de 30 jours effacée(s).`)
}

const etapes = { corbeille, fichiers, base }
if (!etapes[etape]) {
  console.error('Usage : node scripts/sauvegarde.mjs corbeille|fichiers|base')
  process.exit(2)
}
await etapes[etape]().catch((e) => {
  // un message sans détail : le dépôt est public
  console.error(`::error::${etape} : ${String(e?.message ?? e).slice(0, 200)}`)
  process.exit(1)
})
