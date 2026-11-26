// « Nos lieux » (Elisa, 26 novembre ; « Nos adresses » au début) : la fiche pour en ajouter un ou le modifier. Un nom (École, Travail…),
// une adresse (cherchée dans la liste, déjà utilisée dans l'agenda, ma position ou celle d'un proche), la taille de la zone.
// En haut, le lieu lui-même (Elisa, 26 novembre : « améliore l'UI UX de cette page ») : son image et son nom, puis, dès que
// l'adresse est trouvée, la carte avec sa zone, qui suit la taille choisie.
import { Check, LocateFixed, MapPin, Radius, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as CarteML } from 'maplibre-gl'
import { trouverPoint, type Suggestion } from '../lib/adresses'
import { cercle, cle, ENDROITS_MAX, lieuComplet, memeAdresse, nomPris, nomPropre, nomsLibres, NOMS_COURANTS, RAYON, TAILLES } from '../lib/endroits'
import { chargerMapLibre, urlStyleCarte, zoomPourRayon } from '../lib/fondCarte'
import { select, success, tap } from '../lib/haptic'
import { lirePosition, messagePosition, POSITION_DEMO, libelle, ancienne } from '../lib/localisation'
import { useHome } from '../lib/store'
import type { Endroit, FamilyState, Member } from '../lib/types'
import { ChampLieu } from './champLieu'
import { PastilleEndroit } from './iconeEndroit'
import { Avatar, Btn, ChampRequis, CHAMP_REQUIS, confirmer, Sheet } from './ui'

type Point = { lat: number; lon: number; texte: string; de: string }

