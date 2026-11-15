import { Dices } from 'lucide-react'
import { useState } from 'react'
import { COLOR_KEYS, COLORS, HOUSES } from '../lib/data'
import { select, tap } from '../lib/haptic'
import { BEARDS, encodeLook, EYES, GLASSES, HAIR_COLORS, HAIRSTYLES, lookOf, MOLES, randomLook, SKINS, TOPS, type Look } from '../lib/look'
import type { HouseType } from '../lib/types'
import { Character } from './Character'
import House from './House'
import { Segments } from './ui'

type Onglet = 'cheveux' | 'visage' | 'yeux' | 'details' | 'tenue'

/** Le créateur de personnage : un même visage pour tous, et chacun choisit ce qui le rend unique. */
export function ProfilePicker({
  name, setName, avatar, setAvatar, color, setColor,
}: { name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void }) {
  const look = lookOf(avatar)
  const [tab, setTab] = useState<Onglet>('cheveux')
  const [hop, setHop] = useState(0)
  const set = (patch: Partial<Look>) => {
    select()
    setAvatar(encodeLook({ ...look, ...patch }))
  }
  const c = COLORS[color] ?? COLORS.lavande

  // Une vignette du personnage avec une seule chose qui change : le choix se voit directement.
  const choix = (key: string, label: string, on: boolean, patch: Partial<Look>) => (
    <button key={key} onClick={() => set(patch)} aria-pressed={on} aria-label={label} className="presse flex flex-col items-center gap-1">
      <span className={`block h-[62px] w-[62px] overflow-hidden rounded-[18px] bg-remplissage transition-shadow ${on ? 'ring-[2.5px] ring-teinte' : ''}`}>
        <Character look={{ ...look, ...patch }} bust still className="block h-full w-full" />
      </span>
      <span className={`w-[66px] truncate text-center text-mini ${on ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>{label}</span>
    </button>
  )
  const pastilles = (list: string[], value: number, onPick: (i: number) => void, label: string) => (
    <div className="flex flex-wrap gap-2.5">
      {list.map((hex, i) => (
        <button
          key={hex}
          onClick={() => onPick(i)}
          aria-pressed={value === i}
          aria-label={`${label} ${i + 1}`}
          className="presse h-9 w-9 rounded-full"
          style={{ background: hex, boxShadow: value === i ? `0 0 0 2.5px #FFFFFF, 0 0 0 4.5px #7A5AE0` : 'inset 0 0 0 1px rgba(29,26,43,0.12)' }}
        />
      ))}
    </div>
  )
  const bascule = (label: string, on: boolean, patch: Partial<Look>) => (
    <button onClick={() => set(patch)} aria-pressed={on} className={`presse h-9 rounded-full px-3.5 text-sous font-semibold transition-colors ${on ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}>
      {label}
    </button>
  )
  const titre = (t: string) => <p className="mb-2 mt-4 text-note font-semibold uppercase tracking-[0.02em] text-brume first:mt-0">{t}</p>

  return (
    <>
      <div className="relative mx-auto h-[196px] w-[196px]">
        <span className="absolute inset-[6%] rounded-full" style={{ background: `radial-gradient(circle at 50% 35%, ${c.bg}, ${c.deep})` }} />
        <span className="absolute bottom-[5%] left-1/2 h-[7%] w-[46%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/15 blur-[3px]" />
        <button
          key={hop}
          onClick={() => {
            tap()
            setHop((n) => n + 1)
          }}
          className="absolute bottom-[6%] left-1/2 w-[50%] -translate-x-1/2"
          style={{ animation: hop ? 'rebond 0.7s var(--ressort)' : 'pousse 0.6s var(--ressort) both', transformOrigin: '50% 100%' }}
          aria-label="Mon personnage"
        >
          <Character look={look} mood="heureux" className="block h-auto w-full" />
        </button>
        <button
          onClick={() => {
            select()
            setAvatar(encodeLook(randomLook()))
            setHop((n) => n + 1)
          }}
          className="presse verre absolute bottom-[12%] right-[-4px] flex h-11 w-11 items-center justify-center rounded-full text-teinte"
          aria-label="Personnage au hasard"
          title="Au hasard"
        >
          <Dices size={20} strokeWidth={2.2} />
        </button>
      </div>

      <input className="champ mt-3 !bg-carte text-center font-rond text-titre3" placeholder="Ton prénom ou ton surnom" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />

      <div className="mt-4">
        <Segments
          value={tab}
          onChange={setTab}
          options={[
            { key: 'cheveux', label: 'Cheveux' },
            { key: 'visage', label: 'Visage' },
            { key: 'yeux', label: 'Yeux' },
            { key: 'details', label: 'Détails' },
            { key: 'tenue', label: 'Tenue' },
          ]}
        />
      </div>

      <div className="groupe mt-3 p-3.5">
        {tab === 'cheveux' && (
          <>
            {titre('Couleur')}
            {pastilles(HAIR_COLORS.map((h) => h.hex), look.c, (i) => set({ c: i }), 'Couleur de cheveux')}
            {titre('Coupe')}
            <div className="grid grid-cols-4 gap-y-2.5">{HAIRSTYLES.map((h, i) => choix(h.key, h.label, look.h === i, { h: i }))}</div>
          </>
        )}
        {tab === 'visage' && (
          <>
            {titre('Teint')}
            {pastilles(SKINS, look.s, (i) => set({ s: i }), 'Teint')}
            {titre('Grain de beauté')}
            <div className="grid grid-cols-4">{MOLES.map((m, i) => choix(`m${i}`, m, look.m === i, { m: i }))}</div>
            {titre('Petits plus')}
            <div className="flex flex-wrap gap-2">
              {bascule('Taches de rousseur', look.f === 1, { f: look.f ? 0 : 1 })}
              {bascule('Rouge à lèvres', look.l === 1, { l: look.l ? 0 : 1 })}
            </div>
          </>
        )}
        {tab === 'yeux' && (
          <>
            {titre('Couleur des yeux')}
            {pastilles(EYES, look.e, (i) => set({ e: i }), 'Couleur des yeux')}
            {titre('Lunettes')}
            <div className="grid grid-cols-4">{GLASSES.map((g, i) => choix(`g${i}`, g, look.g === i, { g: i }))}</div>
          </>
        )}
        {tab === 'details' && (
          <>
            {titre('Barbe')}
            <div className="grid grid-cols-4">{BEARDS.map((b, i) => choix(`b${i}`, b, look.b === i, { b: i }))}</div>
            {titre('Bijoux')}
            <div className="flex flex-wrap gap-2">{bascule('Boucles d’oreilles', look.o === 1, { o: look.o ? 0 : 1 })}</div>
          </>
        )}
        {tab === 'tenue' && (
          <>
            {titre('Haut')}
            {pastilles(TOPS, look.t, (i) => set({ t: i }), 'Couleur du haut')}
            {titre('Couleur de fond')}
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    select()
                    setColor(k)
                  }}
                  aria-pressed={color === k}
                  aria-label={`Fond ${k}`}
                  className="presse h-9 w-9 rounded-full"
                  style={{ background: `linear-gradient(160deg, ${COLORS[k].bg}, ${COLORS[k].ring})`, boxShadow: color === k ? `0 0 0 2.5px #FFFFFF, 0 0 0 4.5px ${COLORS[k].ring}` : undefined }}
                />
              ))}
            </div>
          </>
        )}
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
