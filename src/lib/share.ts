import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { PUBLIC_URL } from '../config'

export function inviteLink(code: string): string {
  const base = Capacitor.isNativePlatform() ? PUBLIC_URL : `${location.origin}${location.pathname}`
  return `${base}?code=${code}`
}

/** Partage l'invitation ; renvoie 'copie' si on a dû se rabattre sur le presse-papiers. */
export async function shareInvite(familyName: string, code: string): Promise<'partage' | 'copie' | 'annule'> {
  const url = inviteLink(code)
  const text = `Rejoins la maison de la famille ${familyName} sur NIDOO. Code : ${code}`
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: 'NIDOO', text, url })
      return 'partage'
    }
    if (navigator.share) {
      await navigator.share({ title: 'NIDOO', text, url })
      return 'partage'
    }
  } catch {
    return 'annule'
  }
  return (await copy(`${text}\n${url}`)) ? 'copie' : 'annule'
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
