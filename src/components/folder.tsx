import { useHome } from '../lib/store'
import { gradientOf } from '../lib/folders'
import type { Folder } from '../lib/types'
import { Avatar } from './ui'

/** Couverture d'un dossier : sa photo, sinon un dégradé avec son initiale. */
export function FolderCover({ folder, url, size = 'md' }: { folder: Pick<Folder, 'id' | 'name'>; url: string | null; size?: 'sm' | 'md' | 'lg' }) {
  if (url) return <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
  const letter = (folder.name.trim()[0] ?? '·').toUpperCase()
  const font = { sm: 'text-[46px]', md: 'text-[78px]', lg: 'text-[150px]' }[size]
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: gradientOf(folder.id) }} aria-hidden>
      <span className="absolute -left-[12%] -top-[18%] h-[70%] w-[70%] rounded-full bg-white/25 blur-2xl" />
      <span className="absolute -bottom-[25%] -right-[10%] h-[65%] w-[65%] rounded-full bg-black/10 blur-2xl" />
      <span className={`absolute right-[8%] top-[4%] font-rond font-bold leading-none text-white/85 ${font}`} style={{ textShadow: '0 6px 24px rgba(0,0,0,0.12)' }}>
        {letter}
      </span>
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
