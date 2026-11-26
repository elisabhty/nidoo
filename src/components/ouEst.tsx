// « Où est la famille » (Elisa, 21 novembre) : la carte avec chacun là où il est, s'il a choisi de partager sa position,
// la liste (où, depuis quand, à quelle distance, la batterie presque vide), et mon interrupteur pour partager ou arrêter.
// La carte : MapLibre (libre) avec les fonds d'OpenFreeMap (gratuits, sans clé, données OpenStreetMap), chargée à la demande.
import { BatteryLow, ChevronRight, LocateFixed, MapPin, Navigation, Plus, RefreshCw, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GeoJSONSource, LngLatLike, Map as CarteML } from 'maplibre-gl'
import { cercle, cle, endroitDe } from '../lib/endroits'
import { cadrer, choisirRelief, COUCHE_BATIMENTS, coucheBatiments, LUMIERE, PENTE, reliefChoisi, SEUIL_3D, type Camera } from '../lib/relief'
import { select, tap } from '../lib/haptic'
import { ancienne, autorisation, cadre, distance, ilYA, libelle, lirePosition, messagePosition, POSITION_DEMO, suivre, texteDistance, type Autorisation } from '../lib/localisation'
import { NATIF_IOS } from '../lib/pont'
import { useHome } from '../lib/store'
import type { Endroit, Member, Position } from '../lib/types'
import { EndroitSheet } from './endroits'
import { IconeEndroit, PastilleEndroit } from './iconeEndroit'
import { Avatar, Btn, Page, Switch } from './ui'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
/** De la place en haut pour les têtes (le repère est accroché par sa pointe, en bas). */
const MARGES = { top: 84, bottom: 28, left: 44, right: 44 }

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
      const p = api.mode === 'local' ? POSITION_DEMO : await lirePosition()
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
            ? autres.map((x) => `${x.m.display_name} · ${endroitDe(x.p, state.endroits)?.nom ?? x.p.ville ?? libelle(x.p)}`).join('  ·  ')
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
  // nos adresses : la fiche ouverte (« nouvelle », ou celle qu'on modifie), et celle qui vient d'arriver
  const [fiche, setFiche] = useState<Endroit | 'nouvelle' | null>(null)
  const [arrivee, setArrivee] = useState<string | null>(null)
  const viser = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))
  const maintenant = Date.now()
  const ou = (p: Position) => endroitDe(p, state.endroits)
  const ici = moi ? ou(moi) : null
  useReprendreSuivi(!!moi)
  // une adresse enregistrée : sa ligne s'éclaire et la carte va la montrer (pas de bandeau : ça se voit)
  useEffect(() => {
    if (!arrivee) return
    const e = state.endroits.find((x) => cle(x.nom) === arrivee && !x.id.startsWith('nouveau-'))
    if (e) viser(`endroit:${e.id}`)
    const t = window.setTimeout(() => setArrivee(null), 1800)
    return () => window.clearTimeout(t)
  }, [arrivee, state.endroits]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
    <Page title="Où est la famille" onClose={onClose}>
      <p className="-mt-1 px-5 pb-3 text-sous text-brume">Chacun choisit de partager sa position, et peut arrêter quand il veut. Seule la dernière est gardée.</p>
      {/* le cadre de la carte (Elisa, 25 novembre : « améliore le cadre ») : un passe-partout blanc comme les autres
          cartes de la page, un liseré ; dans la carte, le bouton 3D et celui pour revenir sur soi */}
      <div className="mx-4 rounded-[26px] bg-carte p-1.5 shadow-carte">
        <div className="relative overflow-hidden rounded-[20px]">
          <CarteFamille points={points} moi={state.me.id} focus={focus} hauteur={300} endroits={state.endroits} onMoi={moi ? () => viser(state.me.id) : undefined} />
          <span className="pointer-events-none absolute inset-0 z-[6] rounded-[20px] ring-1 ring-inset ring-encre/[0.06]" aria-hidden="true" />
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
                {ici ? (
                  <p className="flex min-w-0 items-center gap-1 text-note font-semibold text-encre">
                    <IconeEndroit nom={ici.nom} size={14} />
                    <span className="truncate">{ici.nom}</span>
                  </p>
                ) : (
                  <p className="truncate text-note text-brume">{libelle(moi)}</p>
                )}
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
          // à une de nos adresses : « École » plutôt que la rue (Elisa, 26 novembre)
          const la = p ? ou(p) : null
          const dernier = i === t.length - 1
          return (
            <div key={m.id} className="flex items-center gap-3 pl-3.5">
              <button
                onClick={() => p && (select(), viser(m.id))}
                disabled={!p}
                className={`presse-ligne flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left ${p ? '' : 'opacity-55'}`}
                aria-label={p ? `Voir ${m.display_name} sur la carte` : `${m.display_name} ne partage pas sa position`}
              >
                <Avatar m={m} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-corps font-semibold">{m.display_name}</span>
                  {p ? (
                    <>
                      {la ? (
                        <span className={`flex min-w-0 items-center gap-1 text-note font-semibold ${ancienne(p, maintenant) ? 'text-brume' : 'text-encre'}`}>
                          <IconeEndroit nom={la.nom} size={14} />
                          <span className="truncate">{la.nom}</span>
                        </span>
                      ) : (
                        <span className={`block truncate text-note ${ancienne(p, maintenant) ? 'text-brume' : 'text-encre'}`}>{libelle(p)}</span>
                      )}
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

      {/* nos adresses (Elisa, 26 novembre : « enregistrer des adresses, école, travail, pour ne pas mettre l'adresse
          complète mais école ») : qui s'y trouve se lit « École » au lieu de la rue */}
      <p className="entete mt-6">Nos adresses</p>
      <div className="groupe mx-4 shadow-carte">
        {state.endroits.map((e) => {
          const la = points.filter((x) => ou(x.p)?.id === e.id).map((x) => x.m)
          return (
            <button
              key={e.id}
              onClick={() => (tap(), setFiche(e))}
              className={`presse-ligne flex w-full items-center gap-3 pl-3.5 text-left ${arrivee === cle(e.nom) ? 'ligne-arrive' : ''}`}
              aria-label={`${e.nom}${la.length ? `, ${la.map((m) => m.display_name).join(' et ')} y ${la.length > 1 ? 'sont' : 'est'}` : ''} : modifier`}
            >
              <PastilleEndroit nom={e.nom} size={40} />
              <span className="flex min-w-0 flex-1 items-center gap-2 border-b border-trait py-2.5 pr-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-corps font-semibold">{e.nom}</span>
                  <span className="block truncate text-note text-brume">{e.adresse ?? 'Position enregistrée'}</span>
                </span>
                {/* qui y est en ce moment */}
                {la.length > 0 && (
                  <span className="flex shrink-0 -space-x-2">
                    {la.slice(0, 3).map((m) => (
                      <span key={m.id} className="rounded-full ring-2 ring-carte">
                        <Avatar m={m} size={26} />
                      </span>
                    ))}
                  </span>
                )}
                <ChevronRight size={17} className="shrink-0 text-pale" />
              </span>
            </button>
          )
        })}
        <button onClick={() => (tap(), setFiche('nouvelle'))} className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce">
            <Plus size={21} strokeWidth={2.6} />
          </span>
          <span className="min-w-0 flex-1 py-2.5 pr-3.5">
            <span className="block text-corps font-semibold text-teinte-fonce">Ajouter une adresse</span>
            <span className="block truncate text-note text-brume">École, travail, chez Mamie…</span>
          </span>
        </button>
      </div>
      <p className="mt-2 px-5 text-note text-brume">
        {state.endroits.length ? `Quand quelqu’un s’y trouve, on lit « ${state.endroits[0].nom} » plutôt que l’adresse. Elles servent aussi pour l’agenda.` : 'Quand quelqu’un s’y trouve, on lit son nom plutôt que l’adresse. Elles servent aussi pour l’agenda.'}
        {!state.endroitsPartages && ' Pour l’instant, elles restent sur ce téléphone.'}
      </p>

      <p className="mt-5 px-5 text-mini text-pale">Carte : © OpenStreetMap · OpenFreeMap. Les positions ne sont visibles que par la famille.</p>
    </Page>
    {/* à côté de la page (pas dedans : elle défile), pour couvrir tout l'écran */}
    {fiche && (
      <EndroitSheet
        endroit={fiche === 'nouvelle' ? undefined : fiche}
        onClose={() => setFiche(null)}
        onFait={(nom) => nom && setArrivee(cle(nom))}
      />
    )}
    </>
  )
}

/**
 * Le repère d'un proche sur la carte : une goutte d'un seul tenant (le rond et sa pointe dans le même tracé), la tête
 * dedans. Avant, c'était un rond et un petit carré tourné posé dessous : on voyait le raccord (Elisa, 25 novembre :
 * « le rond autour de la personne, ça fait bizarre, c'est mal fait »). Le mien est violet avec un filet blanc.
 * 50 × 58 : la pointe, en bas au milieu, est exactement sur la position (le repère est accroché par le bas).
 * En 3D, une ombre douce sous la pointe : il est posé sur la carte, debout.
 */
function Repere({ m, moi, pale, relief }: { m: Member; moi: boolean; pale: boolean; relief: boolean }) {
  return (
    <div className={`relative h-[58px] w-[50px] ${pale ? 'opacity-60' : ''}`}>
      <span
        className={`pointer-events-none absolute left-1/2 top-[52px] h-[11px] w-[34px] -translate-x-1/2 rounded-[50%] transition-opacity duration-500 ${relief ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(closest-side, rgba(29,26,43,0.4), rgba(29,26,43,0.14) 55%, rgba(29,26,43,0))' }}
        aria-hidden="true"
      />
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

/** Le nom d'une de nos adresses sur la carte, sous son point (les têtes, elles, sont au-dessus du leur). */
function EtiquetteEndroit({ nom }: { nom: string }) {
  return (
    <span className="flex max-w-[150px] items-center gap-1 whitespace-nowrap rounded-full bg-white/95 py-[3px] pl-1.5 pr-2.5 text-mini font-bold text-encre shadow-[0_2px_8px_-1px_rgba(29,26,43,0.22)]">
      <IconeEndroit nom={nom} size={12} />
      <span className="truncate">{nom}</span>
    </span>
  )
}

const AUCUN: readonly Endroit[] = []
type Marques = Record<string, InstanceType<typeof import('maplibre-gl').Marker>>
/** Le zoom le plus serré pour cadrer la famille : à plat, ~800 m de large ; en 3D, ~450 m (les bâtiments se voient). */
const ZOOM_MAX = 15
const ZOOM_MAX_3D = 15.6
/** Quand on ne montre que nos adresses : leur nom pend sous leur point, et le bandeau « Personne ne partage… » en bas. */
const MARGES_LIEUX = { top: 40, bottom: 84, left: 80, right: 80 }

/** Ce que le cadrage en perspective (src/lib/relief.ts) demande à MapLibre. */
function camera(c: CarteML): Camera {
  return {
    taille: () => ({ w: c.getContainer().clientWidth, h: c.getContainer().clientHeight }),
    lire: () => {
      const k = c.getCenter()
      return { lon: k.lng, lat: k.lat, zoom: c.getZoom(), pitch: c.getPitch(), bearing: c.getBearing() }
    },
    poser: (v) => {
      c.jumpTo({
        ...(v.lon !== undefined && v.lat !== undefined ? { center: [v.lon, v.lat] as [number, number] } : {}),
        ...(v.zoom !== undefined ? { zoom: v.zoom } : {}),
        ...(v.pitch !== undefined ? { pitch: v.pitch } : {}),
        ...(v.bearing !== undefined ? { bearing: v.bearing } : {}),
      })
    },
    projeter: (lon, lat) => c.project([lon, lat]),
    deprojeter: (x, y) => {
      const p = c.unproject([x, y])
      return { lon: p.lng, lat: p.lat }
    },
  }
}
const versLonLat = (x: LngLatLike | undefined) => (!x ? null : Array.isArray(x) ? { lon: x[0], lat: x[1] } : 'lng' in x ? { lon: x.lng, lat: x.lat } : { lon: x.lon, lat: x.lat })

/** La boussole : l'aiguille rouge montre le nord ; touchée, la carte se remet le nord en haut. */
function Aiguille() {
  return (
    <svg width="12" height="24" viewBox="0 0 12 24" aria-hidden="true">
      <path d="M6 0.5 L11 12 L1 12 Z" fill="#FF453A" />
      <path d="M6 23.5 L11 12 L1 12 Z" fill="#C8C4D6" />
    </svg>
  )
}

/** La carte : chacun avec sa tête, tout le monde dans le cadre ; touché dans la liste, on va vers lui.
 *  Nos adresses y sont aussi : leur zone, et leur nom. `focus` : un membre (son id) ou une adresse (« endroit:id »).
 *  En 3D (Elisa, 26 novembre) : la carte inclinée, les bâtiments en relief, un bouton pour revenir à plat ; on peut
 *  aussi l'incliner ou la tourner à deux doigts (la boussole remet le nord en haut). */
export function CarteFamille({ points, moi, focus, hauteur, endroits = AUCUN, onMoi }: { points: Point[]; moi: string; focus: { id: string; n: number } | null; hauteur: number; endroits?: readonly Endroit[]; onMoi?: () => void }) {
  const boite = useRef<HTMLDivElement>(null)
  const carte = useRef<CarteML | null>(null)
  const [marques, setMarques] = useState<Record<string, HTMLElement>>({})
  const [lieux, setLieux] = useState<Record<string, HTMLElement>>({})
  const [prete, setPrete] = useState(false)
  const [chargee, setChargee] = useState(false)
  const [panne, setPanne] = useState(false)
  // en 3D (le dernier choix, gardé sur le téléphone ; en 3D la première fois) ; et le nord en haut, ou pas
  const [relief, setRelief] = useState(reliefChoisi)
  const reliefVu = useRef(relief)
  const [nord, setNord] = useState(true)
  const nordVu = useRef(true)
  const aiguille = useRef<HTMLSpanElement>(null)
  // la carte montre le cadrage (personne ne l'a bougée depuis) : elle suit quand quelqu'un se déplace
  const ajuste = useRef(true)
  // pendant un calcul de cadrage, la carte saute d'essai en essai : ces sauts ne comptent pas
  const calcul = useRef(false)
  // l'inclinaison visée par le bouton 3D, le temps que la carte y arrive
  const vise = useRef<number | null>(null)
  const cle = points.map((x) => `${x.m.id}:${x.p.lat},${x.p.lon}`).join('|')
  const cleLieux = endroits.map((e) => `${e.id}:${e.lat},${e.lon},${e.rayon_m},${e.nom}`).join('|')

  /** Tout le monde dans la carte, à cette inclinaison (personne : nos adresses). Faux : rien à cadrer. */
  const recadrer = (c: CarteML, anime: boolean, pitch = c.getPitch()) => {
    const gens = points.length > 0
    const pts = gens ? points.map((x) => x.p) : [...endroits]
    if (!pts.length) return false
    // le nom d'une de nos adresses pend sous la tête de qui s'y trouve : un peu plus d'air sur les côtés
    const marges = !gens ? MARGES_LIEUX : endroits.length ? { ...MARGES, left: 60, right: 60 } : MARGES
    const maxZoom = pitch >= SEUIL_3D ? ZOOM_MAX_3D : ZOOM_MAX
    const lons = pts.map((p) => p.lon)
    const lats = pts.map((p) => p.lat)
    calcul.current = true
    let fin = null
    try {
      // une première idée : le cadrage à plat de MapLibre ; puis la perspective
      const plat = c.cameraForBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: marges, maxZoom })
      const centre = versLonLat(plat?.center) ?? { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 }
      fin = cadrer(camera(c), pts, { depart: { ...centre, zoom: plat?.zoom ?? 13 }, pitch, marges, maxZoom })
    } finally {
      calcul.current = false
    }
    if (!fin) return false
    ajuste.current = true
    const vue = { center: [fin.lon, fin.lat] as [number, number], zoom: fin.zoom, pitch: fin.pitch, bearing: fin.bearing }
    if (anime) c.easeTo({ ...vue, duration: 750 })
    else c.jumpTo(vue)
    return true
  }

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
        // personne ne partage sa position : nos adresses, s'il y en a
        const c = cadre(points.length ? points.map((x) => x.p) : [...endroits])
        const nouvelle = new maplibre.Map({
          container: boite.current,
          style: STYLE,
          ...(c ? { bounds: c, fitBoundsOptions: { padding: MARGES, maxZoom: 15 } } : { center: [2.4, 46.6], zoom: 4.6 }),
          pitch: reliefVu.current ? PENTE : 0,
          maxPitch: 60,
          attributionControl: { compact: true },
        })
        // tout le monde dans la carte, en perspective si elle est inclinée (avant même d'être dessinée)
        recadrer(nouvelle, false)
        // un fond qui ne se charge pas (hors ligne) : la carte reste, sans planter
        nouvelle.on('error', () => undefined)
        // bougée du doigt : elle ne se recadre plus toute seule
        nouvelle.on('movestart', (e) => {
          if (!calcul.current && (e as { originalEvent?: unknown }).originalEvent) ajuste.current = false
        })
        // le bouton 3D et la boussole suivent l'inclinaison et l'orientation de la carte
        const angles = () => {
          if (calcul.current) return
          const r = nouvelle.getPitch() >= SEUIL_3D
          if (vise.current === null && r !== reliefVu.current) {
            reliefVu.current = r
            setRelief(r)
          }
          const b = nouvelle.getBearing()
          if (aiguille.current) aiguille.current.style.transform = `rotate(${-b}deg)`
          const n = Math.abs(b) < 0.5
          if (n !== nordVu.current) {
            nordVu.current = n
            setNord(n)
          }
        }
        nouvelle.on('pitch', angles)
        nouvelle.on('rotate', angles)
        nouvelle.on('moveend', (e) => {
          if (calcul.current) return
          if (vise.current !== null) {
            vise.current = null
            angles()
          }
          // incliner ou redresser la carte aux doigts : c'est gardé pour la prochaine fois
          if ((e as { originalEvent?: unknown }).originalEvent) choisirRelief(nouvelle.getPitch() >= SEUIL_3D)
        })
        // pas de carte au bout de 12 s (hors ligne, travailleur refusé) : on le dit, la liste reste là
        const t = window.setTimeout(() => !fini && setPanne(true), 12000)
        nouvelle.once('load', () => {
          window.clearTimeout(t)
          setPanne(false)
          // les bâtiments en relief (sous les noms de rues), et une lumière douce
          try {
            const style = nouvelle.getStyle()
            const source = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0]
            if (source && !nouvelle.getLayer(COUCHE_BATIMENTS)) nouvelle.addLayer(coucheBatiments(source), style.layers.find((l) => l.type === 'symbol')?.id)
            nouvelle.setLight(LUMIERE)
          } catch {
            /* un fond sans bâtiments : la carte s'incline quand même */
          }
          setChargee(true)
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
      const vieux = (c as CarteML & { _nidoo?: Marques })._nidoo ?? {}
      const premiere = !Object.keys(vieux).length
      for (const [id, mk] of Object.entries(vieux)) if (!points.some((x) => x.m.id === id)) mk.remove()
      const neufs: Marques = {}
      for (const x of points) {
        let mk = vieux[x.m.id]
        if (!mk) {
          const el = document.createElement('div')
          // les têtes passent devant le nom des adresses
          el.className = 'repere-famille'
          el.style.zIndex = '2'
          mk = new maplibre.Marker({ element: el, anchor: 'bottom' }).setLngLat([x.p.lon, x.p.lat]).addTo(c)
        } else mk.setLngLat([x.p.lon, x.p.lat])
        neufs[x.m.id] = mk
        els[x.m.id] = mk.getElement()
      }
      ;(c as CarteML & { _nidoo?: Marques })._nidoo = neufs
      setMarques(els)
      // quelqu'un bouge : la carte le suit, sauf si on est en train de la regarder ailleurs
      if (points.length && (premiere || ajuste.current)) recadrer(c, true)
    })()
    return () => {
      annule = true
    }
  }, [cle, prete]) // eslint-disable-line react-hooks/exhaustive-deps

  // nos adresses : leur nom (sous le point), et la carte les montre si personne ne partage sa position
  useEffect(() => {
    let annule = false
    void (async () => {
      const c = carte.current
      if (!c) return
      const maplibre = await import('maplibre-gl')
      if (annule) return
      const vieux = (c as CarteML & { _lieux?: Marques })._lieux ?? {}
      const premiere = !Object.keys(vieux).length
      for (const [id, mk] of Object.entries(vieux)) if (!endroits.some((e) => e.id === id)) mk.remove()
      const neufs: Marques = {}
      const els: Record<string, HTMLElement> = {}
      for (const e of endroits) {
        let mk = vieux[e.id]
        if (!mk) {
          const el = document.createElement('div')
          el.className = 'repere-endroit'
          el.style.zIndex = '1'
          el.style.pointerEvents = 'none'
          mk = new maplibre.Marker({ element: el, anchor: 'top', offset: [0, 5] }).setLngLat([e.lon, e.lat]).addTo(c)
        } else mk.setLngLat([e.lon, e.lat])
        neufs[e.id] = mk
        els[e.id] = mk.getElement()
      }
      ;(c as CarteML & { _lieux?: Marques })._lieux = neufs
      setLieux(els)
      if (!points.length && endroits.length && (premiere || ajuste.current)) recadrer(c, true)
    })()
    return () => {
      annule = true
    }
  }, [cleLieux, prete]) // eslint-disable-line react-hooks/exhaustive-deps

  // et leur zone : un disque léger, au bon rayon, sur le sol (sous les bâtiments), une fois le fond chargé
  useEffect(() => {
    const c = carte.current
    if (!c || !chargee) return
    const data = {
      type: 'FeatureCollection' as const,
      features: endroits.map((e) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [cercle(e, e.rayon_m)] } })),
    }
    try {
      const src = c.getSource('endroits') as GeoJSONSource | undefined
      if (src) src.setData(data)
      else {
        const dessous = c.getLayer(COUCHE_BATIMENTS) ? COUCHE_BATIMENTS : undefined
        c.addSource('endroits', { type: 'geojson', data })
        c.addLayer({ id: 'endroits-zone', type: 'fill', source: 'endroits', paint: { 'fill-color': '#7050D5', 'fill-opacity': 0.08 } }, dessous)
        c.addLayer({ id: 'endroits-bord', type: 'line', source: 'endroits', paint: { 'line-color': '#7050D5', 'line-opacity': 0.35, 'line-width': 1.4 } }, dessous)
      }
    } catch {
      /* un fond qui n'a pas voulu se charger : pas de zones, la liste dit tout */
    }
  }, [cleLieux, chargee]) // eslint-disable-line react-hooks/exhaustive-deps

  // touché dans la liste : on va vers lui (ou vers l'adresse) ; en 3D, d'un peu plus près, pour voir les bâtiments
  useEffect(() => {
    if (!focus) return
    const e = focus.id.startsWith('endroit:') ? endroits.find((y) => `endroit:${y.id}` === focus.id) : null
    const x = e ? { lat: e.lat, lon: e.lon } : points.find((y) => y.m.id === focus.id)?.p
    if (!x || !carte.current) return
    ajuste.current = false
    carte.current.flyTo({ center: [x.lon, x.lat], zoom: reliefVu.current ? 16 : 15, duration: 900 })
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Le bouton 3D : la carte s'incline (ou se remet à plat), tout le monde reste dedans si elle montrait le cadrage. */
  const basculer = () => {
    const c = carte.current
    if (!c) return
    select()
    const vers = c.getPitch() >= SEUIL_3D ? 0 : PENTE
    choisirRelief(vers > 0)
    vise.current = vers
    reliefVu.current = vers > 0
    setRelief(vers > 0)
    if (!(ajuste.current && recadrer(c, true, vers))) c.easeTo({ pitch: vers, duration: 750 })
  }

  return (
    <div className="carte-famille relative bg-[#EEF1F4]" style={{ height: hauteur }}>
      {/* en style (MapLibre met « position: relative » sur la carte : la classe seule ne suffit pas) */}
      <div ref={boite} style={{ position: 'absolute', inset: 0 }} />
      {Object.entries(lieux).map(([id, el]) => {
        const e = endroits.find((y) => y.id === id)
        return e ? createPortal(<EtiquetteEndroit nom={e.nom} />, el, `endroit:${id}`) : null
      })}
      {Object.entries(marques).map(([id, el]) => {
        const x = points.find((y) => y.m.id === id)
        if (!x) return null
        const pale = ancienne(x.p)
        return createPortal(
          <Repere m={x.m} moi={id === moi} pale={pale} relief={relief} />,
          el,
          id,
        )
      })}
      {(panne || (!points.length && !endroits.length)) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">
          <MapPin size={26} className="text-pale" />
          <p className="text-sous font-semibold text-brume">{panne ? 'La carte ne s’affiche pas pour le moment' : 'Personne ne partage sa position pour l’instant'}</p>
        </div>
      )}
      {/* personne sur la carte, mais nos adresses y sont : on le dit en bas, sans les cacher */}
      {!panne && !points.length && endroits.length > 0 && (
        <p className="verre pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-note font-semibold text-brume">Personne ne partage sa position pour l’instant</p>
      )}
      {/* en haut à droite, comme dans Plans : 3D ou à plat, ma position, et la boussole quand la carte est tournée */}
      {prete && !panne && (
        <div className="absolute right-2.5 top-2.5 z-[5] flex flex-col items-center gap-2">
          <div className="verre flex w-10 flex-col overflow-hidden rounded-full">
            <button onClick={basculer} aria-label={relief ? 'Voir la carte à plat' : 'Voir la carte en 3D'} className="presse flex h-10 w-10 items-center justify-center">
              <span key={relief ? 'plat' : 'relief'} className="anim-pop text-[14px] font-extrabold tracking-[-0.2px] text-teinte-fonce">{relief ? '2D' : '3D'}</span>
            </button>
            {onMoi && (
              <>
                <span className="mx-2.5 h-px bg-encre/10" aria-hidden="true" />
                <button onClick={() => (select(), onMoi())} aria-label="Revenir sur ma position" className="presse flex h-10 w-10 items-center justify-center text-teinte-fonce">
                  <LocateFixed size={19} strokeWidth={2.4} />
                </button>
              </>
            )}
          </div>
          {!nord && (
            <button onClick={() => (select(), carte.current?.easeTo({ bearing: 0, duration: 500 }))} aria-label="Remettre le nord en haut" className="presse verre anim-pop flex h-10 w-10 items-center justify-center rounded-full">
              <span ref={aiguille} className="flex" style={{ transform: `rotate(${-(carte.current?.getBearing() ?? 0)}deg)` }}>
                <Aiguille />
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
