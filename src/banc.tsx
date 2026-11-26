// Le banc d'essai des personnages (banc.html) : une grille de figurines, chacune avec son « look », pour vérifier
// d'un coup toutes les figurines avec chaque couleur de cheveux et chaque habit de la boutique (scripts/banc/).
// Cette page n'est pas dans l'appli : seul index.html est construit pour le site et l'iPhone.
//   banc.html#<JSON> : { w: largeur d'une case (px), buste: bool, fond: couleur, cases: [{ a: 'perso:k50.x10…', n: 'nom' }] }
// Une case peut aussi montrer un compagnon : { pet: 'chat', habit: 'habit:bonnet' }.
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Character } from './components/Character'
import { PetFigure } from './components/pet'
import { lookOf } from './lib/look'
import './index.css'

type Case = { a?: string; n?: string; pet?: string; habit?: string | null }
type Demande = { w?: number; buste?: boolean; fond?: string; cases: Case[]; noms?: boolean; marge?: number }

function lire(): Demande {
  try {
    return JSON.parse(decodeURIComponent(location.hash.slice(1)))
  } catch {
    return { cases: [] }
  }
}

function Banc() {
  const d = lire()
  const w = d.w ?? 150
  const marge = d.marge ?? 0.22
  const prets = useRef(new Set<number>())
  const [, encore] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => {
      ;(window as unknown as { __pret: boolean }).__pret = prets.current.size >= d.cases.length
      encore((n) => n + 1)
    }, 200)
    return () => window.clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', background: d.fond ?? 'transparent', width: 'fit-content' }}>
      {d.cases.map((c, i) => (
        c.pet ? (
          <div key={i} data-case={i} style={{ width: w, position: 'relative' }}>
            <div style={{ width: w, height: w * (1 + marge), display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <PetFigure pet={{ species: c.pet, outfit: c.habit ?? null }} className="w-full" />
            </div>
            <Pret fait={() => prets.current.add(i)} />
            {d.noms !== false && <div style={{ font: '10px/12px system-ui', textAlign: 'center', color: '#333', background: '#fff', height: 12, overflow: 'hidden' }}>{c.n ?? ''}</div>}
          </div>
        ) : (
        <div key={i} data-case={i} style={{ width: w, position: 'relative' }}>
          {/* de la place au-dessus pour les chapeaux ; la figurine est posée en bas de sa case */}
          <div style={{ width: w, height: d.buste ? w : (w * 440) / 300 * (1 + marge), display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ width: '100%', position: 'relative' }}>
              <Character look={lookOf(c.a ?? '')} bust={d.buste} still onPret={() => prets.current.add(i)} />
            </div>
          </div>
          {d.noms !== false && <div style={{ font: '10px/12px system-ui', textAlign: 'center', color: '#333', background: '#fff', height: 12, overflow: 'hidden' }}>{c.n ?? ''}</div>}
        </div>
        )
      ))}
    </div>
  )
}

/** Un compagnon n'a rien à calculer : sa case est prête dès qu'elle est affichée. */
function Pret({ fait }: { fait: () => void }) {
  useEffect(fait, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

createRoot(document.getElementById('root')!).render(<Banc />)
