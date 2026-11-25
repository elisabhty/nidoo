// « Où est la famille » (Elisa, 21 novembre) : la carte avec chacun là où il est, s'il a choisi de partager sa position,
// la liste (où, depuis quand, à quelle distance, la batterie presque vide), et mon interrupteur pour partager ou arrêter.
// La carte : MapLibre (libre) avec les fonds d'OpenFreeMap (gratuits, sans clé, données OpenStreetMap), chargée à la demande.
import { BatteryLow, ChevronRight, LocateFixed, MapPin, Navigation, RefreshCw, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Map as CarteML } from 'maplibre-gl'
import { select, tap } from '../lib/haptic'
import { ancienne, autorisation, cadre, distance, ilYA, libelle, lirePosition, messagePosition, suivre, texteDistance, type Autorisation, type PositionLue } from '../lib/localisation'
import { NATIF_IOS } from '../lib/pont'
import { useHome } from '../lib/store'
import type { Member, Position } from '../lib/types'
import { Avatar, Btn, Page, Switch } from './ui'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
/** De la place en haut pour les têtes (le repère est accroché par sa pointe, en bas). */
const MARGES = { top: 84, bottom: 28, left: 44, right: 44 }
/** En démo, rien ne quitte l'appareil : une position d'exemple, à Annecy comme le reste de la famille. */
const DEMO: PositionLue = { lat: 45.9029, lon: 6.1269, precision: 12, lieu: 'Place de l’Hôtel de Ville', ville: 'Annecy', batterie: 71 }

type Point = { m: Member; p: Position }

/** Les proches qui ont un téléphone, avec leur position s'ils la partagent ; moi en premier. */
function useFamillePositions() {
  const { state } = useHome()
  return useMemo(() => {
    const parId = new Map(state.positions.map((p) => [p.member_id, p]))
    const gens = state.members.filter((m) => m.user_id).sort((a, b) => (a.id === state.me.id ? -1 : b.id === state.me.id ? 1 : 0))
    const points: Point[] = gens.flatMap((m) => (parId.has(m.id) ? [{ m, p: parId.get(m.id)! }] : []))
    return { gens, points, parId, moi: parId.get(state.me.id) ?? null }
  }, [state.positions, state.members, state.me.id])
}

/** Partager (ou remettre à jour) ma position : lue sur le téléphone, puis envoyée à la maison. */
function usePartager() {
  const { api, run, state, toast } = useHome()
  const [occupe, setOccupe] = useState(false)
  const partager = async (premiereFois: boolean) => {
    if (occupe) return false
    setOccupe(true)
    try {
      const p = api.mode === 'local' ? DEMO : await lirePosition()
      const ok = await run((a) => a.partagerPosition(state.family.id, p))
      // l'iPhone suit ensuite les déplacements, même appli fermée (il demande « Toujours » la première fois)
      if (ok && premiereFois) await suivre(true)
      return ok
    } catch (e) {
      toast(messagePosition(e), 'err')
      return false
    } finally {
      setOccupe(false)
    }
  }
  const arreter = async () => {
    select()
    const ok = await run((a) => a.arreterPosition(state.family.id))
    if (ok) await suivre(false)
  }
  return { partager, arreter, occupe }
}

