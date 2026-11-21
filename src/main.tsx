import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { StoreProvider } from './lib/store'
import { surveillerMiseAJour } from './lib/miseAJour'
import { preparerClavier } from './lib/useKeyboardViewport'

surveillerMiseAJour()
preparerClavier()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
