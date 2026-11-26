// « Où sont mes proches ? » (Elisa, 21 novembre ; « Où est la famille » jusqu'au 26) : la carte avec chacun là où il est, s'il a choisi de partager sa position,
// la liste (où, depuis quand, à quelle distance, la batterie presque vide), « Je suis en route », mon interrupteur pour
// partager ou arrêter, et nos lieux. La carte passe d'abord, en grand, et s'ouvre en plein écran.
// La carte : MapLibre (libre) avec les fonds d'OpenFreeMap (gratuits, sans clé, données OpenStreetMap), chargée à la demande.
import { BatteryLow, BellRing, Car, ChevronRight, EyeOff, LocateFixed, Lock, MapPin, Maximize2, Navigation, Plus, RefreshCw, Settings, Users, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import type { GeoJSONSource, LngLatLike, Map as CarteML } from 'maplibre-gl'
import { cercle, cle, endroitDe } from '../lib/endroits'
import { chargerMapLibre, urlStyleCarte } from '../lib/fondCarte'
import { avantLesNoms, cadrer, choisirRelief, COUCHE_BATIMENTS, coucheBatiments, LUMIERE, MONDE, PENTE, PENTE_MAX, penteMax, reliefChoisi, SEUIL_3D, type Camera } from '../lib/relief'
import { select, tap } from '../lib/haptic'
import { ancienne, autorisation, cadre, distance, ilYA, libelle, lirePosition, messagePosition, POSITION_DEMO, suivre, texteDistance, type Autorisation } from '../lib/localisation'
import { DUREES, dureeDe, enCours, finDuree, prochaineFin, texteJusqua, type Duree } from '../lib/positions'
import { NATIF_IOS } from '../lib/pont'
import { useHome } from '../lib/store'
import type { Endroit, Member, Position, ReglagesPartage } from '../lib/types'
import { EndroitSheet } from './endroits'
import { EnRouteSheet } from './enRoute'
import { IconeEndroit, PastilleEndroit } from './iconeEndroit'
import { Avatar, Btn, Page, Switch } from './ui'

/** De la place en haut pour les têtes (le repère est accroché par sa pointe, en bas). */
const MARGES = { top: 84, bottom: 28, left: 44, right: 44 }

type Point = { m: Member; p: Position }

/** Les proches qui ont un téléphone, avec leur position s'ils la partagent ; moi en premier. Un partage pour un temps
 *  disparaît à son heure (la carte se redessine à ce moment-là). */
function useFamillePositions() {
  const { state } = useHome()
  const [tic, setTic] = useState(0)
  useEffect(() => {
    const fin = prochaineFin(state.positions)
    if (fin == null) return
    const t = window.setTimeout(() => setTic((n) => n + 1), Math.min(fin - Date.now() + 500, 2 ** 31 - 1))
    return () => window.clearTimeout(t)
  }, [state.positions, tic])
  return useMemo(() => {
    const parId = new Map(state.positions.filter((p) => enCours(p)).map((p) => [p.member_id, p]))
    const gens = state.members.filter((m) => m.user_id).sort((a, b) => (a.id === state.me.id ? -1 : b.id === state.me.id ? 1 : 0))
    const points: Point[] = gens.flatMap((m) => (parId.has(m.id) ? [{ m, p: parId.get(m.id)! }] : []))
    return { gens, points, parId, moi: parId.get(state.me.id) ?? null }
  }, [state.positions, state.members, state.me.id, tic])
}

/** Mes réglages de partage gardés sur ce téléphone (approximative, « Bien arrivé ! ») : on les retrouve en repartageant. */
const REGLAGES = 'nidoo.partage.reglages'
function reglagesGardes(): { approx: boolean; prevenir: boolean } {
  try {
    const r = JSON.parse(localStorage.getItem(REGLAGES) ?? '{}') as { approx?: boolean; prevenir?: boolean }
    return { approx: !!r.approx, prevenir: !!r.prevenir }
  } catch {
    return { approx: false, prevenir: false }
  }
}
function garderReglages(r: ReglagesPartage) {
  try {
    const avant = reglagesGardes()
    localStorage.setItem(REGLAGES, JSON.stringify({ approx: r.approx ?? avant.approx, prevenir: r.prevenir ?? avant.prevenir }))
  } catch {
    /* tant pis : les réglages par défaut */
  }
}

/** Partager (ou remettre à jour) ma position : lue sur le téléphone, puis envoyée à la maison. */
function usePartager() {
  const { api, run, state, toast } = useHome()
  const [occupe, setOccupe] = useState(false)
  const partager = async (premiereFois: boolean, reglages?: ReglagesPartage) => {
    if (occupe) return false
    setOccupe(true)
    try {
      const p = api.mode === 'local' ? POSITION_DEMO : await lirePosition()
      const ok = await run((a) => a.partagerPosition(state.family.id, p, reglages))
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
  /** Pour combien de temps, approximative, « Bien arrivé ! » : tout de suite (la position précise revient aussitôt). */
  const regler = async (r: ReglagesPartage) => {
    garderReglages(r)
    const ok = await run((a) => a.reglerPosition(state.family.id, r))
    if (ok && r.approx === false) void partager(false)
    return ok
  }
  return { partager, arreter, regler, occupe }
}

/** Les trois durées, comme des boutons radio. */
function ChoixDuree({ valeur, onChoix }: { valeur: Duree; onChoix: (d: Duree) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Partager pendant">
      {DUREES.map((d) => (
        <button
          key={d.cle}
          type="button"
          role="radio"
          aria-checked={valeur === d.cle}
          onClick={() => valeur !== d.cle && (select(), onChoix(d.cle))}
          className={`presse choix-pop rounded-full py-[7px] text-[14.5px] font-semibold transition-colors duration-200 ${valeur === d.cle ? 'bg-teinte text-white' : 'bg-doux text-encre'}`}
        >
          {d.libelle}
        </button>
      ))}
    </div>
  )
}

/** Une ligne de réglage avec son interrupteur. */
function LigneReglage({ icone, titre, detail, on, actif = true, onChange }: { icone: ReactNode; titre: string; detail: string; on: boolean; actif?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`flex items-center gap-3 border-t border-trait py-3 pl-3.5 pr-3 ${actif ? '' : 'opacity-55'}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sous font-semibold text-encre">{titre}</span>
        <span className="block text-note text-brume">{detail}</span>
      </span>
      <Switch on={on} label={titre} disabled={!actif} onChange={onChange} />
    </div>
  )
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
        <span className="block text-corps font-semibold">Où sont mes proches ?</span>
        <span className="block truncate text-note text-brume">
          {autres.length
            ? autres.map((x) => `${x.m.display_name} · ${endroitDe(x.p, state.endroits)?.nom ?? x.p.ville ?? libelle(x.p)}`).join('  ·  ')
            : moi
              ? 'Ta position est partagée. Les autres peuvent partager la leur aussi.'
              : 'Voir où chacun se trouve, s’il l’accepte.'}
        </span>
      </span>
      {/* deux têtes au plus (et aucune sur les petits iPhone) : « Où sont mes proches ? » tient sur une ligne */}
      {autres.length > 0 && (
        <span className="flex shrink-0 -space-x-2.5 max-[379px]:hidden">
          {autres.slice(0, 2).map((x) => (
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

/** La carte, plus grande : près de la moitié de l'écran (Elisa, 26 novembre : « davantage de place à la carte »). */
const HAUTEUR_CARTE = 'clamp(300px, 46vh, 440px)'

/** La page : la carte d'abord (elle s'agrandit aussi en plein écran), mes proches juste dessous, puis « Je suis en
 *  route », ma position et nos lieux ; ce qu'on garde (et pour qui) tout en bas (Elisa, 26 novembre : « de façon UI UX »). */
export function OuEstPage({ onClose }: { onClose: () => void }) {
  const { state, api } = useHome()
  const { gens, points, parId, moi } = useFamillePositions()
  const { partager, arreter, regler, occupe } = usePartager()
  // je commence à partager : pour une heure, jusqu'à ce soir, ou toujours
  const [duree, setDuree] = useState<Duree>('toujours')
  const reglable = !!state.positionsReglables
  const commencer = () => {
    const gardes = reglagesGardes()
    void partager(true, reglable ? { jusqua: finDuree(duree), approx: gardes.approx, prevenir: gardes.prevenir } : undefined)
  }
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null)
  const [auto, setAuto] = useState<Autorisation | null>(null)
  // nos lieux : la fiche ouverte (« nouvelle », ou celle qu'on modifie), et celle qui vient d'arriver
  const [fiche, setFiche] = useState<Endroit | 'nouvelle' | null>(null)
  const [arrivee, setArrivee] = useState<string | null>(null)
  const [enRoute, setEnRoute] = useState(false)
  const cadreCarte = useRef<HTMLDivElement>(null)
  const viser = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))
  /** Touché dans la liste : si la carte est sortie de l'écran, la page remonte d'abord jusqu'à elle. */
  const montrer = (id: string) => {
    const el = cadreCarte.current
    const page = el?.closest<HTMLElement>('.overflow-y-auto')
    if (el && page) {
      const r = el.getBoundingClientRect()
      const haut = page.getBoundingClientRect().top + 52 // sous la barre du haut
      if (r.top < haut || r.bottom > window.innerHeight) page.scrollTo({ top: 0, behavior: 'smooth' })
    }
    viser(id)
  }
  const maintenant = Date.now()
  const ou = (p: Position) => endroitDe(p, state.endroits)
  const ici = moi ? ou(moi) : null
  const autres = gens.filter((m) => m.id !== state.me.id)
  useReprendreSuivi(!!moi)
  // un lieu enregistré : sa ligne s'éclaire et la carte va le montrer (pas de bandeau : ça se voit)
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

  // ce que fait vraiment le partage : « même appli fermée » seulement si l'iPhone l'autorise (« Toujours »)
  const suivi = !NATIF_IOS
    ? 'Elle change quand tu ouvres la carte'
    : auto === 'toujours'
      ? 'Elle suit tes déplacements, même appli fermée'
      : auto === 'active'
        ? 'Seulement quand l’appli est ouverte'
        : 'Elle suit tes déplacements'
  const versDe = (p: Position) => (NATIF_IOS ? `maps://?daddr=${p.lat},${p.lon}` : `https://maps.apple.com/?daddr=${p.lat},${p.lon}`)

  return (
    <>
    <Page title="Où sont mes proches ?" onClose={onClose}>
      {/* la carte d'abord, et plus grande ; un passe-partout blanc comme les autres cartes de la page (Elisa,
          25 novembre : « améliore le cadre ») ; dedans, la 3D, ma position et le plein écran */}
      <div ref={cadreCarte} className="mx-4 rounded-[26px] bg-carte p-1.5 shadow-carte">
        <CarteFamille points={points} moi={state.me.id} focus={focus} hauteur={HAUTEUR_CARTE} endroits={state.endroits} onMoi={moi ? () => viser(state.me.id) : undefined} />
      </div>

      {/* je ne partage pas encore ma position : l'invitation à le faire, juste sous la carte */}
      {!moi && (
        <div className="groupe mx-4 mt-4 p-4 shadow-carte">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E3F1FD] text-[#2F7FD0]">
              <LocateFixed size={21} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-corps font-semibold">Apparaître sur la carte</p>
              <p className="mt-0.5 text-sous text-brume">
                Tes proches te voient sur la carte{NATIF_IOS ? ', et ta position suit quand tu bouges, même appli fermée' : ''}. Tu peux arrêter quand tu veux.
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
          {reglable && (
            <div className="mt-3">
              <p className="mb-1.5 text-note font-semibold text-brume">Pendant</p>
              <ChoixDuree valeur={duree} onChoix={setDuree} />
            </div>
          )}
          <Btn className="mt-3" onClick={commencer} disabled={occupe}>
            <MapPin size={18} strokeWidth={2.4} /> {occupe ? 'Je cherche ta position…' : 'Partager ma position'}
          </Btn>
        </div>
      )}

      {/* mes proches, juste sous la carte (Elisa, 26 novembre : « Mes proches » plutôt que « La famille ») */}
      <p className="entete mt-6">Mes proches</p>
      <div className="groupe mx-4 shadow-carte">
        {autres.map((m, i, t) => {
          const p = parId.get(m.id)
          const loin = p && moi ? texteDistance(distance(p, moi)) : null
          // à un de nos lieux : « École » plutôt que la rue (Elisa, 26 novembre)
          const la = p ? ou(p) : null
          const dernier = i === t.length - 1
          return (
            <div key={m.id} className="flex items-center gap-3 pl-3.5">
              <button
                onClick={() => p && (select(), montrer(m.id))}
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
                      <span className="flex flex-wrap items-center gap-x-1.5 text-mini text-brume">
                        {ilYA(p.updated_at, maintenant)}
                        {/* approximative : à 1 km près, la distance ne veut rien dire */}
                        {p.approx ? <> · à 1 km près</> : loin && <> · {loin}</>}
                        {p.jusqua && <> · {texteJusqua(p)}</>}
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
        {!autres.length && <p className="p-4 text-sous text-brume">Invite tes proches : quand ils partageront leur position, ils apparaîtront ici.</p>}
      </div>

      {/* « Je suis en route » (Elisa, 26 novembre) : un petit mot à mes proches, avec l'heure d'arrivée */}
      {autres.length > 0 && (
        <button onClick={() => (tap(), setEnRoute(true))} className="presse groupe mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 p-3.5 text-left shadow-carte">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-peche-doux text-peche-fonce">
            <Car size={21} strokeWidth={2.3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-corps font-semibold">Je suis en route</span>
            <span className="block truncate text-note text-brume">Prévenir mes proches de mon arrivée</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-pale" />
        </button>
      )}

      {/* ma position : les réglages, sous mes proches (Elisa, 26 novembre : « les membres de la famille plus vite ») */}
      {moi && (
        <>
          <p className="entete mt-6">Ma position</p>
          <div className="groupe mx-4 shadow-carte">
            <div className="flex items-center gap-3 p-3.5">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E3F1FD] text-[#2F7FD0]">
                <LocateFixed size={21} strokeWidth={2.4} />
                {/* le point vert : ma position est à jour (gris au-delà de 12 h) */}
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-carte ${ancienne(moi, maintenant) ? 'bg-pale' : 'bg-[#34C759]'}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-corps font-semibold">Partager ma position</p>
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
            {/* pour combien de temps, approximative, « Bien arrivé ! » (Elisa, 26 novembre : « la partie géo ») */}
            {reglable && (
              <>
                <div className="border-t border-trait px-3.5 pb-3 pt-2.5">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="text-sous font-semibold text-encre">Pendant</p>
                    {moi.jusqua && <p className="text-note font-semibold text-teinte-fonce">{texteJusqua(moi)}</p>}
                  </div>
                  <ChoixDuree valeur={dureeDe(moi)} onChoix={(d) => void regler({ jusqua: finDuree(d) })} />
                </div>
                <LigneReglage
                  icone={<EyeOff size={17} strokeWidth={2.4} />}
                  titre="Position approximative"
                  detail="Tes proches voient la ville, pas la rue (à 1 km près)."
                  on={!!moi.approx}
                  onChange={(v) => void regler({ approx: v })}
                />
                <LigneReglage
                  icone={<BellRing size={17} strokeWidth={2.4} />}
                  titre={'Bien arrivé\u00a0!'}
                  detail={
                    moi.approx
                      ? 'Pas avec une position approximative.'
                      : !state.endroits.length
                        ? 'Ajoute d’abord un de nos lieux (École, Travail…).'
                        : !state.endroitsPartages
                          ? 'Quand nos lieux seront partagés avec toute la famille.'
                          : 'Un petit mot à tes proches quand tu arrives à un de nos lieux.'
                  }
                  on={!!moi.prevenir && !moi.approx}
                  actif={!moi.approx && state.endroits.length > 0 && state.endroitsPartages}
                  onChange={(v) => void regler({ prevenir: v })}
                />
              </>
            )}
            {/* « Partager même appli fermée » (avant : « Suivre aussi appli fermée ») : l'iPhone doit dire « Toujours » */}
            {NATIF_IOS && auto === 'active' && (
              <a href="app-settings:" onClick={() => tap()} className="presse flex items-center gap-3 border-t border-trait bg-peche-doux/45 py-3 pl-3.5 pr-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-peche-doux text-peche-fonce">
                  <Settings size={18} strokeWidth={2.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sous font-semibold text-encre">Partager même appli fermée</span>
                  <span className="block text-note text-brume">Réglages › Position › Toujours</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-pale" />
              </a>
            )}
          </div>
        </>
      )}

      {/* nos lieux (Elisa, 26 novembre : « enregistrer des adresses, école, travail, pour ne pas mettre l'adresse
          complète mais école » ; « Nos lieux » plutôt que « Nos adresses ») : qui s'y trouve se lit « École » */}
      <p className="entete mt-6">Nos lieux</p>
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
            <span className="block text-corps font-semibold text-teinte-fonce">Ajouter un lieu</span>
            <span className="block truncate text-note text-brume">Maison, école, travail, chez Mamie…</span>
          </span>
        </button>
      </div>
      <p className="mt-2 px-5 text-note text-brume">
        {state.endroits.length ? `Quand quelqu’un s’y trouve, on lit « ${state.endroits[0].nom} » plutôt que l’adresse. Ils servent aussi pour l’agenda.` : 'Quand quelqu’un s’y trouve, on lit son nom plutôt que l’adresse. Ils servent aussi pour l’agenda.'}
        {!state.endroitsPartages && ' Pour l’instant, ils restent sur ce téléphone.'}
      </p>

      {/* ce qu'on garde, et pour qui : tout en bas (avant, sous le titre, il repoussait la carte) */}
      <p className="mx-5 mt-7 flex gap-2 text-note text-brume">
        <Lock size={14} strokeWidth={2.4} className="mt-[3px] shrink-0" aria-hidden="true" />
        <span>Chacun choisit de partager sa position et peut arrêter quand il veut. Seule la dernière est gardée, et seule la famille la voit.</span>
      </p>
      <p className="mt-2 px-5 text-mini text-pale">Carte : © OpenStreetMap · OpenFreeMap</p>
    </Page>
    {/* à côté de la page (pas dedans : elle défile), pour couvrir tout l'écran */}
    {fiche && (
      <EndroitSheet
        endroit={fiche === 'nouvelle' ? undefined : fiche}
        onClose={() => setFiche(null)}
        onFait={(nom) => nom && setArrivee(cle(nom))}
      />
    )}
    {enRoute && <EnRouteSheet onClose={() => setEnRoute(false)} />}
    </>
  )
}

/** La goutte des repères (50 × 58), la pointe en bas au milieu. */
const GOUTTE = 'M25 57.2 Q22.2 50.6 16.45 48.49 A25 25 0 1 1 33.55 48.49 Q27.8 50.6 25 57.2 Z'

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
          d={GOUTTE}
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

/** Une tête à venir : la goutte des repères, vide et en pointillés (comme les places à prendre de l'accueil). */
function GoutteVide({ size }: { size: number }) {
  const id = useId()
  return (
    <svg width={size} height={Math.round((size * 58) / 50)} viewBox="0 0 50 58" className="overflow-visible" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx="25" cy="25" r="20.5" />
        </clipPath>
      </defs>
      <path d={GOUTTE} fill="#FBFAFF" stroke="#7050D5" strokeOpacity={0.6} strokeWidth={2.3} strokeDasharray="4.6 3.6" strokeLinejoin="round" />
      <g clipPath={`url(#${id})`} fill="#7050D5" fillOpacity={0.24}>
        <circle cx="25" cy="20.5" r="7.2" />
        <ellipse cx="25" cy="41.5" rx="13.5" ry="10.5" />
      </g>
    </svg>
  )
}

/** Personne sur la carte : trois têtes à venir, qui flottent doucement (celle du milieu un peu plus haut). */
function TetesAVenir() {
  return (
    <span className="flex items-end gap-1.5" aria-hidden="true">
      {[27, 33, 27].map((s, i) => (
        <span key={i} className="flex" style={{ marginBottom: i === 1 ? 7 : 0, animation: `flotte ${3.2 + i * 0.45}s ease-in-out ${i * 0.35}s infinite` }}>
          <GoutteVide size={s} />
        </span>
      ))}
    </span>
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
/** Quand on ne montre que nos lieux : leur nom pend sous leur point, et « Vos têtes apparaîtront ici » en bas (au-dessus
 *  des crédits). */
const MARGES_LIEUX = { top: 40, bottom: 108, left: 80, right: 80 }
/** En plein écran : la place des boutons du haut, et celle des puces du bas (« Tout le monde », chacun). */
const BOUTONS_HAUT = 56
/** La colonne de boutons, en haut à droite de la carte (et de quoi y loger une tête à côté). */
const BOUTONS_DROITE = 76
const BANDEAU_BAS = 76
const COURBE = 'cubic-bezier(0.32, 0.72, 0, 1)'
/** Sur un ordinateur (souris, pavé tactile), la molette fait défiler la page au lieu de dézoomer la carte d'un coup
 *  jusqu'au monde entier : on zoome avec ⌘ (ou Ctrl) + molette, ou en pinçant le pavé. Pas sur un téléphone. */
const BUREAU = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
const AIDE_ZOOM = {
  'CooperativeGesturesHandler.MacHelpText': 'Pour zoomer : ⌘ + défilement',
  'CooperativeGesturesHandler.WindowsHelpText': 'Pour zoomer : Ctrl + molette',
}

/** Les zones sûres de l'écran (l'encoche, la barre d'accueil), en pixels. */
function zonesSures(): { haut: number; bas: number } {
  const d = document.createElement('div')
  d.style.cssText = 'position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none'
  document.body.appendChild(d)
  const lire = (v: string) => {
    d.style.height = `var(${v})`
    return d.getBoundingClientRect().height
  }
  const r = { haut: lire('--sat'), bas: lire('--sab') }
  d.remove()
  return r
}

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
export function CarteFamille({ points, moi, focus, hauteur, endroits = AUCUN, onMoi }: { points: Point[]; moi: string; focus: { id: string; n: number } | null; hauteur: number | string; endroits?: readonly Endroit[]; onMoi?: () => void }) {
  // la place de la carte dans la page (elle la garde pendant le plein écran), et la carte elle-même
  const place = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const reduire = useRef<HTMLButtonElement>(null)
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
  // l'inclinaison voulue (le bouton, les doigts, un cadrage) ; de loin, la carte reste pourtant à plat et se relève
  // en approchant (penteMax) : la 3D revient toute seule quand on se rapproche
  const voulue = useRef(relief ? PENTE : 0)
  // ce que le mouvement en cours demandait juste avant, et ce que la carte montrait (pour voir si on incline la
  // carte, ou si on zoome seulement)
  const propose = useRef<number | null>(null)
  const rendue = useRef(0)
  // un mouvement à nous (un cadrage, aller vers quelqu'un) : le bouton 3D ne suit pas chaque image
  const programme = useRef(false)
  // la 3D est possible à ce zoom (de loin, le bouton est grisé) ; la carte est vraiment inclinée (l'ombre des repères)
  const [troisD, setTroisD] = useState(true)
  const troisDVu = useRef(true)
  const [penche, setPenche] = useState(false)
  const pencheVu = useRef(false)
  const [nord, setNord] = useState(true)
  const nordVu = useRef(true)
  const aiguille = useRef<HTMLSpanElement>(null)
  // la carte montre le cadrage (personne ne l'a bougée depuis) : elle suit quand quelqu'un se déplace
  const ajuste = useRef(true)
  // pendant un calcul de cadrage, la carte saute d'essai en essai : ces sauts ne comptent pas
  const calcul = useRef(false)
  // en plein écran (Elisa, 26 novembre : « un bouton pour l'afficher en plein écran ») ; la puce touchée en bas
  const [plein, setPlein] = useState(false)
  const pleinVu = useRef(false)
  const sur = useRef({ haut: 0, bas: 0 })
  const [puce, setPuce] = useState<string | null>(null) // un proche, « tous », ou aucune
  const cle = points.map((x) => `${x.m.id}:${x.p.lat},${x.p.lon}`).join('|')
  const cleLieux = endroits.map((e) => `${e.id}:${e.lat},${e.lon},${e.rayon_m},${e.nom}`).join('|')

  /** Le bouton 3D suit l'inclinaison voulue. */
  const suivreRelief = () => {
    const r = voulue.current >= SEUIL_3D
    if (r === reliefVu.current) return
    reliefVu.current = r
    setRelief(r)
  }

  /** Tout le monde dans la carte, à cette inclinaison (personne : nos adresses). Faux : rien à cadrer.
   *  De loin (une famille aux quatre coins du pays, ou du monde), la carte est à plat : on cadre alors à plat. */
  const recadrer = (c: CarteML, anime: boolean, pitch = voulue.current) => {
    const gens = points.length > 0
    const pts = gens ? points.map((x) => x.p) : [...endroits]
    if (!pts.length) return false
    // le nom d'un de nos lieux pend sous la tête de qui s'y trouve : un peu plus d'air sur les côtés
    // à droite, la place des boutons (3D, ma position, plein écran) : ni une tête ni le nom d'un lieu ne s'y cachent
    const base = !gens ? MARGES_LIEUX : endroits.length ? { ...MARGES, left: 60, right: BOUTONS_DROITE + 24 } : { ...MARGES, right: BOUTONS_DROITE }
    // en plein écran : sous les boutons du haut, au-dessus des puces du bas
    const marges = pleinVu.current ? { ...base, top: base.top + sur.current.haut + BOUTONS_HAUT, bottom: base.bottom + sur.current.bas + (gens ? BANDEAU_BAS : 0) } : base
    const lons = pts.map((p) => p.lon)
    const lats = pts.map((p) => p.lat)
    calcul.current = true
    let fin = null
    let p = pitch
    try {
      for (let essai = 0; essai < 3; essai++) {
        const maxZoom = p >= SEUIL_3D ? ZOOM_MAX_3D : ZOOM_MAX
        // une première idée : le cadrage à plat de MapLibre ; puis la perspective
        const plat = c.cameraForBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: marges, maxZoom })
        const centre = versLonLat(plat?.center) ?? { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 }
        fin = cadrer(camera(c), pts, { depart: { ...centre, zoom: plat?.zoom ?? 13 }, pitch: p, marges, maxZoom })
        // trop loin pour être aussi incliné : on recadre à l'inclinaison permise
        if (!fin || p <= penteMax(fin.zoom) + 0.5) break
        p = penteMax(fin.zoom)
      }
    } finally {
      calcul.current = false
    }
    if (!fin) return false
    ajuste.current = true
    // l'inclinaison voulue : la carte la rabote selon le zoom (en glissant, image par image : elle se relève en
    // approchant), comme on l'a fait pour cadrer
    const vue = { center: [fin.lon, fin.lat] as [number, number], zoom: fin.zoom, pitch, bearing: fin.bearing }
    if (anime) {
      c.easeTo({ ...vue, duration: 750 })
      programme.current = true
    } else c.jumpTo(vue)
    return true
  }

  // la carte, une seule fois (la bibliothèque n'est chargée qu'ici)
  useEffect(() => {
    let fini = false
    void (async () => {
      try {
        const maplibre = await chargerMapLibre()
        if (fini || !boite.current) return
        // personne ne partage sa position : nos adresses, s'il y en a ; sinon la France
        const c = cadre(points.length ? points.map((x) => x.p) : [...endroits])
        // de loin, la carte à plat ; elle se relève en approchant (Elisa, 26 novembre : « ça fait bizarre les
        // bandes ») : inclinée de loin, elle regardait au-delà du pôle. MapLibre passe ici à chaque changement de
        // vue (les doigts, nos mouvements, et même un saut) : on lui donne toujours l'inclinaison voulue, et c'est
        // ici qu'elle est rabotée selon le zoom. Une autre inclinaison demandée (les doigts, le bouton, un cadrage)
        // devient la voulue ; un simple zoom la garde (la 3D revient toute seule en se rapprochant).
        const incliner = ({ zoom, pitch }: { zoom: number; pitch: number }) => {
          if (calcul.current) return {}
          // ni ce que le mouvement demandait juste avant, ni ce que la carte montrait (un mouvement repart de là)
          if (propose.current !== null && Math.abs(pitch - propose.current) > 0.05 && Math.abs(pitch - rendue.current) > 0.05) {
            voulue.current = pitch
            if (!programme.current) suivreRelief()
          }
          propose.current = pitch
          const permise = Math.min(voulue.current, penteMax(zoom))
          rendue.current = permise
          return Math.abs(permise - pitch) > 0.01 ? { pitch: permise } : {}
        }
        const nouvelle = new maplibre.Map({
          container: boite.current,
          style: urlStyleCarte(),
          ...(c ? { bounds: c, fitBoundsOptions: { padding: MARGES, maxZoom: 15 } } : { center: [2.4, 46.6], zoom: 4.6 }),
          pitch: voulue.current,
          maxPitch: PENTE_MAX,
          // un monde sans bords : au plus loin, il remplit le cadre (ni vide au-dessus, ni glace en dessous)
          maxBounds: MONDE,
          transformCameraUpdate: incliner,
          cooperativeGestures: BUREAU,
          locale: AIDE_ZOOM,
          attributionControl: { compact: true },
        })
        // tout le monde dans la carte, en perspective si elle est inclinée (avant même d'être dessinée)
        recadrer(nouvelle, false)
        propose.current = rendue.current = nouvelle.getPitch()
        // un fond qui ne se charge pas (hors ligne) : la carte reste, sans planter
        nouvelle.on('error', () => undefined)
        // bougée du doigt : elle ne se recadre plus toute seule
        nouvelle.on('movestart', (e) => {
          if (calcul.current || !(e as { originalEvent?: unknown }).originalEvent) return
          ajuste.current = false
          programme.current = false
          setPuce(null)
        })
        // la boussole suit l'orientation de la carte
        nouvelle.on('rotate', () => {
          if (calcul.current) return
          const b = nouvelle.getBearing()
          if (aiguille.current) aiguille.current.style.transform = `rotate(${-b}deg)`
          const n = Math.abs(b) < 0.5
          if (n !== nordVu.current) {
            nordVu.current = n
            setNord(n)
          }
        })
        // la 3D possible à ce zoom (le bouton), et la carte vraiment inclinée (l'ombre sous les repères)
        const vue3d = () => {
          if (calcul.current) return
          const ok = penteMax(nouvelle.getZoom()) >= SEUIL_3D
          if (ok !== troisDVu.current) {
            troisDVu.current = ok
            setTroisD(ok)
          }
          const pe = nouvelle.getPitch() >= SEUIL_3D
          if (pe !== pencheVu.current) {
            pencheVu.current = pe
            setPenche(pe)
          }
        }
        nouvelle.on('zoom', vue3d)
        nouvelle.on('pitch', vue3d)
        vue3d()
        nouvelle.on('moveend', (e) => {
          if (calcul.current) return
          programme.current = false
          propose.current = rendue.current = nouvelle.getPitch()
          suivreRelief()
          vue3d()
          // incliner ou redresser la carte aux doigts : c'est gardé pour la prochaine fois
          if ((e as { originalEvent?: unknown }).originalEvent) choisirRelief(voulue.current >= SEUIL_3D)
        })
        // pas de carte au bout de 12 s (hors ligne, travailleur refusé) : on le dit, la liste reste là
        const t = window.setTimeout(() => !fini && setPanne(true), 12000)
        nouvelle.once('load', () => {
          window.clearTimeout(t)
          setPanne(false)
          // les crédits (© OpenStreetMap…) bien lisibles à l'ouverture, puis rangés sous le « i » au bout de 5 s
          // (les règles d'OpenStreetMap le permettent : osmfoundation.org/wiki/Attribution) ; le bas de la carte se
          // dégage. MapLibre fait déjà pareil dès qu'on la bouge.
          window.setTimeout(() => boite.current?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'), 5000)
          // les bâtiments en relief (sous les noms de rues), et une lumière douce
          try {
            const style = nouvelle.getStyle()
            const source = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0]
            if (source && !nouvelle.getLayer(COUCHE_BATIMENTS)) nouvelle.addLayer(coucheBatiments(source), avantLesNoms(style.layers))
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

  // une position approximative : un halo bleu, à 1 km près (la tête est au centre, pas à l'endroit exact)
  const cleFlous = points.filter((x) => x.p.approx).map((x) => `${x.p.lat},${x.p.lon},${x.p.precision_m}`).join('|')
  useEffect(() => {
    const c = carte.current
    if (!c || !chargee) return
    const data = {
      type: 'FeatureCollection' as const,
      features: points
        .filter((x) => x.p.approx)
        .map((x) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [cercle(x.p, Math.max(x.p.precision_m ?? 0, 1000))] } })),
    }
    try {
      const src = c.getSource('flous') as GeoJSONSource | undefined
      if (src) src.setData(data)
      else {
        const dessous = c.getLayer(COUCHE_BATIMENTS) ? COUCHE_BATIMENTS : undefined
        c.addSource('flous', { type: 'geojson', data })
        c.addLayer({ id: 'flous-zone', type: 'fill', source: 'flous', paint: { 'fill-color': '#2F7FD0', 'fill-opacity': 0.09 } }, dessous)
        c.addLayer({ id: 'flous-bord', type: 'line', source: 'flous', paint: { 'line-color': '#2F7FD0', 'line-opacity': 0.4, 'line-width': 1.4, 'line-dasharray': [2, 2] } }, dessous)
      }
    } catch {
      /* pas de halo : la liste dit « à 1 km près » */
    }
  }, [cleFlous, chargee]) // eslint-disable-line react-hooks/exhaustive-deps

  // touché dans la liste : on va vers lui (ou vers l'adresse) ; en 3D, d'un peu plus près, pour voir les bâtiments
  useEffect(() => {
    if (!focus) return
    const e = focus.id.startsWith('endroit:') ? endroits.find((y) => `endroit:${y.id}` === focus.id) : null
    const x = e ? { lat: e.lat, lon: e.lon } : points.find((y) => y.m.id === focus.id)?.p
    if (!x || !carte.current) return
    ajuste.current = false
    setPuce(e ? null : focus.id)
    carte.current.flyTo({ center: [x.lon, x.lat], zoom: reliefVu.current ? 16 : 15, pitch: voulue.current, duration: 900 })
    programme.current = true
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Le bouton 3D : la carte s'incline (ou se remet à plat), tout le monde reste dedans si elle montrait le cadrage.
   *  De loin, il est grisé : la carte reste à plat jusqu'à ce qu'on se rapproche. */
  const basculer = () => {
    const c = carte.current
    if (!c || !troisDVu.current) return
    select()
    const vers = reliefVu.current ? 0 : PENTE
    choisirRelief(vers > 0)
    voulue.current = vers
    reliefVu.current = vers > 0
    setRelief(vers > 0)
    if (!(ajuste.current && recadrer(c, true, vers))) {
      c.easeTo({ pitch: vers, duration: 750 })
      programme.current = true
    }
  }

  /** Le plein écran : la même carte quitte son cadre et prend tout l'écran (elle s'ouvre depuis son cadre), puis y
   *  revient. Tout le monde reste dedans si personne ne l'a bougée. */
  const agrandir = (oui: boolean) => {
    const c = carte.current
    const el = scene.current
    const pl = place.current
    if (!c || !el || !pl || oui === pleinVu.current) return
    select()
    const doux = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // le cadre de la carte dans la page, vu depuis l'écran entier : le début (ou la fin) de l'animation
    const decoupe = () => {
      const p = pl.getBoundingClientRect()
      const e = el.getBoundingClientRect()
      return `inset(${p.top - e.top}px ${e.right - p.right}px ${e.bottom - p.bottom}px ${p.left - e.left}px round 20px)`
    }
    const entier = 'inset(0px 0px 0px 0px round 0px)'
    if (oui) {
      sur.current = zonesSures()
      pleinVu.current = true
      if (BUREAU) c.cooperativeGestures.disable()
      setPuce(ajuste.current ? 'tous' : null)
      flushSync(() => setPlein(true))
      c.resize()
      if (ajuste.current) recadrer(c, false)
      if (doux) el.animate([{ clipPath: decoupe() }, { clipPath: entier }], { duration: 380, easing: COURBE })
      reduire.current?.focus({ preventScroll: true })
      return
    }
    const fin = () => {
      pleinVu.current = false
      if (BUREAU) c.cooperativeGestures.enable()
      setPuce(null)
      flushSync(() => setPlein(false))
      anim?.cancel()
      c.resize()
      if (ajuste.current) recadrer(c, false)
    }
    const anim = doux ? el.animate([{ clipPath: entier }, { clipPath: decoupe() }], { duration: 300, easing: COURBE, fill: 'forwards' }) : null
    if (anim) anim.onfinish = fin
    else fin()
  }

  // en plein écran : Échap réduit la carte (sans fermer la page) ; la page, derrière, ne défile plus, et passe
  // devant sa barre du haut (la carte en est une enfant : elle couvre ainsi tout l'écran, barre d'état comprise)
  useLayoutEffect(() => {
    if (!plein) return
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      agrandir(false)
    }
    window.addEventListener('keydown', touche, true)
    const page = place.current?.closest<HTMLElement>('.overflow-y-auto')
    const avant = { o: page?.style.overflowY ?? '', z: page?.style.zIndex ?? '' }
    if (page) {
      page.style.overflowY = 'hidden'
      page.style.zIndex = '35'
    }
    return () => {
      window.removeEventListener('keydown', touche, true)
      if (page) {
        page.style.overflowY = avant.o
        page.style.zIndex = avant.z
      }
    }
  }, [plein]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Une puce du bas : on va vers lui ; « Tout le monde » remontre toute la famille. */
  const aller = (id: string) => {
    const c = carte.current
    if (!c) return
    select()
    setPuce(id)
    if (id === 'tous') {
      ajuste.current = true
      recadrer(c, true)
      return
    }
    const x = points.find((y) => y.m.id === id)?.p
    if (!x) return
    ajuste.current = false
    c.flyTo({ center: [x.lon, x.lat], zoom: reliefVu.current ? 16 : 15, pitch: voulue.current, duration: 900 })
    programme.current = true
  }
  const bandeau = plein && points.length > 0

  return (
    // la place de la carte dans la page : elle la garde quand la carte passe en plein écran
    <div ref={place} className="relative" style={{ height: hauteur }}>
      <div
        ref={scene}
        className={`carte-famille bg-[#F8F4F0] ${plein ? `plein fixed inset-0 z-[70] ${bandeau ? 'avec-bandeau' : ''}` : 'absolute inset-0 overflow-hidden rounded-[20px]'}`}
        role={plein ? 'dialog' : undefined}
        aria-modal={plein || undefined}
        aria-label={plein ? 'Carte de mes proches en plein écran' : undefined}
      >
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
            <Repere m={x.m} moi={id === moi} pale={pale} relief={penche} />,
            el,
            id,
          )
        })}
        {panne && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">
            <MapPin size={26} className="text-pale" />
            <p className="text-sous font-semibold text-brume">La carte ne s’affiche pas pour le moment</p>
          </div>
        )}
        {/* personne sur la carte (ni nos lieux) : les têtes à venir, et ce qu'il faut pour commencer (Elisa,
            26 novembre : « j'aime pas le mot "personne ne partage" ») ; le bouton est juste sous la carte */}
        {!panne && !points.length && !endroits.length && (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center px-6">
            <div className="verre flex max-w-[260px] flex-col items-center rounded-[24px] px-5 pb-3.5 pt-4 text-center">
              <TetesAVenir />
              <p className="mt-2.5 text-corps font-bold text-encre">Vos têtes apparaîtront ici</p>
              <p className="mt-1 text-note text-brume">{plein ? 'Quand vous partagerez votre position.' : 'Partage ta position pour commencer.'}</p>
            </div>
          </div>
        )}
        {/* personne sur la carte, mais nos lieux y sont : on le dit en bas, sans les cacher (au-dessus des crédits,
            écrits en entier les premières secondes) */}
        {!panne && !points.length && endroits.length > 0 && (
          <p className="verre pointer-events-none absolute bottom-10 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-3.5 text-note font-semibold text-encre" style={plein ? { bottom: 'calc(var(--sab) + 44px)' } : undefined}>
            <GoutteVide size={14} />
            Vos têtes apparaîtront ici
          </p>
        )}
        {/* le liseré du cadre, dans la page */}
        {!plein && <span className="pointer-events-none absolute inset-0 z-[6] rounded-[20px] ring-1 ring-inset ring-encre/[0.06]" aria-hidden="true" />}
        {/* en plein écran : réduire, en haut à gauche (là où est « Retour » dans la page) */}
        {plein && (
          <button ref={reduire} onClick={() => agrandir(false)} aria-label="Réduire la carte" className="presse verre absolute left-3 z-[7] flex h-11 w-11 items-center justify-center rounded-full text-encre" style={{ top: 'calc(var(--sat) + 8px)' }}>
            <X size={21} strokeWidth={2.6} />
          </button>
        )}
        {/* en haut à droite, comme dans Plans : 3D ou à plat, ma position, le plein écran, et la boussole quand la
            carte est tournée */}
        {prete && !panne && (
          <div className={`absolute z-[7] flex flex-col items-center gap-2 ${plein ? 'right-3' : 'right-2.5 top-2.5'}`} style={plein ? { top: 'calc(var(--sat) + 10px)' } : undefined}>
            <div className="verre flex w-10 flex-col overflow-hidden rounded-full">
              {/* de loin, la 3D n'est pas possible (la carte reste à plat) : grisé, il revient en se rapprochant */}
              <button
                onClick={basculer}
                disabled={!troisD}
                aria-label={!troisD ? 'Vue 3D : rapproche-toi pour l’activer' : relief ? 'Voir la carte à plat' : 'Voir la carte en 3D'}
                className="presse flex h-10 w-10 items-center justify-center disabled:opacity-35"
              >
                <span key={troisD && relief ? 'plat' : 'relief'} className="anim-pop text-[14px] font-extrabold tracking-[-0.2px] text-teinte-fonce">
                  {troisD && relief ? '2D' : '3D'}
                </span>
              </button>
              {onMoi && (
                <>
                  <span className="mx-2.5 h-px bg-encre/10" aria-hidden="true" />
                  <button onClick={() => (select(), onMoi())} aria-label="Revenir sur ma position" className="presse flex h-10 w-10 items-center justify-center text-teinte-fonce">
                    <LocateFixed size={19} strokeWidth={2.4} />
                  </button>
                </>
              )}
              {!plein && (
                <>
                  <span className="mx-2.5 h-px bg-encre/10" aria-hidden="true" />
                  <button onClick={() => agrandir(true)} aria-label="Agrandir la carte" className="presse flex h-10 w-10 items-center justify-center text-teinte-fonce">
                    <Maximize2 size={17} strokeWidth={2.6} />
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
        {/* en plein écran, en bas : chacun d'un toucher (comme la liste de la page), et « Tout le monde » */}
        {bandeau && (
          <div className="absolute inset-x-0 bottom-0 z-[7]" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
            <div className="no-bar flex gap-2 overflow-x-auto px-3 pb-1 pt-2" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }} role="group" aria-label="Aller vers">
              {points.length > 1 && (
                <PuceCarte actif={puce === 'tous'} onClick={() => aller('tous')}>
                  <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full ${puce === 'tous' ? 'bg-white/20 text-white' : 'bg-teinte-doux text-teinte-fonce'}`}>
                    <Users size={20} strokeWidth={2.4} />
                  </span>
                  <span className="whitespace-nowrap text-note font-bold">Tout le monde</span>
                </PuceCarte>
              )}
              {points.map((x) => {
                const nom = x.m.id === moi ? 'Moi' : x.m.display_name
                return (
                  <PuceCarte key={x.m.id} actif={puce === x.m.id} onClick={() => aller(x.m.id)} label={`Aller vers ${x.m.id === moi ? 'ma position' : x.m.display_name}`}>
                    <Avatar m={x.m} size={42} />
                    <span className="min-w-0">
                      <span className="block max-w-[132px] truncate text-note font-bold">{nom}</span>
                      <span className={`block max-w-[132px] truncate text-mini ${puce === x.m.id ? 'text-white/85' : 'text-brume'}`}>{endroitDe(x.p, endroits)?.nom ?? x.p.ville ?? libelle(x.p)}</span>
                    </span>
                  </PuceCarte>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Une puce du bas de la carte en plein écran : sur du verre, violette quand c'est elle qu'on regarde. */
function PuceCarte({ actif, onClick, label, children }: { actif: boolean; onClick: () => void; label?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      aria-label={label}
      className={`presse flex h-[52px] shrink-0 items-center gap-2 rounded-full py-[5px] pl-[5px] pr-4 text-left shadow-[0_6px_18px_-6px_rgba(29,26,43,0.35)] transition-colors duration-200 ${actif ? 'bg-teinte text-white' : 'verre text-encre'}`}
    >
      {children}
    </button>
  )
}