/** L'aperçu dans « Mes proches » : qui est où, en un coup d'œil ; touché, la carte s'ouvre. */
export function OuEstApercu({ onOuvrir }: { onOuvrir: () => void }) {
  const { state } = useHome()
  const { points, moi } = useFamillePositions()
  const autres = points.filter((x) => x.m.id !== state.me.id).slice(0, 3)
  useReprendreSuivi(!!moi)
  return (
    <button onClick={() => (tap(), onOuvrir())} className="presse groupe mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 p-3.5 text-left shadow-carte">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#E3F1FD] text-[#2F7FD0]">
        <MapPin size={22} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-corps font-semibold">Où est la famille</span>
        <span className="block truncate text-note text-brume">
          {autres.length
            ? autres.map((x) => `${x.m.display_name} · ${x.p.ville ?? libelle(x.p)}`).join('  ·  ')
            : moi
              ? 'Ta position est partagée. Les autres peuvent partager la leur aussi.'
              : 'Voir où chacun se trouve, s’il l’accepte.'}
        </span>
      </span>
      {autres.length > 0 && (
        <span className="flex shrink-0 -space-x-2.5">
          {autres.map((x) => (
            <span key={x.m.id} className="rounded-full ring-2 ring-carte">
              <Avatar m={x.m} size={30} />
            </span>
          ))}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-pale" />
    </button>
  )
}

/** Dans l'appli iPhone : si je partage ma position ici, le suivi en arrière-plan est bien en route (une fois par session). */
let suiviRepris = false
function useReprendreSuivi(jePartage: boolean) {
  useEffect(() => {
    if (!NATIF_IOS || !jePartage || suiviRepris) return
    suiviRepris = true
    void suivre(true)
  }, [jePartage])
}

export function OuEstPage({ onClose }: { onClose: () => void }) {
  const { state, api } = useHome()
  const { gens, points, parId, moi } = useFamillePositions()
  const { partager, arreter, occupe } = usePartager()
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null)
  const [auto, setAuto] = useState<Autorisation | null>(null)
  const maintenant = Date.now()
  useReprendreSuivi(!!moi)

  useEffect(() => {
    if (api.mode === 'local') return
    void autorisation().then(setAuto)
  }, [api.mode, moi?.updated_at])

  // sur le web (pas de suivi en arrière-plan) : ma position se remet à jour en ouvrant la carte, si elle a plus de 5 min
  useEffect(() => {
    if (NATIF_IOS || api.mode === 'local' || !moi) return
    if (maintenant - new Date(moi.updated_at).getTime() < 5 * 60000) return
    void autorisation().then((a) => (a === 'active' || a === 'toujours') && partager(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ce que fait vraiment le suivi : « même appli fermée » seulement si l'iPhone l'autorise (« Toujours »)
  const suivi = !NATIF_IOS
    ? 'Elle change quand tu ouvres la carte'
    : auto === 'toujours'
      ? 'Suivi actif, même appli fermée'
      : auto === 'active'
        ? 'Suivi quand l’appli est ouverte'
        : 'Suivi actif'
  const versDe = (p: Position) => (NATIF_IOS ? `maps://?daddr=${p.lat},${p.lon}` : `https://maps.apple.com/?daddr=${p.lat},${p.lon}`)

  return (
    <Page title="Où est la famille" onClose={onClose}>
      <p className="-mt-1 px-5 pb-3 text-sous text-brume">Chacun choisit de partager sa position, et peut arrêter quand il veut. Seule la dernière est gardée.</p>
      {/* le cadre de la carte (Elisa, 25 novembre : « améliore le cadre ») : un passe-partout blanc comme les autres
          cartes de la page, un liseré, et le bouton pour revenir sur soi */}
      <div className="mx-4 rounded-[26px] bg-carte p-1.5 shadow-carte">
        <div className="relative overflow-hidden rounded-[20px]">
          <CarteFamille points={points} moi={state.me.id} focus={focus} hauteur={300} />
          <span className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-encre/[0.06]" aria-hidden="true" />
          {moi && (
            <button
              onClick={() => (select(), setFocus((f) => ({ id: state.me.id, n: (f?.n ?? 0) + 1 })))}
              aria-label="Revenir sur ma position"
              className="presse verre absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full text-teinte-fonce"
            >
              <LocateFixed size={19} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>

      {/* ma position */}
      <div className="groupe mx-4 mt-4 shadow-carte">
        {moi ? (
          <>
            <div className="flex items-center gap-3 p-3.5">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E3F1FD] text-[#2F7FD0]">
                <LocateFixed size={21} strokeWidth={2.4} />
                {/* le point vert : ma position est à jour (gris au-delà de 12 h) */}
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-carte ${ancienne(moi, maintenant) ? 'bg-pale' : 'bg-[#34C759]'}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-corps font-semibold">Je partage ma position</p>
                <p className="truncate text-note text-brume">{libelle(moi)}</p>
              </div>
              <Switch on label="Partager ma position" onChange={() => void arreter()} />
            </div>
            <div className="flex items-center gap-3 border-t border-trait py-2.5 pl-3.5 pr-3">
              <div className="min-w-0 flex-1">
                <p className="text-note font-semibold text-encre">Mise à jour {ilYA(moi.updated_at, maintenant)}</p>
                <p className="text-mini text-brume">{suivi}</p>
              </div>
              <button onClick={() => (tap(), void partager(false))} disabled={occupe} className="presse flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-teinte-doux px-3.5 text-note font-bold text-teinte-fonce disabled:opacity-50">
                <RefreshCw size={14} strokeWidth={2.8} className={occupe ? 'animate-spin' : ''} /> Actualiser
              </button>
            </div>
            {NATIF_IOS && auto === 'active' && (
              <a href="app-settings:" onClick={() => tap()} className="presse flex items-center gap-3 border-t border-trait bg-peche-doux/45 py-3 pl-3.5 pr-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-peche-doux text-peche-fonce">
                  <Settings size={18} strokeWidth={2.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sous font-semibold text-encre">Suivre aussi appli fermée</span>
                  <span className="block text-note text-brume">Réglages › Position › Toujours</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-pale" />
              </a>
            )}
          </>
        ) : (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E3F1FD] text-[#2F7FD0]">
                <LocateFixed size={21} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-corps font-semibold">Partager ma position</p>
                <p className="mt-0.5 text-sous text-brume">
                  Ta famille te voit sur la carte{NATIF_IOS ? ', et ta position suit quand tu bouges, même appli fermée' : ''}. Tu peux arrêter quand tu veux.
                </p>
              </div>
            </div>
            {auto === 'refusee' && (
              <p className="mt-2 text-note font-semibold text-peche-fonce">
                {NATIF_IOS ? (
                  <a href="app-settings:" className="underline">NIDOO n’a pas accès à ta position : ouvre les Réglages</a>
                ) : (
                  'Ton navigateur refuse de donner ta position.'
                )}
              </p>
            )}
            <Btn className="mt-3" onClick={() => void partager(true)} disabled={occupe}>
              <MapPin size={18} strokeWidth={2.4} /> {occupe ? 'Je cherche ta position…' : 'Partager ma position'}
            </Btn>
          </div>
        )}
      </div>

      {/* la famille */}
      <p className="entete mt-6">La famille</p>
      <div className="groupe mx-4 shadow-carte">
        {gens.filter((m) => m.id !== state.me.id).map((m, i, t) => {
          const p = parId.get(m.id)
          const loin = p && moi ? texteDistance(distance(p, moi)) : null
          const dernier = i === t.length - 1
          return (
            <div key={m.id} className="flex items-center gap-3 pl-3.5">
              <button
                onClick={() => p && (select(), setFocus((f) => ({ id: m.id, n: (f?.n ?? 0) + 1 })))}
                disabled={!p}
                className={`presse-ligne flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left ${p ? '' : 'opacity-55'}`}
                aria-label={p ? `Voir ${m.display_name} sur la carte` : `${m.display_name} ne partage pas sa position`}
              >
                <Avatar m={m} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-corps font-semibold">{m.display_name}</span>
                  {p ? (
                    <>
                      <span className={`block truncate text-note ${ancienne(p, maintenant) ? 'text-brume' : 'text-encre'}`}>{libelle(p)}</span>
                      <span className="flex items-center gap-1.5 text-mini text-brume">
                        {ilYA(p.updated_at, maintenant)}
                        {loin && <> · {loin}</>}
                        {p.batterie != null && p.batterie <= 20 && (
                          <span className="flex items-center gap-0.5 font-semibold text-rouge">
                            · <BatteryLow size={13} strokeWidth={2.4} /> {p.batterie} %
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="block text-note text-brume">Ne partage pas sa position</span>
                  )}
                </span>
              </button>
              <span className={`flex items-center self-stretch pr-3.5 ${dernier ? '' : 'border-b border-trait'}`}>
                {p && (
                  <a href={versDe(p)} target="_blank" rel="noreferrer" onClick={() => tap()} aria-label={`Itinéraire vers ${m.display_name}`} className="presse flex h-9 w-9 items-center justify-center rounded-full bg-[#E3F1FD] text-[#2F7FD0]">
                    <Navigation size={16} strokeWidth={2.6} />
                  </a>
                )}
              </span>
            </div>
          )
        })}
        {gens.length <= 1 && <p className="p-4 text-sous text-brume">Invite tes proches : quand ils partageront leur position, ils apparaîtront ici.</p>}
      </div>
      <p className="mt-2 px-5 text-mini text-pale">Carte : © OpenStreetMap · OpenFreeMap. Les positions ne sont visibles que par la famille.</p>
    </Page>
  )
}

/**
 * Le repère d'un proche sur la carte : une goutte d'un seul tenant (le rond et sa pointe dans le même tracé), la tête
 * dedans. Avant, c'était un rond et un petit carré tourné posé dessous : on voyait le raccord (Elisa, 25 novembre :
 * « le rond autour de la personne, ça fait bizarre, c'est mal fait »). Le mien est violet avec un filet blanc.
 * 50 × 58 : la pointe, en bas au milieu, est exactement sur la position (le repère est accroché par le bas).
 */
function Repere({ m, moi, pale }: { m: Member; moi: boolean; pale: boolean }) {
  return (
    <div className={`relative h-[58px] w-[50px] ${pale ? 'opacity-60' : ''}`}>
      <svg viewBox="0 0 50 58" className="absolute inset-0 h-full w-full overflow-visible" style={{ filter: 'drop-shadow(0 3px 5px rgba(29,26,43,0.3))' }} aria-hidden="true">
        <path
          d="M25 57.2 Q22.2 50.6 16.45 48.49 A25 25 0 1 1 33.55 48.49 Q27.8 50.6 25 57.2 Z"
          className={moi ? 'fill-teinte stroke-teinte' : 'fill-white stroke-white'}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {/* en flex et à sa taille : la tête est « inline-block », une boîte ordinaire lui ajouterait quelques pixels dessous */}
      <span className={`absolute left-1 top-1 flex h-[42px] w-[42px] rounded-full ${moi ? 'ring-[1.5px] ring-white' : ''}`}>
        <Avatar m={m} size={42} />
      </span>
    </div>
  )
}

/** La carte : chacun avec sa tête, tout le monde dans le cadre ; touché dans la liste, on va vers lui. */
export function CarteFamille({ points, moi, focus, hauteur }: { points: Point[]; moi: string; focus: { id: string; n: number } | null; hauteur: number }) {
  const boite = useRef<HTMLDivElement>(null)
  const carte = useRef<CarteML | null>(null)
  const [marques, setMarques] = useState<Record<string, HTMLElement>>({})
  const [prete, setPrete] = useState(false)
  const [panne, setPanne] = useState(false)
  const cle = points.map((x) => `${x.m.id}:${x.p.lat},${x.p.lon}`).join('|')

  // la carte, une seule fois (la bibliothèque n'est chargée qu'ici)
  useEffect(() => {
    let fini = false
    void (async () => {
      try {
        const [maplibre, travailleur] = await Promise.all([
          import('maplibre-gl'),
          // le travailleur, rangé à côté par Vite (sinon MapLibre le cherche là où il n'est pas)
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ])
        if (fini || !boite.current) return
        maplibre.setWorkerUrl(new URL(travailleur.default, window.location.href).href)
        const c = cadre(points.map((x) => x.p))
        const nouvelle = new maplibre.Map({
          container: boite.current,
          style: STYLE,
          ...(c ? { bounds: c, fitBoundsOptions: { padding: MARGES, maxZoom: 15 } } : { center: [2.4, 46.6], zoom: 4.6 }),
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        })
        nouvelle.touchZoomRotate.disableRotation()
        // un fond qui ne se charge pas (hors ligne) : la carte reste, sans planter
        nouvelle.on('error', () => undefined)
        // pas de carte au bout de 12 s (hors ligne, travailleur refusé) : on le dit, la liste reste là
        const t = window.setTimeout(() => !fini && setPanne(true), 12000)
        nouvelle.once('load', () => {
          window.clearTimeout(t)
          setPanne(false)
        })
        carte.current = nouvelle
        setPrete(true)
      } catch {
        if (!fini) setPanne(true)
      }
    })()
    return () => {
      fini = true
      carte.current?.remove()
      carte.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // les têtes : un repère par personne, déplacé quand sa position change
  useEffect(() => {
    let annule = false
    void (async () => {
      const c = carte.current
      if (!c) return
      const maplibre = await import('maplibre-gl')
      if (annule) return
      const els: Record<string, HTMLElement> = {}
      const vieux = (c as CarteML & { _nidoo?: Record<string, InstanceType<typeof maplibre.Marker>> })._nidoo ?? {}
      for (const [id, mk] of Object.entries(vieux)) if (!points.some((x) => x.m.id === id)) mk.remove()
      const neufs: Record<string, InstanceType<typeof maplibre.Marker>> = {}
      for (const x of points) {
        let mk = vieux[x.m.id]
        if (!mk) {
          const el = document.createElement('div')
          el.className = 'repere-famille'
          mk = new maplibre.Marker({ element: el, anchor: 'bottom' }).setLngLat([x.p.lon, x.p.lat]).addTo(c)
        } else mk.setLngLat([x.p.lon, x.p.lat])
        neufs[x.m.id] = mk
        els[x.m.id] = mk.getElement()
      }
      ;(c as CarteML & { _nidoo?: typeof neufs })._nidoo = neufs
      setMarques(els)
      const b = cadre(points.map((x) => x.p))
      if (b && points.length) c.fitBounds(b, { padding: MARGES, maxZoom: 15, duration: 600 })
    })()
    return () => {
      annule = true
    }
  }, [cle, prete]) // eslint-disable-line react-hooks/exhaustive-deps

  // touché dans la liste : on va vers lui
  useEffect(() => {
    if (!focus) return
    const x = points.find((y) => y.m.id === focus.id)
    if (x) carte.current?.flyTo({ center: [x.p.lon, x.p.lat], zoom: 15, duration: 900 })
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="carte-famille relative bg-[#EEF1F4]" style={{ height: hauteur }}>
      {/* en style (MapLibre met « position: relative » sur la carte : la classe seule ne suffit pas) */}
      <div ref={boite} style={{ position: 'absolute', inset: 0 }} />
      {Object.entries(marques).map(([id, el]) => {
        const x = points.find((y) => y.m.id === id)
        if (!x) return null
        const pale = ancienne(x.p)
        return createPortal(
          <Repere m={x.m} moi={id === moi} pale={pale} />,
          el,
          id,
        )
      })}
      {(panne || !points.length) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">
          <MapPin size={26} className="text-pale" />
          <p className="text-sous font-semibold text-brume">{panne ? 'La carte ne s’affiche pas pour le moment' : 'Personne ne partage sa position pour l’instant'}</p>
        </div>
      )}
    </div>
  )
}
