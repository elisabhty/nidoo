import { Check, CheckCheck, ChevronRight, Minus, Plus, Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { choc, select, success, tap } from '../lib/haptic'
import { lookOf } from '../lib/look'
import { CATEGORIES, chercherRecettes, OCCASIONS, LES_RECETTES, lignesDe, occasionsAVenir, portionsFamille, recettesDe, recettesDuMoment, service, type Categorie, type Ligne, type Occasion, type Recette } from '../lib/recettes'
import { useHome } from '../lib/store'
import { Btn, Sheet } from './ui'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const saisonDe = (r: Recette) => (r.mois.length >= 12 ? '' : r.mois.length === 1 ? `en ${MOIS[r.mois[0] - 1]}` : `de ${MOIS[r.mois[0] - 1]} à ${MOIS[r.mois[r.mois.length - 1] - 1]}`)

/** La famille : combien de personnes (les bébés à part), et combien de parts d'adulte (les enfants mangent moins). */
export function usePortions() {
  const { state } = useHome()
  return useMemo(() => portionsFamille(state.members.map((m) => lookOf(m.avatar, m.user_id ?? m.id).a)), [state.members])
}

/** Une recette : pour combien de personnes (la famille d'office, modifiable), et tout ce qu'il faut acheter,
 *  aux bonnes quantités, dans les formats du magasin. Ce qu'on a sûrement (sel, huile, un peu de beurre) est à part. */
export function RecetteSheet({ recette, onClose, onAjouter, dejaDansLaListe }: { recette: Recette; onClose: () => void; onAjouter: (articles: { nom: string; qte: string }[]) => void; dejaDansLaListe: (nom: string) => boolean }) {
  const famille = usePortions()
  const [personnes, setPersonnes] = useState(famille.personnes)
  const ratio = famille.parts / famille.personnes
  const { lignes, plats } = lignesDe(recette, personnes, ratio)
  const [bascules, setBascules] = useState<Record<string, boolean>>({})
  const coche = (l: Ligne) => bascules[l.nom] ?? (l.coche && !dejaDansLaListe(l.nom))
  const achats = lignes.filter((l) => !l.placard)
  const placard = lignes.filter((l) => l.placard)
  const choisies = lignes.filter(coche)
  const enfants = ratio < 0.99
  // « Tout sélectionner » : les ronds se cochent l'un après l'autre, en vague (Elisa, 21 novembre)
  const toutCoche = lignes.every(coche)
  const [vague, setVague] = useState<{ n: number; on: boolean }>({ n: 0, on: true })
  const [touches, setTouches] = useState<string[]>([])
  const toutBasculer = () => {
    const on = !toutCoche
    if (on) success()
    else select()
    setBascules(Object.fromEntries(lignes.map((l) => [l.nom, on])))
    setVague((v) => ({ n: v.n + 1, on }))
  }

  const ligne = (l: Ligne, dernier: boolean, rang: number) => {
    const on = coche(l)
    const deja = dejaDansLaListe(l.nom)
    return (
      <button
        key={l.nom}
        type="button"
        aria-pressed={on}
        onClick={() => {
          // cocher : un petit toc ; décocher : un toc plus marqué
          if (on) choc()
          else tap()
          setBascules((b) => ({ ...b, [l.nom]: !on }))
          setTouches((t) => (t.includes(l.nom) ? t : [...t, l.nom]))
        }}
        className={`presse-ligne flex w-full items-center gap-3 pl-4 text-left transition-colors duration-300 ${on ? '' : 'bg-fond/40'}`}
      >
        <span
          key={`${vague.n}-${on}`}
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors ${on ? 'coche-saut bg-teinte text-white' : `${touches.includes(l.nom) || vague.n ? 'coche-retire' : ''} ring-2 ring-inset ring-[rgba(60,56,82,0.25)]`}`}
          style={{ animationDelay: vague.n && vague.on === on ? `${rang * 40}ms` : undefined }}
        >
          {on && <Check size={13} strokeWidth={3.2} />}
        </span>
        <span className={`flex min-h-[54px] min-w-0 flex-1 items-center gap-2 py-2 pr-4 ${dernier ? '' : 'border-b border-trait'}`}>
          <span className="min-w-0 flex-1">
            <span className={`block text-corps ${on ? 'text-encre' : 'text-brume'}`}>{l.nom}</span>
            {(l.besoin || deja) && (
              <span className="block text-note text-brume">
                {l.besoin && `Recette : ${l.besoin}`}
                {deja && `${l.besoin ? ' · ' : ''}déjà dans la liste`}
              </span>
            )}
          </span>
          {l.achat && <span key={l.achat} className={`anim-pop shrink-0 rounded-full px-2.5 py-1 text-note font-bold transition-colors ${on ? 'bg-teinte-doux text-teinte-fonce' : 'bg-remplissage text-brume'}`}>{l.achat}</span>}
        </span>
      </button>
    )
  }

  return (
    <Sheet
      title="Recette"
      tall
      onClose={onClose}
      footer={
        <Btn onClick={() => onAjouter(choisies.map((l) => ({ nom: l.nom, qte: l.qte })))} disabled={!choisies.length}>
          <Plus size={18} strokeWidth={2.8} /> {choisies.length ? <span>Ajouter <span key={choisies.length} className="anim-pop inline-block">{choisies.length}</span> article{choisies.length > 1 ? 's' : ''} à la liste</span> : 'Rien à ajouter'}
        </Btn>
      }
    >
      <div className="flex items-center gap-3.5 pt-1">
        <span className="anim-pop flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[22px] bg-peche-doux text-[38px]" aria-hidden="true">{recette.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-rond text-titre2 leading-tight">{recette.nom}</p>
          <p className="mt-0.5 text-note text-brume">
            {CATEGORIES.find((c) => c.key === recette.cat)?.label}
            {recette.occasions.length > 0 ? ` · ${recette.occasions.map((o) => { const x = OCCASIONS.find((y) => y.key === o)!; return `${x.emoji} ${x.label}` }).join(', ')}` : saisonDe(recette) && ` · ${saisonDe(recette)}`}
          </p>
        </div>
      </div>

      {/* pour combien : la famille d'office */}
      <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-carte p-3 pl-4 shadow-carte">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce">
          <Users size={18} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sous font-bold">Pour {personnes} personne{personnes > 1 ? 's' : ''}</p>
          <p className="text-note text-brume">
            {plats ? `${plats} plat${plats > 1 ? 's' : ''} de ${recette.parts} parts` : personnes === famille.personnes ? (enfants ? 'Toute la famille · les enfants ont de plus petites parts' : 'Toute la famille') : `La famille : ${famille.personnes}`}
          </p>
        </div>
        <span className="flex shrink-0 items-center rounded-full bg-remplissage p-0.5" role="group" aria-label="Nombre de personnes">
          <button type="button" onClick={() => (select(), setPersonnes((n) => Math.max(1, n - 1)))} disabled={personnes <= 1} aria-label="Une personne de moins" className="presse flex h-9 w-9 items-center justify-center rounded-full text-teinte-fonce disabled:opacity-30">
            <Minus size={16} strokeWidth={3} />
          </button>
          <span key={personnes} className="anim-pop min-w-[26px] text-center text-corps font-extrabold">{personnes}</span>
          <button type="button" onClick={() => (select(), setPersonnes((n) => Math.min(30, n + 1)))} aria-label="Une personne de plus" className="presse flex h-9 w-9 items-center justify-center rounded-full bg-carte text-teinte-fonce shadow-[0_1px_2px_rgba(29,26,43,0.08)]">
            <Plus size={16} strokeWidth={3} />
          </button>
        </span>
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between px-1">
        <p className="text-sous font-bold">À acheter</p>
        <button type="button" onClick={toutBasculer} className="presse flex min-h-9 items-center gap-1.5 rounded-full bg-teinte-doux px-3 text-note font-bold text-teinte-fonce">
          <span key={String(toutCoche)} className="anim-pop flex">{toutCoche ? <X size={14} strokeWidth={3} /> : <CheckCheck size={15} strokeWidth={2.8} />}</span>
          {toutCoche ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>
      <div className="groupe overflow-hidden shadow-carte">{achats.map((l, i) => ligne(l, i === achats.length - 1, i))}</div>
      {placard.length > 0 && (
        <>
          <p className="mb-1 mt-5 px-1 text-sous font-bold">Sûrement dans le placard</p>
          <p className="mb-2 px-1 text-note text-brume">Touche ce qui manque pour l’ajouter aussi.</p>
          <div className="groupe overflow-hidden shadow-carte">{placard.map((l, i) => ligne(l, i === placard.length - 1, achats.length + i))}</div>
        </>
      )}
      <p className="mt-3 px-1 text-mini text-pale">Quantités arrondies aux formats du magasin (paquets, pots, barquettes).</p>
    </Sheet>
  )
}

const dansTexte = (n: number | null) => (n === null ? '' : n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`)

/** Toutes les recettes : de saison, par occasion (Noël, Nouvel An, Épiphanie…), par genre, ou en cherchant. */
export function RecettesSheet({ onClose, onChoisir, occasion: occasionDepart }: { onClose: () => void; onChoisir: (r: Recette) => void; occasion?: Occasion }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Categorie | 'saison' | 'occasion'>(occasionDepart ? 'occasion' : 'saison')
  const occasions = useMemo(() => occasionsAVenir(), [])
  const [occasion, setOccasion] = useState<Occasion>(occasionDepart ?? occasions[0].key)
  const proche = occasions.find((o) => o.dans !== null && o.dans <= 45)
  const choisie = occasions.find((o) => o.key === occasion)!
  const menu = useMemo(() => recettesDe(occasion), [occasion])
  const liste = q.trim() ? chercherRecettes(q) : cat === 'saison' ? recettesDuMoment(new Date(), 10) : cat === 'occasion' ? menu : LES_RECETTES.filter((r) => r.cat === cat)
  const onglets: { key: Categorie | 'saison' | 'occasion'; label: string }[] = [{ key: 'saison', label: 'De saison' }, { key: 'occasion', label: 'Par occasion' }, ...CATEGORIES]
  const voirOccasion = (o: Occasion) => {
    select()
    setOccasion(o)
    setCat('occasion')
  }

  const ligne = (r: Recette, dernier: boolean) => (
    <button key={r.id} type="button" onClick={() => (select(), onChoisir(r))} className="presse-ligne flex w-full items-center gap-3 pl-3 text-left">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-peche-doux text-[24px]" aria-hidden="true">{r.emoji}</span>
      <span className={`flex min-h-[60px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 ${dernier ? '' : 'border-b border-trait'}`}>
        <span className="min-w-0 flex-1">
          <span className="block text-corps font-semibold">{r.nom}</span>
          <span className="block text-note text-brume">
            {r.ingredients.filter((x) => !x.placard).length} articles{r.parts ? ` · un plat de ${r.parts} parts` : ''}
            {cat !== 'occasion' && saisonDe(r) && ` · ${saisonDe(r)}`}
          </span>
        </span>
        <ChevronRight size={17} className="shrink-0 text-pale" />
      </span>
    </button>
  )
  // le menu d'une occasion, rangé comme un repas : entrées et apéros, plats, desserts
  const services = cat === 'occasion' && !q.trim() ? [...new Set(menu.map(service))].map((titre) => ({ titre, recettes: menu.filter((r) => service(r) === titre) })) : null

  return (
    <Sheet title="Recettes" tall onClose={onClose}>
      <label className="flex h-11 items-center gap-2 rounded-[14px] bg-carte px-3.5 shadow-carte">
        <Search size={17} className="shrink-0 text-brume" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Une recette ou un ingrédient" aria-label="Chercher une recette" enterKeyHint="search" autoCorrect="off" spellCheck={false} className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-brume" />
      </label>
      {!q.trim() && (
        <div className="no-bar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Genres de recettes">
          {onglets.map((o) => (
            <button key={o.key} type="button" aria-pressed={cat === o.key} onClick={() => (select(), setCat(o.key))} className={`presse choix-pop min-h-[38px] shrink-0 rounded-full px-3.5 text-note font-bold ${cat === o.key ? 'bg-teinte text-white' : 'bg-carte text-encre ring-1 ring-inset ring-trait'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* la fête qui approche : son menu, en un geste */}
      {!q.trim() && cat === 'saison' && proche && (
        <button type="button" onClick={() => voirOccasion(proche.key)} className="presse anim-entre mt-3 flex w-full items-center gap-3 rounded-[20px] bg-[#FFF5EF] p-3 pr-3.5 text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-carte text-[28px]" aria-hidden="true">{proche.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-corps font-bold text-encre">{proche.label} {dansTexte(proche.dans)}</span>
            <span className="block text-note text-peche-fonce">{recettesDe(proche.key).length} recettes pour le menu · entrées, plats, desserts</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-peche-fonce" />
        </button>
      )}

      {/* les occasions, de la plus proche à la plus lointaine */}
      {!q.trim() && cat === 'occasion' && (
        <>
          <div className="no-bar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Occasions">
            {occasions.map((o) => (
              <button key={o.key} type="button" aria-pressed={occasion === o.key} onClick={() => (select(), setOccasion(o.key))} className={`presse choix-pop flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[14px] pl-2 pr-3 text-note font-bold ${occasion === o.key ? 'bg-peche-doux text-encre ring-2 ring-inset ring-[#F3B79A]' : 'bg-carte text-encre ring-1 ring-inset ring-trait'}`}>
                <span className="text-[20px] leading-none" aria-hidden="true">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
          <p key={occasion} className="anim-entre mt-3 px-1 text-note text-brume">
            <span className="font-bold text-encre">{choisie.label}</span>
            {choisie.dans !== null && ` · ${dansTexte(choisie.dans)}`} · {menu.length} recettes
          </p>
        </>
      )}

      {services ? (
        services.map((g) => (
          <div key={`${occasion}-${g.titre}`} className="anim-entre">
            <p className="mb-1.5 mt-4 px-1 text-sous font-bold">{g.titre}</p>
            <div className="groupe overflow-hidden shadow-carte">{g.recettes.map((r, i) => ligne(r, i === g.recettes.length - 1))}</div>
          </div>
        ))
      ) : (
        <div className="groupe mt-3 overflow-hidden shadow-carte">
          {liste.map((r, i) => ligne(r, i === liste.length - 1))}
          {!liste.length && <p className="px-4 py-6 text-center text-sous text-brume">Aucune recette pour « {q} ».</p>}
        </div>
      )}
    </Sheet>
  )
}
