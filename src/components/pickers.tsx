import { AVATARS, COLOR_KEYS, COLORS, HOUSES } from '../lib/data'
import { select } from '../lib/haptic'
import type { HouseType } from '../lib/types'
import House from './House'
import { Art, Avatar } from './ui'

export function ProfilePicker({
  name, setName, avatar, setAvatar, color, setColor,
}: { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void }) {
  return (
    <>
      <div className="flex justify-center pt-1">
        <Avatar m={{ avatar, color }} size={104} />
      </div>
      <input className="champ mt-5 !bg-carte text-center font-rond text-titre3" placeholder="Ton prénom ou ton surnom" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="groupe mt-4 grid grid-cols-6 gap-1 p-2">
        {AVATARS.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              select()
              setAvatar(a.key)
            }}
            aria-pressed={avatar === a.key}
            aria-label={a.label}
            className={`presse flex aspect-square items-center justify-center rounded-[14px] ${avatar === a.key ? 'bg-teinte-doux ring-2 ring-teinte' : ''}`}
          >
            <Art name={`avatar-${a.key}`} className="h-[84%] w-[84%]" />
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-3.5">
        {COLOR_KEYS.map((c) => (
          <button
            key={c}
            onClick={() => {
              select()
              setColor(c)
            }}
            aria-pressed={color === c}
            aria-label={`Couleur ${c}`}
            className="presse h-9 w-9 rounded-full"
            style={{ background: `linear-gradient(160deg, ${COLORS[c].bg}, ${COLORS[c].ring})`, boxShadow: color === c ? `0 0 0 2.5px #F4F1F9, 0 0 0 5px ${COLORS[c].ring}` : undefined }}
          />
        ))}
      </div>
    </>
  )
}

export function HousePicker({ value, onChange }: { value: HouseType; onChange: (v: HouseType) => void }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2.5">
      {HOUSES.map((h) => (
        <button
          key={h.key}
          onClick={() => {
            select()
            onChange(h.key)
          }}
          aria-pressed={value === h.key}
          className={`presse overflow-hidden rounded-[20px] bg-carte pb-2.5 ${value === h.key ? 'ring-2 ring-teinte' : ''}`}
        >
          <House type={h.key} items={[]} phase="jour" className="!aspect-[1/1]" bare />
          <span className={`mt-2 block text-sous ${value === h.key ? 'font-semibold text-teinte-fonce' : 'font-medium'}`}>{h.label}</span>
          <span className="block px-1 text-mini text-brume">{h.hint}</span>
        </button>
      ))}
    </div>
  )
}
