// Construire le banc d'essai des personnages (banc.html), à part de l'appli : npx vite build -c vite.banc.config.ts
import { mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(base, { build: { rollupOptions: { input: 'banc.html' }, outDir: process.env.BANC_OUT ?? '/tmp/dist-banc', emptyOutDir: true } })
