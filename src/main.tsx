import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { StoreProvider } from './lib/store'
import { surveillerMiseAJour } from './lib/miseAJour'
import { preparerClavier } from './lib/useKeyboardViewport'
import { installerAuLancement } from './lib/majDistance'

surveillerMiseAJour()
preparerClavier()

let affichee = false
const afficher = () => {
  if (affichee) return
  affichee = true
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StrictMode>,
  )
}

// Dans l'appli iPhone, une version plus récente déjà téléchargée s'installe avant tout affichage (la page est remplacée,
// sous l'écran d'attente) ; si elle n'a pas pu l'être, l'appli démarre normalement (src/lib/majDistance.ts).
installerAuLancement().then(
  (remplacee) => (remplacee ? window.setTimeout(afficher, 5000) : afficher()),
  afficher,
)
