// Les jours qu'on fête en France : les jours fériés, et ceux où la famille se retrouve
// (Épiphanie, Chandeleur, fête des mères, fête de la musique, Halloween, Noël…).
// Proposés en raccourci quand on ajoute un événement (Elisa, 21 novembre).

export type JourSpecial = { nom: string; date: Date; ferie?: boolean; titre?: string }

/** Pâques (calcul grégorien de Meeus/Jones/Butcher). */
export function paques(an: number): Date {
  const a = an % 19
  const b = Math.floor(an / 100)
  const c = an % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(an, mois - 1, jour, 12)
}

const jour = (an: number, mois: number, j: number) => new Date(an, mois, j, 12)
const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)
/** Le n-ième dimanche du mois (n = -1 : le dernier). */
function dimanche(an: number, mois: number, n: number): Date {
  if (n < 0) {
    const fin = jour(an, mois + 1, 0)
    return plus(fin, -fin.getDay())
  }
  const premier = jour(an, mois, 1)
  return plus(premier, ((7 - premier.getDay()) % 7) + 7 * (n - 1))
}

export function joursSpeciaux(an: number): JourSpecial[] {
  const p = paques(an)
  const pentecote = plus(p, 49)
  // fête des mères : dernier dimanche de mai, ou le premier de juin si c'est la Pentecôte
  const meresMai = dimanche(an, 4, -1)
  const meres = meresMai.getTime() === pentecote.getTime() ? dimanche(an, 5, 1) : meresMai
  return [
    { nom: 'Jour de l’an', date: jour(an, 0, 1), ferie: true },
    // en France, l'Épiphanie se fête le premier dimanche de janvier (entre le 2 et le 8)
    { nom: 'Épiphanie', date: plus(jour(an, 0, 1), 7 - jour(an, 0, 1).getDay() || 7), titre: 'Galette des rois' },
    { nom: 'Chandeleur', date: jour(an, 1, 2), titre: 'Soirée crêpes' },
    { nom: 'Saint-Valentin', date: jour(an, 1, 14) },
    { nom: 'Fête des grands-mères', date: dimanche(an, 2, 1) },
    { nom: 'Mardi gras', date: plus(p, -47) },
    { nom: 'Pâques', date: p, titre: 'Repas de Pâques' },
    { nom: 'Lundi de Pâques', date: plus(p, 1), ferie: true },
    { nom: 'Fête du Travail', date: jour(an, 4, 1), ferie: true },
    { nom: '8 Mai', date: jour(an, 4, 8), ferie: true },
    { nom: 'Ascension', date: plus(p, 39), ferie: true },
    { nom: 'Pentecôte', date: pentecote },
    { nom: 'Lundi de Pentecôte', date: plus(p, 50), ferie: true },
    { nom: 'Fête des mères', date: meres },
    { nom: 'Fête des pères', date: dimanche(an, 5, 3) },
    { nom: 'Fête de la musique', date: jour(an, 5, 21) },
    { nom: '14 Juillet', date: jour(an, 6, 14), ferie: true },
    { nom: 'Assomption', date: jour(an, 7, 15), ferie: true },
    { nom: 'Fête des grands-pères', date: dimanche(an, 9, 1) },
    { nom: 'Halloween', date: jour(an, 9, 31) },
    { nom: 'Toussaint', date: jour(an, 10, 1), ferie: true },
    { nom: '11 Novembre', date: jour(an, 10, 11), ferie: true },
    { nom: 'Réveillon de Noël', date: jour(an, 11, 24) },
    { nom: 'Noël', date: jour(an, 11, 25), ferie: true, titre: 'Noël en famille' },
    { nom: 'Saint-Sylvestre', date: jour(an, 11, 31), titre: 'Réveillon du Nouvel An' },
  ]
}

/** Les jours spéciaux à venir, du plus proche au plus lointain (après demain, dans les `jours` qui viennent). */
export function prochainsJoursSpeciaux(depuis = new Date(), jours = 61, max = 5): JourSpecial[] {
  const debut = plus(new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate()), 2).getTime() - 12 * 3600000
  const fin = plus(depuis, jours).getTime()
  return [...joursSpeciaux(depuis.getFullYear()), ...joursSpeciaux(depuis.getFullYear() + 1)]
    .filter((j) => j.date.getTime() >= debut && j.date.getTime() <= fin)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, max)
}

/** Un jour férié ? (pour ne pas proposer un rendez-vous ce jour-là) */
export const estFerie = (d: Date) => joursSpeciaux(d.getFullYear()).some((j) => j.ferie && j.date.getMonth() === d.getMonth() && j.date.getDate() === d.getDate())
