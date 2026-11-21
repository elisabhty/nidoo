// Mise à jour à distance de l'appli iPhone (voir src/lib/majDistance.ts et le README) : à chaque mise en ligne du site
// (.github/workflows/pages.yml, après « npm run build »), ce script écrit ce que les iPhone liront :
//   dist/maj/version.json    la version à avoir, ce qu'il faut à l'appli installée pour la recevoir, l'adresse du manifeste
//   dist/maj/manifeste.json  chaque fichier de l'appli web, son empreinte SHA-256 et son adresse sur le site
// Le plugin (@capgo/capacitor-updater) ne télécharge que les fichiers qui ont changé ; les autres sont repris dans l'appli.
//
// Ce qu'une appli installée doit avoir pour recevoir la version :
//   • chaque plugin natif utilisé (une appli construite avant l'ajout d'un plugin ne reçoit rien : elle attend TestFlight) ;
//   • une coque assez récente : construite depuis le dernier commit qui a touché au natif (ios/, capacitor.config.ts),
//     ou depuis natifMin (maj/regles.json) si c'est plus récent.
//
//   node scripts/maj-paquet.mjs            (dans la mise en ligne)
//   node scripts/maj-paquet.mjs --verifier (pour voir, sans rien écrire)
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ORIGINE = 'https://elisabhty.github.io/nidoo/'
const racine = new URL('..', import.meta.url).pathname
const dist = join(racine, 'dist')
const lire = (f) => JSON.parse(readFileSync(f, 'utf8'))

// les plugins natifs, sous le nom que l'appli leur donne (Capacitor.isPluginAvailable)
const NOMS = {
  '@capacitor/haptics': 'Haptics',
  '@capacitor/share': 'Share',
  '@capacitor/keyboard': 'Keyboard',
  '@capacitor/local-notifications': 'LocalNotifications',
  '@capgo/capacitor-updater': 'CapacitorUpdater',
}
const PAS_DES_PLUGINS = new Set(['@capacitor/core', '@capacitor/cli', '@capacitor/ios', '@capacitor/android'])

const chiffres = (d) => Number(d.toISOString().slice(0, 19).replace(/[-T:]/g, ''))
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { cwd: racine, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

function fichiers(dossier) {
  const out = []
  for (const nom of readdirSync(dossier)) {
    if (nom.startsWith('.')) continue
    const p = join(dossier, nom)
    if (statSync(p).isDirectory()) out.push(...fichiers(p))
    else out.push(p)
  }
  return out
}

const { version, commit } = lire(join(dist, 'nidoo-version.json'))
const regles = lire(join(racine, 'maj', 'regles.json'))
const pkg = lire(join(racine, 'package.json'))

const plugins = ['Nidoo']
let inconnu = false
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (!/^@capacitor\/|^@capgo\/|capacitor-plugin/.test(dep) || PAS_DES_PLUGINS.has(dep)) continue
  if (NOMS[dep]) plugins.push(NOMS[dep])
  else {
    // un plugin que ce script ne connaît pas encore : seule une appli construite depuis ce commit le recevra
    console.warn(`maj-paquet : plugin inconnu ${dep} (à ajouter dans NOMS) : réservé aux applis construites depuis ce commit`)
    inconnu = true
  }
}

const natifSec = Number(git('log -1 --format=%ct -- ios capacitor.config.ts'))
const natif = natifSec ? chiffres(new Date(natifSec * 1000)) : 0
const natifMin = Math.max(natif, Number(regles.natifMin) || 0, inconnu ? version : 0)

const liste = fichiers(dist).filter((f) => !relative(dist, f).startsWith(`maj${sep}`))
const manifeste = liste.map((f) => {
  const nom = relative(dist, f).split(sep).join('/')
  const h = createHash('sha256').update(readFileSync(f)).digest('hex')
  // l'empreinte dans l'adresse : le cache du site ne peut pas servir une ancienne version du fichier
  return { file_name: nom, file_hash: h, download_url: `${ORIGINE}${nom.split('/').map(encodeURIComponent).join('/')}?h=${h.slice(0, 12)}` }
})
if (!manifeste.some((e) => e.file_name === 'index.html')) throw new Error('maj-paquet : pas d’index.html dans dist')

const annonce = {
  version,
  commit,
  publiee: new Date().toISOString(),
  publier: regles.publier !== false,
  retirer: regles.retirer === true,
  natifMin,
  plugins,
  fichiers: manifeste.length,
  manifeste: `${ORIGINE}maj/manifeste.json?v=${version}`,
}

if (process.argv.includes('--verifier')) {
  console.log(JSON.stringify({ ...annonce, natifDernierChangement: natif }, null, 2))
} else {
  mkdirSync(join(dist, 'maj'), { recursive: true })
  writeFileSync(join(dist, 'maj', 'manifeste.json'), JSON.stringify(manifeste))
  writeFileSync(join(dist, 'maj', 'version.json'), JSON.stringify(annonce, null, 2))
  console.log(`maj-paquet : version ${version} (${commit}), ${manifeste.length} fichiers, appli installée depuis ${natifMin || 'toujours'}, plugins ${plugins.join(', ')}`)
}
