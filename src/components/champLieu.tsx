import { Building2, Check, Clock, MapPin, Store, X } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { avecCodePostal, chercherAdresses, verifierAdresse, type Suggestion } from '../lib/adresses'
import { select, tap } from '../lib/haptic'

/** Le lieu d'un événement : en tapant, une liste d'adresses et de lieux (gratuite) ; champ vide, les lieux déjà utilisés
 *  par la famille. Un toucher sur une suggestion la met dans le champ. */
export const ChampLieu = memo(function ChampLieu({ value, onChange, placeholder, recents, autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder: string; recents: string[]; autoFocus?: boolean }) {
  const [focus, setFocus] = useState(false)
  const [choisi, setChoisi] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [cherche, setCherche] = useState(false)
  const champ = useRef<HTMLInputElement>(null)
  // ouvert depuis la fiche d'un événement : le clavier vient tout de suite (après l'arrivée du champ)
  useEffect(() => {
    if (!autoFocus) return
    const t = window.setTimeout(() => champ.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [autoFocus])

  useEffect(() => {
    const q = value.trim()
    if (!focus || choisi || q.length < 3) {
      setSuggestions([])
      setCherche(false)
      return
    }
    const ctrl = new AbortController()
    setCherche(true)
    const t = window.setTimeout(() => {
      chercherAdresses(q, ctrl.signal)
        .then((s) => {
          if (!ctrl.signal.aborted) setSuggestions(s)
        })
        .finally(() => !ctrl.signal.aborted && setCherche(false))
    }, 280)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [value, focus, choisi])

  // une adresse tapée sans code postal (Elisa, 21 novembre : « détecter les codes postaux, pour ne pas se tromper
  // avec la même adresse dans deux villes ») : en quittant le champ, on cherche sa ville. Une seule : le code postal
  // s'ajoute tout seul (on peut annuler) ; plusieurs : « Dans quelle ville ? »
  const [villes, setVilles] = useState<Suggestion[]>([])
  const [ajoutCp, setAjoutCp] = useState<{ avant: string; apres: string; ville: string } | null>(null)
  const verifie = useRef('')
  const tape = useRef(false) // seulement une adresse qu'on vient d'écrire (pas celle déjà enregistrée)
  useEffect(() => {
    const q = value.trim()
    if (focus || choisi || !tape.current || !q || verifie.current === q || ajoutCp?.apres === value) return
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      verifie.current = q
      void verifierAdresse(q, ctrl.signal).then((r) => {
        if (ctrl.signal.aborted || !r) return
        if (r.sure?.cp && r.sure.ville) {
          const apres = avecCodePostal(value, r.sure.cp, r.sure.ville)
          setAjoutCp({ avant: value, apres, ville: `${r.sure.cp} ${r.sure.ville}` })
          verifie.current = apres.trim()
          onChange(apres)
        } else if (r.choix.length > 1) setVilles(r.choix)
      })
    }, 350)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [focus, choisi, value]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focus) setVilles([])
  }, [focus])
  const choisirVille = (v: Suggestion) => {
    select()
    const apres = avecCodePostal(value, v.cp!, v.ville!)
    verifie.current = apres.trim()
    setVilles([])
    onChange(apres)
    cadre.current?.animate?.([{ boxShadow: '0 0 0 3px rgba(112, 80, 213, 0.4)' }, { boxShadow: '0 0 0 3px rgba(112, 80, 213, 0)' }], { duration: 900, easing: 'ease-out' })
  }

  const cadre = useRef<HTMLDivElement>(null)
  const prendre = (texte: string) => {
    select()
    onChange(texte)
    setChoisi(true)
    setSuggestions([])
    // le champ s'éclaire (sans être recréé : sur iPhone, le recréer pendant la saisie perdait le toucher)
    cadre.current?.animate?.([{ boxShadow: '0 0 0 3px rgba(112, 80, 213, 0.4)', transform: 'scale(1.015)' }, { boxShadow: '0 0 0 3px rgba(112, 80, 213, 0)', transform: 'none' }], { duration: 900, easing: 'ease-out' })
    champ.current?.blur()
  }
  // Toucher une adresse la met dans le champ (Elisa, 21 novembre : « quand on clique sur une adresse ça ne la met
  // pas ») : on la prend dès qu'on lève le doigt (un vrai toucher, pas un glissé), sans attendre le « clic » d'iOS,
  // qui se perdait quand le clavier se fermait. On peut toujours faire défiler la liste en glissant dessus.
  const garder = (e: React.PointerEvent) => e.preventDefault() // effacer garde le clavier
  const appui = useRef<{ x: number; y: number } | null>(null)
  const pris = useRef(0)
  const toucher = (texte: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      appui.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const a = appui.current
      appui.current = null
      if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 12) return
      pris.current = Date.now()
      prendre(texte)
    },
    onPointerCancel: () => {
      appui.current = null
    },
    // le clavier ou un lecteur d'écran : le clic seul (pas deux fois après un toucher)
    onClick: () => {
      if (Date.now() - pris.current > 700) prendre(texte)
    },
  })
  const deja = recents.filter((r) => r.trim().toLowerCase() !== value.trim().toLowerCase()).slice(0, 6)
  const Icone = ({ s }: { s: Suggestion }) => (s.genre === 'lieu' ? <Store size={17} strokeWidth={2.3} /> : s.genre === 'ville' ? <Building2 size={17} strokeWidth={2.3} /> : <MapPin size={17} strokeWidth={2.3} />)

  return (
    <div>
      <div ref={cadre} className="flex items-center gap-2.5 rounded-[14px] bg-doux pl-3.5 pr-1 transition-shadow focus-within:shadow-[0_0_0_2px_rgba(112,80,213,0.35)]">
        <MapPin size={18} className="shrink-0 text-teinte" />
        <input
          ref={champ}
          className="h-12 min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-pale"
          placeholder={placeholder}
          maxLength={200}
          value={value}
          onChange={(e) => {
            setChoisi(false)
            setAjoutCp(null)
            tape.current = true
            onChange(e.target.value)
          }}
          onFocus={() => setFocus(true)}
          // la liste reste un instant après avoir quitté le champ : le toucher en cours peut encore la prendre
          onBlur={() => window.setTimeout(() => document.activeElement !== champ.current && setFocus(false), 250)}
          enterKeyHint="done"
          autoComplete="street-address"
          aria-label="Lieu"
          aria-autocomplete="list"
        />
        {value && (
          <button type="button" onPointerDown={garder} onClick={() => (tap(), onChange(''), setChoisi(false), champ.current?.focus())} aria-label="Effacer le lieu" className="presse anim-pop flex h-9 w-9 shrink-0 items-center justify-center">
            <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[rgba(60,56,82,0.32)] text-white"><X size={11} strokeWidth={3.4} /></span>
          </button>
        )}
      </div>

      {/* champ vide : les lieux déjà utilisés par la famille */}
      {focus && !value.trim() && deja.length > 0 && (
        <div className="anim-entre mt-2">
          <p className="mb-1.5 flex items-center gap-1 px-1 text-note font-semibold text-brume"><Clock size={13} /> Déjà utilisés</p>
          <div className="flex flex-wrap gap-1.5">
            {deja.map((r, i) => (
              <button key={r} type="button" {...toucher(r)} className="presse anim-pop max-w-full truncate rounded-full bg-doux px-3 py-2 text-note font-semibold text-encre" style={{ animationDelay: `${i * 35}ms` }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* le code postal trouvé tout seul */}
      {!focus && ajoutCp && ajoutCp.apres === value && (
        <p className="anim-entre mt-1.5 flex items-center gap-1.5 px-1 text-note text-brume">
          <Check size={14} strokeWidth={2.8} className="text-vert" />
          <span className="min-w-0 flex-1 truncate">Code postal ajouté : <span className="font-semibold text-encre">{ajoutCp.ville}</span></span>
          <button type="button" onClick={() => { tap(); verifie.current = ajoutCp.avant.trim(); onChange(ajoutCp.avant); setAjoutCp(null) }} className="presse min-h-8 shrink-0 px-1 font-semibold text-teinte">Annuler</button>
        </p>
      )}
      {/* la même adresse dans plusieurs villes : laquelle ? */}
      {!focus && villes.length > 1 && (
        <div className="anim-entre mt-2 rounded-[14px] bg-peche-doux p-2.5" role="group" aria-label="Dans quelle ville ?">
          <p className="mb-1.5 px-1 text-note font-semibold text-peche-fonce">Cette adresse existe dans plusieurs villes : laquelle ?</p>
          <div className="flex flex-col gap-1.5">
            {villes.map((v, i) => (
              <button key={`${v.cp}${v.ville}`} type="button" onClick={() => choisirVille(v)} className="presse ligne-arrive-pop flex min-h-11 items-center gap-2.5 rounded-[12px] bg-carte px-3 text-left" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="shrink-0 rounded-full bg-[#E3F0FF] px-2 py-0.5 text-note font-bold tabular-nums text-[#2F6FD6]">{v.cp}</span>
                <span className="min-w-0 flex-1 truncate text-sous font-semibold text-encre">{v.detail || v.ville}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* en tapant : adresses et lieux */}
      {focus && !choisi && value.trim().length >= 3 && (cherche || suggestions.length > 0) && (
        <div className="anim-entre mt-2 overflow-hidden rounded-[14px] bg-carte shadow-[0_0_0_1px_rgba(60,56,82,0.08),0_8px_20px_-12px_rgba(29,26,43,0.18)]" role="listbox" aria-label="Suggestions de lieux">
          {suggestions.map((s, i) => (
            <button
              key={s.texte}
              type="button"
              role="option"
              aria-selected={false}
              {...toucher(s.texte)}
              className="presse-ligne ligne-arrive-pop flex w-full items-center gap-3 pl-4 text-left"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.genre === 'lieu' ? 'bg-peche-doux text-peche-fonce' : 'bg-[#E3F0FF] text-[#2F6FD6]'}`}>
                <Icone s={s} />
              </span>
              <span className={`min-w-0 flex-1 py-2.5 pr-4 ${i < suggestions.length - 1 ? 'border-b border-trait' : ''}`}>
                <span className="block truncate text-corps">{s.titre}</span>
                {(s.detail || s.cp) && (
                  <span className="flex items-center gap-1.5 text-note text-brume">
                    {s.cp && s.genre !== 'ville' && <span className="shrink-0 rounded-full bg-[#E3F0FF] px-1.5 text-mini font-bold tabular-nums leading-[18px] text-[#2F6FD6]">{s.cp}</span>}
                    <span className="min-w-0 truncate">{s.genre === 'lieu' && s.cp ? s.detail.replace(`${s.cp} `, '') : s.detail}</span>
                  </span>
                )}
              </span>
            </button>
          ))}
          {cherche && !suggestions.length && (
            <p className="flex items-center gap-2 px-4 py-3 text-note text-brume">
              <span className="points-attente" aria-hidden="true"><i /><i /><i /></span> Je cherche…
            </p>
          )}
          {suggestions.length > 0 && <p className="border-t border-trait px-4 py-1.5 text-mini text-pale">Adresses : Géoplateforme (IGN) · Lieux : © OpenStreetMap</p>}
        </div>
      )}
    </div>
  )
})
