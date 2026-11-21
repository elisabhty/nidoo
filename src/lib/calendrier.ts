import { Capacitor } from '@capacitor/core'
import { pont } from './pont'
import type { FamEvent } from './types'
import { finDe, nextOccurrence, repeteDe } from './util'

// « Ajouter à mon calendrier » : un petit fichier .ics que l'iPhone (ou Google Agenda) sait ouvrir.
// Il garde l'heure, le lieu, les détails, et la répétition (chaque semaine, chaque année).
//
// Dans l'appli iPhone (iOS 17 et plus) : la fiche « Nouvel événement » du calendrier de l'iPhone s'ouvre par-dessus
// l'appli, déjà remplie (Elisa, 21 novembre : « si ce n'est pas Safari ? », et la barre de Safari en bas) : plus de
// navigateur du tout, quel que soit celui choisi par défaut. Sinon (iPhone plus ancien, appli pas encore mise à jour) :
// la page calendrier.html du site, l'événement rangé après le # (il ne part sur aucun serveur).

const deux = (n: number) => String(n).padStart(2, '0')
const jourIcs = (d: Date) => `${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}`
const heureUtc = (d: Date) => `${d.getUTCFullYear()}${deux(d.getUTCMonth() + 1)}${deux(d.getUTCDate())}T${deux(d.getUTCHours())}${deux(d.getUTCMinutes())}00Z`
/** Dans un .ics, virgules, points-virgules et retours à la ligne s'échappent. */
const texte = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n')

/** Le prénom fêté, sans un « Anniversaire de » déjà tapé dans le nom. */
export const prenomFete = (titre: string) => titre.replace(/^\s*anniversaire\s+(de\s+|d['’]\s*)/i, '').trim() || titre
/** « Anniversaire de Léa », « Anniversaire d’Elisa » ; les autres événements gardent leur nom. */
export const titreCalendrier = (e: Pick<FamEvent, 'kind' | 'title'>) => {
  if (e.kind !== 'anniversaire') return e.title
  const p = prenomFete(e.title)
  return /^[aeiouyàâéèêëîïôûü]/i.test(p) ? `Anniversaire d’${p}` : `Anniversaire de ${p}`
}

export function fichierIcs(e: FamEvent): string {
  const r = repeteDe(e)
  const debut = r ? nextOccurrence(e) : new Date(e.starts_at)
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIDOO//Agenda de la famille//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${e.id}@nidoo`, `DTSTAMP:${heureUtc(new Date())}`]
  if (e.all_day) {
    const lendemainFin = finDe(e, debut)
    lendemainFin.setDate(lendemainFin.getDate() + 1) // la fin d'une journée entière est exclue
    lignes.push(`DTSTART;VALUE=DATE:${jourIcs(debut)}`, `DTEND;VALUE=DATE:${jourIcs(lendemainFin)}`)
  } else {
    lignes.push(`DTSTART:${heureUtc(debut)}`, `DTEND:${heureUtc(new Date(debut.getTime() + 60 * 60000))}`)
  }
  const regle = { jour: 'FREQ=DAILY', semaine: 'FREQ=WEEKLY', '2semaines': 'FREQ=WEEKLY;INTERVAL=2', mois: 'FREQ=MONTHLY', annee: 'FREQ=YEARLY' } as const
  if (r) lignes.push(`RRULE:${regle[r]}`)
  lignes.push(`SUMMARY:${texte(titreCalendrier(e))}`)
  // le genre, pour la page « Ajouter au calendrier » (son image) ; les calendriers ignorent les lignes X-
  lignes.push(`X-NIDOO-GENRE:${e.kind}`)
  if (e.lieu) lignes.push(`LOCATION:${texte(e.lieu)}`)
  if (e.description) lignes.push(`DESCRIPTION:${texte(e.description)}`)
  if (!e.all_day) lignes.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${texte(e.title)}`, 'TRIGGER:-PT1H', 'END:VALARM')
  lignes.push('END:VEVENT', 'END:VCALENDAR')
  return lignes.join('\r\n')
}

/** Le texte en base64 « pour adresse » (sans + / =), accents compris. */
export function versB64(s: string): string {
  const octets = new TextEncoder().encode(s)
  let bin = ''
  for (const o of octets) bin += String.fromCharCode(o)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const SITE = 'https://elisabhty.github.io/nidoo/'
const surIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** L'adresse de la page qui ajoute l'événement (ouverte dans Safari). */
export const pageCalendrier = (e: FamEvent) => `${Capacitor.isNativePlatform() ? SITE : new URL('./', location.href).href}calendrier.html#${versB64(fichierIcs(e))}`

/** La fiche du calendrier de l'iPhone, déjà remplie ; null si elle n'est pas disponible (on passe alors par la page). */
async function ficheNative(e: FamEvent): Promise<'ajoute' | 'annule' | null> {
  if (!pont) return null
  const r = repeteDe(e)
  const debut = r ? nextOccurrence(e) : new Date(e.starts_at)
  const fin = e.all_day ? finDe(e, debut) : new Date(debut.getTime() + 60 * 60000)
  try {
    const res = await pont.calendrier({
      titre: titreCalendrier(e),
      debut: debut.getTime(),
      fin: fin.getTime(),
      journee: e.all_day,
      lieu: e.lieu ?? undefined,
      notes: e.description ?? undefined,
      repete: r ?? undefined,
      rappel: !e.all_day,
    })
    return res.action
  } catch {
    return null
  }
}

/** Ajoute l'événement au calendrier du téléphone : la fiche de l'iPhone (« ajoute » / « annule »), sinon la page dans
 *  le navigateur (« safari »), sinon un fichier .ics (ordinateur). Hors appli, tout se fait tout de suite, dans le geste
 *  (sinon le navigateur bloquerait la fenêtre). */
export function ajouterAuCalendrier(e: FamEvent): Promise<'ajoute' | 'annule' | 'safari' | 'fichier'> {
  if (pont) return ficheNative(e).then((r) => r ?? parLaPage(e))
  return Promise.resolve(parLaPage(e))
}

function parLaPage(e: FamEvent): 'safari' | 'fichier' {
  if (Capacitor.isNativePlatform() || surIos()) {
    const url = pageCalendrier(e)
    // dans l'appli, une adresse d'ailleurs s'ouvre dans le navigateur ; sur le site, dans un nouvel onglet
    const w = window.open(url, '_blank')
    if (!w && !Capacitor.isNativePlatform()) location.href = url
    return 'safari'
  }
  const blob = new Blob([fichierIcs(e)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${e.title.replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'evenement'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  return 'fichier'
}
