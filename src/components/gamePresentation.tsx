import type { CSSProperties, ReactNode } from 'react'

export const AMBIANCES: Record<string, [string, string]> = {
  puissance4: ['#6D4BD1', '#F0EAFE'],
  morpion: ['#26765B', '#E6F4ED'],
  memory: ['#A24E73', '#FCEAF2'],
  bataille: ['#28779B', '#E5F3FA'],
  quidenous: ['#A26820', '#FFF3D9'],
  dessin: ['#A65740', '#FFF0E6'],
  telephone: ['#6D4BD1', '#F0EAFE'],
  tour: ['#3F7FB8', '#E6F1FB'],
  porte: ['#B5546E', '#FDEBEF'],
}

/** Une tuile de jeu dans « Jouer ensemble » : son illustration sur un fond à sa couleur, son nom, ce qu'on y fait. */
export function GameTile({ kind, art, name, hint, onClick }: { kind: string; art: string; name: string; hint: string; onClick: () => void }) {
  const [accent, fond] = AMBIANCES[kind] ?? AMBIANCES.puissance4
  return (
    <button type="button" onClick={onClick} className="game-tile presse" style={{ '--game-accent': accent, '--game-tint': fond } as CSSProperties}>
      <span className="game-tile-art"><img src={`./art/${art}.webp`} alt="" /></span>
      <span className={`mt-2 block w-full truncate px-0.5 font-bold text-encre ${name.length > 15 ? 'text-[11.5px] leading-4 tracking-[-0.02em]' : 'text-legende'}`}>{name}</span>
      <span className={`block w-full truncate px-0.5 pb-2.5 text-brume ${hint.length > 15 ? 'text-[11.5px] leading-[15px] tracking-[-0.02em]' : 'text-mini'}`}>{hint}</span>
    </button>
  )
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
