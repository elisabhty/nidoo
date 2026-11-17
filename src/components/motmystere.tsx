import { useEffect, useMemo, useState } from 'react'
import { select, success, tap } from '../lib/haptic'
import { MOT_ESSAIS, type MotMoi } from '../lib/parties'
import { jouer } from '../lib/sons'
import { useHome } from '../lib/store'
import { errorText } from '../lib/util'
import { Avatar, Page } from './ui'

// Le mot mystère du jour : le même mot de 5 lettres pour toute la famille, 6 essais.
// Chacun voit ses lettres ; de la famille, on ne voit que les couleurs (pour ne rien dévoiler).

const COULEUR: Record<string, string> = { '2': '#7A5AE0', '1': '#FF8A7A', '0': '#CFCBDB' }
const RANGEES = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN']

export function useMotMoi() {
  const { state, api } = useHome()
  const [moi, setMoi] = useState<MotMoi | null>(null)
  const ligne = state.mot.find((l) => l.member_id === state.me.id)
  const n = ligne?.motifs.length ?? 0
  useEffect(() => {
    let vivant = true
    api.motMesEssais(state.family.id).then(
      (m) => vivant && setMoi(m),
      () => undefined,
    )
    return () => {
      vivant = false
    }
  }, [api, state.family.id, n])
  return { moi, ligne }
}

