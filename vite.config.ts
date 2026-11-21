import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La version de l'appli web : l'heure du commit, en chiffres (20261121104430). La même sur le site et dans l'appli
// iPhone construite depuis ce commit : c'est elle que la mise à jour à distance compare (src/lib/majDistance.ts).
const git = (cmd: string) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}
const chiffres = (d: Date) => Number(d.toISOString().slice(0, 19).replace(/[-T:]/g, ''))
const secondes = Number(git('log -1 --format=%ct'))
const VERSION = chiffres(secondes ? new Date(secondes * 1000) : new Date())
const COMMIT = git('rev-parse --short HEAD') || 'local'

// base relative : marche sur GitHub Pages (/nidoo/) comme dans Capacitor
export default defineConfig({
  base: './',
  define: { __NIDOO_VERSION__: JSON.stringify(VERSION), __NIDOO_COMMIT__: JSON.stringify(COMMIT) },
  plugins: [
    react(),
    {
      name: 'nidoo-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'nidoo-version.json', source: JSON.stringify({ version: VERSION, commit: COMMIT }) })
      },
    },
  ],
  // le travailleur de la carte (MapLibre, « Où est la famille ») : un seul fichier, en module
  worker: { format: 'es' },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
})
