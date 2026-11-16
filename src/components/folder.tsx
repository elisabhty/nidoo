import { useHome } from '../lib/store'
import { folderArt, gradientOf } from '../lib/folders'
import type { Folder } from '../lib/types'
import { Avatar } from './ui'

/** Couverture d'un dossier : sa photo, sinon un fond pastel et une illustration 3D choisie selon son nom. */
export function FolderCover({ folder, url, size = 'md' }: { folder: Pick<Folder, 'id' | 'name'>; url: string | null; size?: 'sm' | 'md' | 'lg' | 'wide' }) {
  if (url) return <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
  const place = {
    wide: 'right-[3%] top-[8%] w-[36%]',
    sm: 'right-[27%] top-[10%] w-[46%]',
    md: 'right-[9%] top-[8%] w-[50%]',
    lg: 'right-[7%] top-[calc(var(--sat)+58px)] w-[34%]',
  }[size]
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: gradientOf(folder.id) }} aria-hidden>
      <span className="absolute -left-[18%] -top-[28%] h-[85%] w-[85%] rounded-full bg-white/45 blur-2xl" />
      <img
        src={`./art/${folderArt(folder.name)}.webp`}
        alt=""
        draggable={false}
        className={`absolute aspect-square object-contain ${place}`}
        style={{ transform: 'rotate(-7deg)', filter: 'drop-shadow(0 12px 16px rgba(29,26,43,0.16))' }}
      />
    </div>
  )
}

/** Avatars qui se chevauchent, avec « +N » au-delà de max. */
export function MemberStack({ ids, size = 28, max = 4, ring = 'white' }: { ids: string[]; size?: number; max?: number; ring?: string }) {
  const { state } = useHome()
  const people = ids.map((id) => state.members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="flex items-center">
      {shown.map((m, i) => (
        <span key={m.id} className="rounded-full" style={{ marginLeft: i ? -size * 0.3 : 0, boxShadow: `0 0 0 2px ${ring}` }}>
          <Avatar m={m} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-remplissage font-semibold text-encre"
          style={{ width: size, height: size, marginLeft: -size * 0.3, fontSize: size * 0.38, boxShadow: `0 0 0 2px ${ring}`, background: '#ECE8F4' }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
