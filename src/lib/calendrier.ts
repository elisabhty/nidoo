import type { FamEvent } from './types'
import { finDe, nextOccurrence } from './util'

// « Ajouter à mon calendrier » : un petit fichier .ics que l'iPhone (ou Google Agenda) sait ouvrir.
// Il garde l'heure, le lieu, les détails, et la répétition (chaque semaine, chaque année).

const deux = (n: number) => String(n).padStart(2, '0')
const jourIcs = (d: Date) => `${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}`
const heureUtc = (d: Date) => `${d.getUTCFullYear()}${deux(d.getUTCMonth() + 1)}${deux(d.getUTCDate())}T${deux(d.getUTCHours())}${deux(d.getUTCMinutes())}00Z`
/** Dans un .ics, virgules, points-virgules et retours à la ligne s'échappent. */
const texte = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n')

export function fichierIcs(e: FamEvent): string {
  const debut = e.yearly || e.weekly ? nextOccurrence(e) : new Date(e.starts_at)
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIDOO//Agenda de la famille//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${e.id}@nidoo`, `DTSTAMP:${heureUtc(new Date())}`]
  if (e.all_day) {
    const lendemainFin = finDe(e, debut)
    lendemainFin.setDate(lendemainFin.getDate() + 1) // la fin d'une journée entière est exclue
    lignes.push(`DTSTART;VALUE=DATE:${jourIcs(debut)}`, `DTEND;VALUE=DATE:${jourIcs(lendemainFin)}`)
  } else {
    lignes.push(`DTSTART:${heureUtc(debut)}`, `DTEND:${heureUtc(new Date(debut.getTime() + 60 * 60000))}`)
  }
  if (e.yearly) lignes.push('RRULE:FREQ=YEARLY')
  if (e.weekly) lignes.push('RRULE:FREQ=WEEKLY')
  lignes.push(`SUMMARY:${texte(e.kind === 'anniversaire' ? `Anniversaire de ${e.title}` : e.title)}`)
  if (e.lieu) lignes.push(`LOCATION:${texte(e.lieu)}`)
  if (e.description) lignes.push(`DESCRIPTION:${texte(e.description)}`)
  if (!e.all_day) lignes.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${texte(e.title)}`, 'TRIGGER:-PT1H', 'END:VALARM')
  lignes.push('END:VEVENT', 'END:VCALENDAR')
  return lignes.join('\r\n')
}

/** Ouvre l'événement dans l'appli Calendrier (sur iPhone, Safari propose « Ajouter au calendrier »). */
export function ajouterAuCalendrier(e: FamEvent) {
  const blob = new Blob([fichierIcs(e)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${e.title.replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'evenement'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
