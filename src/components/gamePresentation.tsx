import type { CSSProperties, ReactNode } from 'react'

const AMBIANCES: Record<string, [string, string]> = {
  puissance4: ['#6D4BD1', '#F0EAFE'],
  morpion: ['#26765B', '#E6F4ED'],
  memory: ['#A24E73', '#FCEAF2'],
  bataille: ['#28779B', '#E5F3FA'],
  quidenous: ['#A26820', '#FFF3D9'],
  dessin: ['#A65740', '#FFF0E6'],
  telephone: ['#6D4BD1', '#F0EAFE'],
  tour: ['#6D4BD1', '#F0EAFE'],
}

export function GamePresentation({ kind, children }: { kind: string; children: ReactNode }) {
  const [accent, fond] = AMBIANCES[kind] ?? AMBIANCES.tour
  return <div className="game-room" data-kind={kind} style={{ '--game-accent': accent, '--game-tint': fond } as CSSProperties}>{children}</div>
}

export function GameStatus({ art, status, active, finished }: { art: string; status: string; active: boolean; finished: boolean }) {
  return (
    <div className="game-status" data-active={active} data-finished={finished}>
      <div className="game-status-art"><img src={`./art/${art}.webp`} alt="" /></div>
      <p role="status" className="min-w-0 font-rond text-titre3 leading-tight">{status}</p>
    </div>
  )
}
