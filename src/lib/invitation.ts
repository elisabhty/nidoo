// Le code d'invitation de la maison.
// - Seuls les responsables le voient et le partagent ; les autres membres voient des points à sa place
//   (Elisa, 25 novembre : « mets des points noirs… en gros personne peut voir à part le créateur »).
// - Il vaut 7 jours. Quand il expire, un nouveau le remplace tout seul dès qu'un responsable ouvre l'appli, et
//   s'affiche directement : ni code barré, ni message d'attente (« renouvelle le code automatiquement, il faut pas
//   qu'il soit barré avec le message »).
// Rien de ceci ne touche à la base : c'est elle qui réserve la création d'un code aux responsables (renew_invite).
import type { Backend, Family, Member } from './types'

type Code = Pick<Family, 'id' | 'invite_code' | 'invite_expires_at'>

/** Qui voit et partage le code : les responsables de la maison (celui ou celle qui l'a créée, et ceux qu'il a nommés). */
export const voitLeCode = (moi: Pick<Member, 'role'>) => moi.role === 'responsable'

export const codeExpire = (f: Pick<Family, 'invite_code' | 'invite_expires_at'>, maintenant = Date.now()) =>
  !f.invite_code || !(new Date(f.invite_expires_at).getTime() > maintenant)

/** Dans combien de temps le code expire (ms) ; 0 s'il a déjà expiré. */
export const resteAvantExpiration = (f: Pick<Family, 'invite_expires_at'>, maintenant = Date.now()) => {
  const t = new Date(f.invite_expires_at).getTime()
  return Number.isFinite(t) ? Math.max(0, t - maintenant) : 0
}

const PAUSE = 60_000 // sans réseau, on ne redemande pas un code à chaque rendu
const dernierEchec = new Map<string, number>()
const enCours = new Map<string, Promise<Code | null>>()

/**
 * Un code valable pour cette maison, pour un responsable : le sien, ou un neuf si le sien a expiré.
 * null : pas de code (on n'est pas responsable, ou le réseau manque).
 * `insister` : l'utilisateur vient de toucher un bouton, on réessaie même après un échec récent.
 */
export function codeValable(api: Pick<Backend, 'circles' | 'renewInvite'>, f: Code, responsable: boolean, insister = false): Promise<Code | null> {
  if (!responsable) return Promise.resolve(null)
  if (!codeExpire(f)) return Promise.resolve(f)
  const deja = enCours.get(f.id)
  if (deja) return deja
  if (!insister && Date.now() - (dernierEchec.get(f.id) ?? 0) < PAUSE) return Promise.resolve(null)
  const lire = async () => (await api.circles()).find((c) => c.family.id === f.id)?.family ?? null
  const p = (async () => {
    try {
      // un autre responsable (ou un autre de mes appareils) l'a peut-être déjà renouvelé : on ne le change pas deux fois
      let neuf = await lire()
      if (!neuf || codeExpire(neuf)) {
        await api.renewInvite(f.id)
        neuf = await lire()
      }
      if (!neuf || codeExpire(neuf)) throw new Error('CODE_EXPIRE')
      dernierEchec.delete(f.id)
      return neuf
    } catch {
      dernierEchec.set(f.id, Date.now())
      return null
    } finally {
      enCours.delete(f.id)
    }
  })()
  enCours.set(f.id, p)
  return p
}