export function MotPage({ onClose }: { onClose: () => void }) {
  const { state, api, reload, toast } = useHome()
  const { moi, ligne } = useMotMoi()
  const [saisie, setSaisie] = useState('')
  const [busy, setBusy] = useState(false)
  const [bulle, setBulle] = useState<string | null>(null)
  const motifs = ligne?.motifs ?? []
  const mots = moi?.mots ?? []
  const fini = !!ligne?.trouve || motifs.length >= MOT_ESSAIS || !!moi?.solution

  const touches = useMemo(() => {
    const t: Record<string, string> = {}
    mots.forEach((w, i) =>
      [...w].forEach((ch, k) => {
        const v = motifs[i]?.[k] ?? '0'
        if (!t[ch] || v > t[ch]) t[ch] = v
      }),
    )
    return t
  }, [mots, motifs])

  const tape = (ch: string) => {
    if (fini || busy) return
    select()
    setSaisie((s) => (s.length < 5 ? s + ch : s))
  }
  const efface = () => {
    tap()
    setSaisie((s) => s.slice(0, -1))
  }
  const valide = async () => {
    if (saisie.length !== 5 || busy || fini) return
    setBusy(true)
    try {
      const r = await api.motEssai(state.family.id, saisie)
      setSaisie('')
      await reload()
      if (r.trouve) {
        success()
        jouer('etoiles')
        setBulle('Bravo ! +2 étoiles pour la maison')
      } else if (r.solution) setBulle(`Le mot était ${r.solution}`)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }
  // le clavier de l'ordinateur marche aussi
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return
      if (e.key === 'Enter') void valide()
      else if (e.key === 'Backspace') efface()
      else if (/^[a-zA-Z]$/.test(e.key)) tape(e.key.toUpperCase())
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const autres = state.members.filter((m) => m.user_id && m.id !== state.me.id)
  const lignes = Array.from({ length: MOT_ESSAIS }, (_, i) => i)

  return (
    <Page title="Mot mystère" onClose={onClose}>
      <p className="-mt-1 px-5 text-sous text-brume">Le même mot de 5 lettres pour toute la famille, aujourd’hui. Six essais pour le trouver.</p>
      <div className="mx-auto mt-4 grid w-[min(300px,78vw)] gap-1.5">
        {lignes.map((i) => {
          const w = i < mots.length ? mots[i] : i === mots.length && !fini ? saisie.padEnd(5, ' ') : '     '
          const m = motifs[i]
          return (
            <div key={i} className="grid grid-cols-5 gap-1.5">
              {[...w].map((ch, k) => (
                <span
                  key={k}
                  className="flex aspect-square items-center justify-center rounded-[10px] font-rond text-[24px] font-bold"
                  style={{
                    background: m ? COULEUR[m[k]] : '#FFFFFF',
                    color: m ? (m[k] === '0' ? '#5E5A70' : '#fff') : '#2B2540',
                    boxShadow: m ? 'inset 0 -3px 0 rgba(0,0,0,0.1)' : ch.trim() ? 'inset 0 0 0 2px #B9A6F5' : 'inset 0 0 0 1.5px #E4E0EE',
                    animation: m && i === mots.length - 1 ? `jeuTuile 0.4s ease-out ${k * 0.08}s both` : undefined,
                  }}
                >
                  {ch.trim()}
                </span>
              ))}
            </div>
          )
        })}
      </div>
      <style>{'@keyframes jeuTuile { from { transform: rotateX(90deg); } to { transform: rotateX(0); } }'}</style>
      {bulle && <p className="anim-pop mx-auto mt-3 w-fit rounded-full bg-teinte px-4 py-1.5 text-sous font-semibold text-white">{bulle}</p>}
      {fini && !bulle && <p className="mt-3 text-center text-sous font-semibold text-teinte-fonce">{ligne?.trouve ? `Trouvé en ${motifs.length} essai${motifs.length > 1 ? 's' : ''} !` : moi?.solution ? `Le mot était ${moi.solution}` : 'Grille finie'} Nouveau mot demain.</p>}

      {!fini && (
        <div className="mx-2 mt-4 flex flex-col gap-1.5">
          {RANGEES.map((r, ri) => (
            <div key={r} className="flex justify-center gap-1">
              {ri === 2 && (
                <button onClick={() => void valide()} disabled={saisie.length !== 5 || busy} className="presse h-12 rounded-[10px] bg-teinte px-2.5 text-mini font-bold text-white disabled:opacity-40">
                  ENTRÉE
                </button>
              )}
              {[...r].map((ch) => (
                <button
                  key={ch}
                  onClick={() => tape(ch)}
                  className="presse h-12 w-[8.6vw] max-w-[38px] rounded-[10px] text-sous font-bold"
                  style={{ background: touches[ch] ? COULEUR[touches[ch]] : '#FFFFFF', color: touches[ch] && touches[ch] !== '0' ? '#fff' : touches[ch] === '0' ? '#8A869A' : '#2B2540', boxShadow: '0 2px 0 rgba(0,0,0,0.08)' }}
                >
                  {ch}
                </button>
              ))}
              {ri === 2 && (
                <button onClick={efface} disabled={!saisie || busy} aria-label="Effacer une lettre" className="presse h-12 rounded-[10px] bg-white px-2.5 text-mini font-bold text-encre shadow-[0_2px_0_rgba(0,0,0,0.08)] disabled:opacity-40">
                  EFFACER
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mx-5 mt-5 flex justify-center gap-3 text-mini text-brume">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[4px]" style={{ background: COULEUR['2'] }} /> bien placée</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[4px]" style={{ background: COULEUR['1'] }} /> ailleurs</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[4px]" style={{ background: COULEUR['0'] }} /> absente</span>
      </div>

      <p className="entete mt-6">La famille aujourd’hui</p>
      <div className="groupe mx-4 mb-6 shadow-carte">
        {autres.length === 0 && <p className="p-4 text-note text-brume">Invite des proches pour jouer au même mot.</p>}
        {autres.map((m, i) => {
          const l = state.mot.find((x) => x.member_id === m.id)
          return (
            <div key={m.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${i < autres.length - 1 ? 'border-b border-trait' : ''}`}>
              <Avatar m={m} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sous font-semibold">{m.display_name}</span>
                <span className="block text-note text-brume">{!l ? 'Pas encore joué' : l.trouve ? `Trouvé en ${l.motifs.length}` : l.motifs.length >= MOT_ESSAIS ? 'Pas trouvé' : `${l.motifs.length} essai${l.motifs.length > 1 ? 's' : ''}…`}</span>
              </span>
              {l && (
                <span className="grid gap-[2px]">
                  {l.motifs.map((mo, k) => (
                    <span key={k} className="flex gap-[2px]">
                      {[...mo].map((c, j) => (
                        <span key={j} className="block h-[7px] w-[7px] rounded-[2px]" style={{ background: COULEUR[c] }} />
                      ))}
                    </span>
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Page>
  )
}

/** L'entrée du mot mystère, en haut des jeux. */
export function MotCarte({ onOpen }: { onOpen: () => void }) {
  const { state } = useHome()
  const moi = state.mot.find((l) => l.member_id === state.me.id)
  const trouves = state.mot.filter((l) => l.trouve && l.member_id !== state.me.id).length
  const statut = !moi ? 'Le mot du jour t’attend' : moi.trouve ? `Trouvé en ${moi.motifs.length} essai${moi.motifs.length > 1 ? 's' : ''}` : moi.motifs.length >= MOT_ESSAIS ? 'Pas trouvé aujourd’hui' : `${moi.motifs.length} essai${moi.motifs.length > 1 ? 's' : ''} sur ${MOT_ESSAIS}`
  return (
    <button
      onClick={() => {
        tap()
        onOpen()
      }}
      className="presse mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[26px] p-3.5 text-left shadow-carte"
      style={{ background: 'linear-gradient(160deg, #F3EEFF, #FFF1EC)' }}
    >
      <img src="./art/jeu-mot.webp" alt="" className="h-14 w-14 shrink-0 object-contain" />
      <span className="min-w-0 flex-1">
        <span className="block font-rond text-titre3">Mot mystère du jour</span>
        <span className={`block text-note ${!moi ? 'font-semibold text-teinte' : 'text-brume'}`}>
          {statut}
          {trouves > 0 && ` · ${trouves} proche${trouves > 1 ? 's l’ont' : ' l’a'} trouvé`}
        </span>
      </span>
    </button>
  )
}
