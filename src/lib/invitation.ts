// Le code d'invitation vaut 7 jours. Quand il expire, un nouveau le remplace tout seul et s'affiche directement :
// on ne montre jamais un code barré ni un message d'attente (Elisa, 25 novembre : « renouvelle le code
// automatiquement, il faut pas qu'il soit barré avec le message », puis « tu peux le mettre directement »).
// La base le fait pour tout membre (renew_invite_if_expired) ; tant qu'elle ne connaît pas cette fonction, seul un
// responsable peut créer un code (renew_invite).
import type { Backend, Family } from './types'

type Code = Pick<Family, 'id' | 'invite_code' | 'invite_expires_at'>

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
 * Un code valable pour cette maison : le sien, ou un neuf si le sien a expiré.
 * null : pas de code pour l'instant (le réseau manque, ou la base d'avant et on n'est pas responsable).
 * `insister` : l'utilisateur vient de toucher un bouton, on réessaie même après un échec récent.
 */
export function codeValable(api: Pick<Backend, 'circles' | 'renewInvite' | 'renewInviteIfExpired'>, f: Code, responsable: boolean, insister = false): Promise<Code | null> {
  if (!codeExpire(f)) return Promise.resolve(f)
  const deja = enCours.get(f.id)
  if (deja) return deja
  if (!insister && Date.now() - (dernierEchec.get(f.id) ?? 0) < PAUSE) return Promise.resolve(null)
  const lire = async () => (await api.circles()).find((c) => c.family.id === f.id)?.family ?? null
  const p = (async () => {
    try {
      // la base ne change le code que s'il a expiré : deux écrans, ou deux membres, n'en créent pas deux
      const connue = await api.renewInviteIfExpired(f.id)
      let neuf = await lire()
      if (!connue && responsable && (!neuf || codeExpire(neuf))) {
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
