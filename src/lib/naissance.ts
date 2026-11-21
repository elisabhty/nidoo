import type { Backend, FamEvent, Member } from './types'

// L'anniversaire qu'on donne à l'accueil (Elisa, 21 novembre) : il attend sur le téléphone (« MM-JJ »),
// puis s'ajoute tout seul à l'agenda de la maison, comme un anniversaire « chaque année », dès qu'on y entre.
// (Quand on rejoint une maison, on n'y est qu'après l'accord de la famille : d'où l'attente.)

const CLE = 'nidoo.naissance'

export function retenirNaissance(mmjj: string | null) {
  try {
    if (mmjj) localStorage.setItem(CLE, mmjj)
    else localStorage.removeItem(CLE)
  } catch {
    /* tant pis : on pourra l'ajouter depuis l'agenda */
  }
}

export function naissanceEnAttente(): string | null {
  try {
    const v = localStorage.getItem(CLE)
    return v && /^\d{2}-\d{2}$/.test(v) ? v : null
  } catch {
    return null
  }
}

const plat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/^anniversaire\s+(de\s+|d['’]\s*)/, '')

/** L'anniversaire d'un membre déjà dans l'agenda (lié à lui, ou à son prénom). */
export const anniversaireDe = (m: Pick<Member, 'id' | 'display_name'>, events: FamEvent[]) =>
  events.find((e) => e.kind === 'anniversaire' && (((e.members ?? []).length === 1 && e.members![0] === m.id) || plat(e.title) === plat(m.display_name)))

let enCours = false
/** Ajoute l'anniversaire en attente à la maison ouverte (une seule fois). Renvoie vrai s'il a été ajouté. */
export async function ajouterNaissance(api: Backend, familyId: string, me: Member, events: FamEvent[]): Promise<boolean> {
  const mmjj = naissanceEnAttente()
  if (!mmjj || enCours) return false
  if (anniversaireDe(me, events)) {
    retenirNaissance(null)
    return false
  }
  enCours = true
  try {
    const [mm, jj] = mmjj.split('-').map(Number)
    const d = new Date(new Date().getFullYear(), mm - 1, jj, 9)
    await api.addEvent(familyId, me.id, { title: me.display_name, kind: 'anniversaire', starts_at: d.toISOString(), all_day: true, yearly: true, members: [me.id] })
    retenirNaissance(null)
    return true
  } catch {
    return false // on réessaiera au prochain lancement
  } finally {
    enCours = false
  }
}