/** La fiche d'un lieu. `endroit` absent : un nouveau. `onFait` : le nom enregistré (null : retiré). */
export function EndroitSheet({ endroit, onClose, onFait }: { endroit?: Endroit; onClose: () => void; onFait?: (nom: string | null) => void }) {
  const { state, run, api, toast } = useHome()
  const fid = state.family.id
  const [nom, setNom] = useState(endroit?.nom ?? '')
  const [adresse, setAdresse] = useState(endroit?.adresse ?? '')
  // le point : celui de l'adresse choisie dans la liste, ou la position de quelqu'un (« de » : qui, ou « liste »)
  const [point, setPoint] = useState<Point | null>(endroit ? { lat: endroit.lat, lon: endroit.lon, texte: endroit.adresse ?? '', de: 'garde' } : null)
  const [rayon, setRayon] = useState(endroit?.rayon_m ?? RAYON)
  const [busy, setBusy] = useState(false)
  const [cherche, setCherche] = useState<string | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const nomId = useId()
  const champNom = useRef<HTMLInputElement>(null)

  const propre = nomPropre(nom)
  const pris = !!propre && nomPris(propre, state.endroits, endroit?.id)
  const doublon = pris ? state.endroits.find((e) => e.id !== endroit?.id && cle(e.nom) === cle(propre)) : undefined
  const libres = nomsLibres(state.endroits.filter((e) => e.id !== endroit?.id))
  // les lieux déjà écrits dans l'agenda (« 15 Rue André Lalande, 91000 Évry ») : souvent l'adresse qu'on veut nommer
  const lieuxConnus = useMemo(
    () => [...new Set([...state.events].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map((e) => e.lieu?.trim()).filter((x): x is string => !!x && !state.endroits.some((n) => cle(n.nom) === cle(x))))],
    [state.events, state.endroits],
  )
  // ceux qui partagent leur position : « là où est Papa » (moi d'abord)
  const gens = useMemo(() => {
    const parId = new Map(state.positions.map((p) => [p.member_id, p]))
    return state.members.filter((m) => m.id !== state.me.id && parId.has(m.id)).map((m) => ({ m, p: parId.get(m.id)! }))
  }, [state.positions, state.members, state.me.id])
  const pointValable = !!point && memeAdresse(point.texte, adresse)
  const de = pointValable ? point!.de : null

  const prendre = (p: Omit<Point, 'texte'>, texte: string) => {
    select()
    setPoint({ ...p, texte })
    setAdresse(texte)
    setIntrouvable(false)
  }
  const maPosition = async () => {
    if (cherche) return
    tap()
    setCherche('moi')
    try {
      const p = api.mode === 'local' ? POSITION_DEMO : await lirePosition()
      prendre({ lat: p.lat, lon: p.lon, de: 'moi' }, libelle({ lieu: p.lieu ?? null, ville: p.ville ?? null }))
    } catch (e) {
      toast(messagePosition(e), 'err')
    } finally {
      setCherche(null)
    }
  }

  const manque = !propre ? 'le nom' : pris ? 'un autre nom' : !adresse.trim() && !pointValable ? 'l’adresse' : null
  const enregistrer = async () => {
    if (busy || manque) return
    setBusy(true)
    let pt: { lat: number; lon: number } | null = pointValable ? point : null
    if (!pt) {
      setCherche('adresse')
      pt = await trouverPoint(adresse)
      setCherche(null)
    }
    if (!pt) {
      setBusy(false)
      setIntrouvable(true)
      return
    }
    const texte = adresse.trim() || null
    const ancien = endroit?.nom
    const lat = pt.lat
    const lon = pt.lon
    const provisoire: Endroit = { id: endroit?.id ?? `nouveau-${Date.now()}`, family_id: fid, nom: propre, adresse: texte, lat, lon, rayon_m: rayon, created_at: endroit?.created_at ?? new Date().toISOString() }
    const ok = await run(
      async (a) => {
        await a.enregistrerEndroit(fid, { id: endroit?.id, nom: propre, adresse: texte, lat, lon, rayon_m: rayon })
        // renommée : les événements qui avaient son ancien nom pour lieu prennent le nouveau
        if (ancien && cle(ancien) !== cle(propre)) {
          for (const e of state.events.filter((x) => x.lieu && cle(x.lieu) === cle(ancien))) await a.updateEvent(e.id, { lieu: propre })
        }
      },
      undefined,
      (st: FamilyState) => ({ ...st, endroits: endroit ? st.endroits.map((x) => (x.id === endroit.id ? provisoire : x)) : [...st.endroits, provisoire] }),
    )
    setBusy(false)
    if (!ok) return
    success()
    onFait?.(propre)
    onClose()
  }

  const retirer = async () => {
    if (!endroit) return
    const avecLui = state.events.filter((x) => x.lieu && cle(x.lieu) === cle(endroit.nom))
    if (!(await confirmer({
      title: `Retirer « ${endroit.nom} » ?`,
      message: state.endroitsPartages ? 'Il disparaît de « Nos lieux » pour toute la famille.' : 'Il disparaît de « Nos lieux » sur ce téléphone.',
      confirm: 'Retirer le lieu',
      destructive: true,
    }))) return
    const ok = await run(
      async (a) => {
        await a.supprimerEndroit(fid, endroit.id)
        // les événements qui y avaient lieu gardent l'adresse en entier : rien ne se perd
        const complet = lieuComplet(endroit.nom, [endroit])
        if (complet !== endroit.nom) for (const e of avecLui) await a.updateEvent(e.id, { lieu: complet.slice(0, 200) })
      },
      undefined,
      (st) => ({ ...st, endroits: st.endroits.filter((x) => x.id !== endroit.id) }),
    )
    if (!ok) return
    onFait?.(null)
    onClose()
  }

  const plein = !endroit && state.endroits.length >= ENDROITS_MAX
  const puce = (on: boolean) => `presse choix-pop flex shrink-0 items-center gap-1.5 rounded-full py-[7px] text-[14.5px] font-semibold transition-colors duration-200 ${on ? 'bg-teinte text-white' : 'bg-doux text-encre'}`

  return (
    <Sheet
      title={endroit ? 'Modifier le lieu' : 'Nouveau lieu'}
      tall
      cacherBasAuClavier
      onClose={() => !busy && onClose()}
      footer={
        <Btn onClick={() => void enregistrer()} disabled={busy || plein} manque={manque} onManque={() => (!propre || pris ? champNom.current?.focus() : document.querySelector<HTMLInputElement>('[aria-label="Adresse"]')?.focus())}>
          {cherche === 'adresse' ? 'Je cherche l’adresse…' : busy ? 'Enregistrement…' : endroit ? 'Enregistrer' : 'Ajouter le lieu'}
        </Btn>
      }
    >
      {/* le lieu lui-même : son image (elle suit le nom : un cartable pour l'école), et sur la carte dès que l'adresse
          est trouvée, avec sa zone */}
      <ApercuLieu nom={propre} point={pointValable ? point : null} rayon={rayon} />

      <ChampRequis id={nomId} className="mt-5" label="Nom" aide="Il remplacera l’adresse dans « Où sont mes proches ? » et dans l’agenda." erreur={doublon ? `Un de vos lieux s’appelle déjà « ${doublon.nom} ».` : null}>
        <input
          ref={champNom}
          id={nomId}
          aria-describedby={`${nomId}-aide`}
          aria-invalid={pris || undefined}
          className={CHAMP_REQUIS}
          placeholder="Ex. : École, Travail, Chez Mamie"
          maxLength={40}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          enterKeyHint="next"
          autoCapitalize="sentences"
        />
      </ChampRequis>
      {libres.length > 0 && (
        <div className="-mx-5 mt-2.5 flex gap-1.5 overflow-x-auto px-5 pb-1 no-bar" role="group" aria-label="Noms courants">
          {NOMS_COURANTS.filter((n) => libres.includes(n)).map((n) => {
            const on = cle(n) === cle(nom)
            return (
              <button key={n} type="button" aria-pressed={on} onClick={() => (select(), setNom(n))} className={`${puce(on)} px-3`}>
                {n}
              </button>
            )
          })}
        </div>
      )}

      {/* l'adresse : à taper (la liste propose), ou là où je suis, ou là où est un proche */}
      <section className="carte-evt mt-5 rounded-[20px] bg-carte p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-teinte-doux text-teinte"><MapPin size={17} strokeWidth={2.3} /></span>
          <h3 className="min-w-0 flex-1 text-corps font-bold">Adresse</h3>
          {de === 'liste' || de === 'garde' ? (
            <span key="ok" className="anim-pop flex items-center gap-1 text-note font-semibold text-vert-fonce"><Check size={14} strokeWidth={3} /> Trouvée</span>
          ) : null}
        </div>
        <ChampLieu
          value={adresse}
          onChange={(v) => {
            setAdresse(v)
            setIntrouvable(false)
          }}
          onChoisi={(s: Suggestion) => {
            if (s.lat != null && s.lon != null) setPoint({ lat: s.lat, lon: s.lon, texte: s.texte, de: 'liste' })
          }}
          placeholder="Une adresse, une école, un lieu…"
          recents={lieuxConnus}
          label="Adresse"
        />
        {introuvable && (
          <p role="alert" className="anim-entre mt-2 px-1 text-note font-semibold text-peche-fonce">
            Je ne trouve pas cette adresse. Choisis-la dans la liste en tapant, ou prends ta position juste en dessous.
          </p>
        )}

        {/* on y est : l'adresse d'un toucher */}
        <button
          type="button"
          onClick={() => void maPosition()}
          disabled={!!cherche}
          aria-pressed={de === 'moi'}
          className={`presse mt-2.5 flex min-h-11 w-full items-center gap-2.5 rounded-[14px] px-3 text-left text-sous font-semibold transition-colors duration-200 disabled:opacity-60 ${de === 'moi' ? 'bg-teinte-doux text-teinte-fonce' : 'text-teinte-fonce'}`}
        >
          {de === 'moi' ? <Check size={18} strokeWidth={3} className="shrink-0" /> : <LocateFixed size={18} strokeWidth={2.4} className={`shrink-0 ${cherche === 'moi' ? 'animate-pulse' : ''}`} />}
          <span className="min-w-0 flex-1">{cherche === 'moi' ? 'Je cherche ta position…' : de === 'moi' ? 'Là où tu es en ce moment' : 'Utiliser ma position actuelle'}</span>
        </button>
        {/* ou là où est un proche qui partage sa position (Papa à son bureau) */}
        {gens.length > 0 && (
          <>
            <p className="mb-2 mt-2.5 px-1 text-note font-semibold text-brume">Ou là où est…</p>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 no-bar">
              {gens.map(({ m, p }) => (
                <PuceProche key={m.id} m={m} on={de === m.id} pale={ancienne(p)} classe={puce(de === m.id)} onClick={() => prendre({ lat: p.lat, lon: p.lon, de: m.id }, libelle(p))} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* la taille de la zone : elle se voit sur la carte, en haut */}
      <section className="carte-evt mt-3 rounded-[20px] bg-carte p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-teinte-doux text-teinte"><Radius size={17} strokeWidth={2.3} /></span>
          <h3 className="min-w-0 flex-1 text-corps font-bold">Taille de la zone</h3>
          <span key={rayon} className="anim-entre text-note font-semibold text-teinte-fonce">{rayon} m autour</span>
        </div>
        <div className="mt-3 flex gap-1.5" role="group" aria-label="Taille de la zone">
          {TAILLES.map((t) => (
            <button key={t.rayon} type="button" aria-pressed={rayon === t.rayon} onClick={() => (select(), setRayon(t.rayon))} className={`${puce(rayon === t.rayon)} flex-1 justify-center px-2`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-note text-brume">Plus grande pour un campus ou une grande entreprise.</p>
      </section>

      {!state.endroitsPartages && (
        <p className="mt-3 px-1 text-note text-brume">Pour l’instant, vos lieux restent sur ce téléphone : les autres ne les voient pas encore.</p>
      )}
      {plein && <p className="mt-3 px-1 text-note font-semibold text-peche-fonce">Trente lieux au plus : retirez-en un d’abord.</p>}

      {endroit && (
        <button type="button" onClick={() => void retirer()} className="presse mx-auto mt-6 flex min-h-11 items-center gap-2 px-4 text-sous font-semibold text-rouge">
          <Trash2 size={17} strokeWidth={2.3} /> Retirer ce lieu
        </button>
      )}
    </Sheet>
  )
}

function PuceProche({ m, on, pale, classe, onClick }: { m: Member; on: boolean; pale: boolean; classe: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={`Là où est ${m.display_name}`} className={`${classe} py-1 pl-1 pr-3 ${pale && !on ? 'opacity-70' : ''}`}>
      <span className={`rounded-full ${on ? 'ring-2 ring-white' : ''}`}>
        <Avatar m={m} size={26} />
      </span>
      {m.display_name}
    </button>
  )
}

/** La hauteur de l'aperçu, en pixels (la carte et l'image avant elle : rien ne saute quand l'adresse arrive). */
const HAUT_APERCU = 172
const zoneDe = (p: { lat: number; lon: number }, rayon: number) => ({
  type: 'FeatureCollection' as const,
  features: [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [cercle(p, rayon)] } }],
})

/** Le lieu en haut de sa fiche. Sans adresse : son image, grande, et son nom. L'adresse trouvée : la carte, centrée sur
 *  lui, avec sa zone (le disque suit la taille choisie) ; son image et son nom au milieu, comme sur la carte de
 *  « Où sont mes proches ? ». La carte ne se touche pas : c'est un aperçu (MapLibre n'est chargé qu'à la première adresse). */
function ApercuLieu({ nom, point, rayon }: { nom: string; point: { lat: number; lon: number } | null; rayon: number }) {
  const boite = useRef<HTMLDivElement>(null)
  const carte = useRef<CarteML | null>(null)
  const [chargee, setChargee] = useState(false)
  // les dernières valeurs, pour la carte qui arrive après coup
  const vu = useRef({ point, rayon })
  vu.current = { point, rayon }
  const trouve = !!point

  useEffect(() => {
    if (!trouve || carte.current) return
    let fini = false
    void (async () => {
      try {
        const maplibre = await chargerMapLibre()
        const p = vu.current.point
        if (fini || !boite.current || !p) return
        const c = new maplibre.Map({
          container: boite.current,
          style: urlStyleCarte(),
          center: [p.lon, p.lat],
          zoom: zoomPourRayon(vu.current.rayon, p.lat, HAUT_APERCU),
          interactive: false,
          attributionControl: { compact: true },
        })
        c.on('error', () => undefined)
        c.once('load', () => {
          if (fini) return
          // les crédits sous leur « i » tout de suite : l'aperçu est petit
          boite.current?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
          try {
            const q = vu.current.point ?? p
            c.addSource('zone', { type: 'geojson', data: zoneDe(q, vu.current.rayon) })
            c.addLayer({ id: 'zone-fond', type: 'fill', source: 'zone', paint: { 'fill-color': '#7050D5', 'fill-opacity': 0.12 } })
            c.addLayer({ id: 'zone-bord', type: 'line', source: 'zone', paint: { 'line-color': '#7050D5', 'line-opacity': 0.55, 'line-width': 1.6 } })
          } catch {
            /* sans zone : l'image du lieu suffit */
          }
          setChargee(true)
        })
        carte.current = c
      } catch {
        /* pas de carte (hors ligne) : l'image et le nom restent */
      }
    })()
    return () => {
      fini = true
    }
  }, [trouve])
  useEffect(
    () => () => {
      carte.current?.remove()
      carte.current = null
    },
    [],
  )
  // une autre adresse, une autre taille : la carte y glisse, la zone suit
  useEffect(() => {
    const c = carte.current
    if (!c || !point) return
    c.easeTo({ center: [point.lon, point.lat], zoom: zoomPourRayon(rayon, point.lat, HAUT_APERCU), duration: 650 })
    ;(c.getSource('zone') as GeoJSONSource | undefined)?.setData(zoneDe(point, rayon))
  }, [point?.lat, point?.lon, rayon, chargee]) // eslint-disable-line react-hooks/exhaustive-deps

  const montre = trouve && chargee
  return (
    <div className="carte-apercu relative overflow-hidden rounded-[22px] bg-[#F4F0EA] ring-1 ring-inset ring-encre/[0.06]" style={{ height: HAUT_APERCU }}>
      {/* sans carte encore : un papier pointillé, comme une carte à venir */}
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(112, 80, 213, 0.16) 1.2px, transparent 1.4px)', backgroundSize: '15px 15px' }} aria-hidden="true" />
      <div ref={boite} className={`absolute inset-0 transition-opacity duration-500 ${montre ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      {trouve ? (
        // le lieu, au milieu de sa zone : son image et son nom
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="rounded-full bg-white p-[3px] shadow-[0_4px_14px_rgba(29,26,43,0.28)]">
            <PastilleEndroit nom={nom || 'autre'} size={38} vivante />
          </span>
          <span className="mt-1.5 max-w-[220px] truncate rounded-full bg-white/95 px-2.5 py-[3px] text-note font-bold text-encre shadow-[0_2px_8px_-1px_rgba(29,26,43,0.22)]">{nom || 'Nouveau lieu'}</span>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <PastilleEndroit nom={nom || 'autre'} size={60} vivante />
          <p className="mt-2 max-w-full truncate text-titre3 text-encre">{nom || 'Un lieu à nommer'}</p>
          <p className="text-note text-brume">Choisis son adresse pour le voir sur la carte</p>
        </div>
      )}
    </div>
  )
}
