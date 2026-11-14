import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relative : marche sur GitHub Pages (/nidoo/) comme dans Capacitor
export default defineConfig({ base: './', plugins: [react()] })
