// Les réactions du fil, à l'écran : leur image, la planche de toutes les réactions, et qui a réagi.
import { useMemo, useState } from 'react'
import { FEUTRINE, PANDA, RAPIDES, CLAVIER, premierEmoji, reaction, recentes, type Reac } from '../lib/reactions'
import { select, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import { StickerImg } from './stickers'
import { Art, Avatar, Btn, Sheet } from './ui'

/** Une réaction : une image du panda, un émoji en feutrine, ou un émoji du clavier. */
export function ReactionImg({ r, size }: { r: Reac; size: number }) {
  if (r.art) return <Art name={r.art} size={size} />
  if (r.sticker) return <StickerImg cle={r.sticker} className="block shrink-0 object-contain" style={{ width: size, height: size }} />
  return (
    <span className="flex shrink-0 select-none items-center justify-center leading-none" style={{ width: size, height: size, fontSize: Math.round(size * 0.84) }} aria-hidden="true">
      {r.emoji}
    </span>
  )
}

function Case({ r, ma, onChoix, taille = 40 }: { r: Reac; ma?: string; onChoix: (cle: string) => void; taille?: number }) {
  const choisie = ma === r.cle
  return (
    <button
      onClick={() => onChoix(r.cle)}
      aria-label={r.emoji ? `Réagir avec ${r.emoji}` : r.label}
      aria-pressed={choisie}
      className={`reaction-case flex aspect-square w-full items-center justify-center rounded-[16px] transition-colors ${choisie ? 'bg-teinte-doux ring-2 ring-teinte/50' : ''}`}
    >
      <ReactionImg r={r} size={taille} />
    </button>
  )
}

function Partie({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="mb-1.5 px-1 text-note font-semibold text-brume">{titre}</h3>
      {children}
    </section>
  )
}

/** Toutes les réactions : les dernières utilisées, le panda, la feutrine, les émojis du clavier, et n'importe quel autre. */
export function ToutesReactions({ ma, onChoix, onClose }: { ma?: string; onChoix: (cle: string | null) => void; onClose: () => void }) {
  const [autre, setAutre] = useState('')
  const recents = useMemo(() => recentes().map((c) => reaction(c)!).filter(Boolean), [])
  const tape = premierEmoji(autre)
  const choisir = (cle: string) => {
    select()
    onChoix(ma === cle ? null : cle)
  }
  return (
    <Sheet
      title="Réagir"
      tall
      onClose={onClose}
      footer={
        ma ? (
          <Btn kind="gris" onClick={() => { tap(); onChoix(null) }}>
            Retirer ma réaction
          </Btn>
        ) : undefined
      }
    >
      {recents.length > 0 && (
        <Partie titre="Récentes">
          <div className="grid grid-cols-6 gap-1">{recents.slice(0, 6).map((r) => <Case key={r.cle} r={r} ma={ma} onChoix={choisir} />)}</div>
        </Partie>
      )}
      <Partie titre="Le panda">
        <div className="grid grid-cols-6 gap-1">{[...RAPIDES, ...PANDA].map((r) => <Case key={r.cle} r={r} ma={ma} onChoix={choisir} />)}</div>
      </Partie>
      <Partie titre="En feutrine">
        <div className="grid grid-cols-6 gap-1">{FEUTRINE.map((r) => <Case key={r.cle} r={r} ma={ma} onChoix={choisir} />)}</div>
      </Partie>
      <Partie titre="Émojis">
        {/* n'importe quel autre : le clavier des émojis de l'iPhone */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (tape) choisir(tape)
          }}
        >
          <input
            value={autre}
            onChange={(e) => setAutre(e.target.value.slice(0, 32))}
            placeholder="Un autre émoji 🙂"
            aria-label="Un autre émoji"
            enterKeyHint="done"
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-full bg-carte px-4 text-corps shadow-carte outline-none placeholder:text-brume focus:ring-2 focus:ring-teinte/40"
          />
          <button type="submit" disabled={!tape} className="presse ios-primary btn-desactive flex h-11 shrink-0 items-center gap-1.5 rounded-full pl-3 pr-4 text-sous font-bold text-white">
            {tape && <span className="text-[20px] leading-none">{tape}</span>}
            Réagir
          </button>
        </form>
        <p className="mt-1.5 px-1 text-note text-brume">{autre.trim() && !tape ? 'Seulement un émoji.' : 'Touche 🌐 ou 🙂 sur le clavier pour trouver tous les émojis.'}</p>
        <div className="mt-3 grid grid-cols-8 gap-0.5">{CLAVIER.map((e) => <Case key={e} r={reaction(e)!} ma={ma} onChoix={choisir} taille={30} />)}</div>
      </Partie>
    </Sheet>
  )
}

/** Qui a réagi, et comment (en touchant les réactions sous une publication). */
export function QuiAReagi({ momentId, onClose }: { momentId: string; onClose: () => void }) {
  const { state } = useHome()
  const { me, members, reactions } = state
  const toutes = reactions
    .filter((r) => r.moment_id === momentId && reaction(r.emoji))
    .map((r) => ({ r: reaction(r.emoji)!, m: members.find((x) => x.id === r.member_id) }))
    .filter((x) => x.m)
    .sort((a, b) => (a.m!.id === me.id ? -1 : b.m!.id === me.id ? 1 : 0))
  const sortes = [...new Map(toutes.map((x) => [x.r.cle, x.r])).values()]
  const [filtre, setFiltre] = useState<string | null>(null)
  const vues = filtre ? toutes.filter((x) => x.r.cle === filtre) : toutes
  return (
    <Sheet title="Réactions" onClose={onClose}>
      {sortes.length > 1 && (
        <div className="no-bar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Trier les réactions">
          <button onClick={() => { select(); setFiltre(null) }} aria-pressed={!filtre} className={`presse flex h-10 shrink-0 items-center rounded-full px-3.5 text-note font-bold ${!filtre ? 'bg-teinte text-white' : 'bg-carte text-encre shadow-carte'}`}>
            Toutes · {toutes.length}
          </button>
          {sortes.map((r) => (
            <button key={r.cle} onClick={() => { select(); setFiltre(r.cle) }} aria-pressed={filtre === r.cle} aria-label={`${r.emoji ?? r.label} : ${toutes.filter((x) => x.r.cle === r.cle).length}`} className={`presse flex h-10 shrink-0 items-center gap-1 rounded-full pl-2 pr-3 text-note font-bold ${filtre === r.cle ? 'bg-teinte text-white' : 'bg-carte text-encre shadow-carte'}`}>
              <ReactionImg r={r} size={24} />
              {toutes.filter((x) => x.r.cle === r.cle).length}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-[20px] bg-carte shadow-carte">
        {vues.map(({ r, m }, i) => (
          <div key={m!.id} className={`flex min-h-[58px] items-center gap-3 px-4 ${i ? 'border-t border-trait' : ''}`}>
            <Avatar m={m!} size={38} />
            <span className="min-w-0 flex-1 truncate text-corps font-semibold">{m!.id === me.id ? 'Toi' : m!.display_name}</span>
            <span className="flex items-center gap-1.5 text-note text-brume">
              {!r.emoji && <span className="max-w-[110px] truncate">{r.label}</span>}
              <ReactionImg r={r} size={32} />
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
