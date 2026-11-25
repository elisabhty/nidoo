// Les mois du calendrier de l'appli (src/components/choixDate.tsx) : des dates en texte « 2026-11-22 », sans heure
// ni fuseau, pour ne jamais glisser d'un jour.
export type Mois = { a: number; m: number } // m : 0 (janvier) à 11 (décembre)

const pad = (n: number) => String(n).padStart(2, '0')
export const isoJour = (a: number, m: number, j: number) => `${a}-${pad(m + 1)}-${pad(j)}`
export const isoDe = (d: Date) => isoJour(d.getFullYear(), d.getMonth(), d.getDate())

/** Le mois d'une date « 2026-11-22 » ; illisible : le mois de `secours`. */
export function moisDe(iso: string, secours = new Date()): Mois {
  const r = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso)
  const m = r ? Number(r[2]) - 1 : -1
  return r && m >= 0 && m <= 11 ? { a: Number(r[1]), m } : { a: secours.getFullYear(), m: secours.getMonth() }
}

/** Le mois d'avant ou d'après ; `memeAnnee` : après décembre vient janvier de la même année (un anniversaire n'a pas d'année). */
export function decalerMois(v: Mois, d: number, memeAnnee = false): Mois {
  const n = v.a * 12 + v.m + d
  const m = ((n % 12) + 12) % 12
  return { a: memeAnnee ? v.a : Math.floor(n / 12), m }
}

/** Les 42 cases du mois (six semaines, du lundi au dimanche) : la date de chaque jour, null avant le 1er et après le dernier. */
export function grilleDuMois(a: number, m: number): (string | null)[] {
  const avant = (new Date(a, m, 1).getDay() + 6) % 7 // lundi = 0
  const jours = new Date(a, m + 1, 0).getDate()
  return Array.from({ length: 42 }, (_, i) => (i >= avant && i < avant + jours ? isoJour(a, m, i - avant + 1) : null))
}
