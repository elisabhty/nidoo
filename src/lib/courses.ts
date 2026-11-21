// Les courses, plus pratiques (Elisa, 21 novembre : « mettre la quantité des ingrédients et rendre ça plus pratique :
// les éléments souvent mis dans la liste, des recommandations par rapport à ce qu'on a déjà dans la liste »).
//
// • La quantité vit dans le nom de l'article, après un point médian : « Lait · 2 », « Farine · 500 g ». Rien ne change
//   dans la base, et le widget « À faire » l'affiche tel quel. « 2 lait », « lait x2 », « 500g farine » se comprennent.
// • Chaque article va dans son rayon (boulangerie, crèmerie…), dans l'ordre d'un magasin.
// • Les idées : ce que la famille ajoute le plus souvent (gardé sur l'appareil), et ce qui va avec ce qui est déjà dans
//   la liste (des pâtes : la sauce tomate, le parmesan).

export type Article = { nom: string; qte: string }

const UNITES = '(?:kg|g|mg|l|cl|ml|litres?|boîtes?|boites?|paquets?|bouteilles?|pots?|sachets?|tranches?|barquettes?|packs?|douzaines?|briques?|filets?|bottes?|pièces?)'
const RE_DEBUT = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNITES})?\\.?\\s+(?:de\\s+|d['’]\\s*)?(.+)$`, 'i')
const RE_FIN_X = /^(.+?)\s*[x×*]\s*(\d+)$/i
const RE_FIN_UNITE = new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNITES})$`, 'i')

const majuscule = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** « Lait · 2 » → { nom: 'Lait', qte: '2' } ; « Pain » → { nom: 'Pain', qte: '' } */
export function lireArticle(titre: string): Article {
  const i = titre.lastIndexOf(' · ')
  if (i > 0) return { nom: titre.slice(0, i).trim(), qte: titre.slice(i + 3).trim() }
  return { nom: titre.trim(), qte: '' }
}

/** { nom, qte } → « Lait · 2 » (sans quantité, ou « 1 », juste le nom) ; 80 caractères au plus (la base). */
export function ecrireArticle(a: Article): string {
  const q = a.qte.trim()
  const nom = a.nom.trim()
  return (q && q !== '1' ? `${nom} · ${q}` : nom).slice(0, 80)
}

/** Ce qu'on tape : « 2 lait », « 500g de farine », « œufs x6 », « pommes 1 kg » → le nom et la quantité. */
export function comprendre(saisie: string): Article {
  const t = saisie.trim().replace(/\s+/g, ' ')
  const deja = lireArticle(t)
  if (deja.qte) return { nom: majuscule(deja.nom), qte: deja.qte }
  let m = RE_DEBUT.exec(t)
  if (m) return { nom: majuscule(m[3]), qte: m[2] ? `${m[1]} ${m[2].toLowerCase()}` : m[1] }
  m = RE_FIN_X.exec(t)
  if (m) return { nom: majuscule(m[1]), qte: m[2] }
  m = RE_FIN_UNITE.exec(t)
  if (m) return { nom: majuscule(m[1]), qte: `${m[2]} ${m[3].toLowerCase()}` }
  return { nom: majuscule(t), qte: '' }
}

/** Une quantité qu'on peut faire monter et descendre d'un toucher : un nombre seul (« 2 »), ou rien (1). */
export function nombre(qte: string): number | null {
  if (!qte) return 1
  return /^\d+$/.test(qte) ? Number(qte) : null
}

const sansAccent = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')
export const cle = (nom: string) => sansAccent(nom).replace(/['’-]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/s\b/g, '').replace(/\s+/g, ' ').trim()

export type Rayon = { key: string; label: string; emoji: string; mots: string[] }
/** Dans l'ordre d'un tour de magasin. */
export const RAYONS: Rayon[] = [
  { key: 'fruits', label: 'Fruits et légumes', emoji: '🍎', mots: ['fruit', 'legume', 'pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'raisin', 'kiwi', 'clementine', 'mandarine', 'peche', 'abricot', 'melon', 'pasteque', 'ananas', 'mangue', 'avocat', 'tomate', 'salade', 'laitue', 'carotte', 'courgette', 'aubergine', 'poivron', 'concombre', 'oignon', 'ail', 'echalote', 'pomme de terre', 'patate', 'champignon', 'brocoli', 'chou', 'epinard', 'haricot vert', 'poireau', 'radis', 'persil', 'basilic', 'menthe', 'coriandre', 'herbe', 'framboise', 'myrtille', 'cerise', 'potiron', 'butternut', 'betterave', 'celeri', 'navet', 'endive', 'mache', 'roquette'] },
  { key: 'boulangerie', label: 'Boulangerie', emoji: '🥖', mots: ['pain', 'baguette', 'croissant', 'brioche', 'viennoiserie', 'pain de mie', 'biscotte', 'tortilla', 'wrap', 'pain burger', 'pain au chocolat', 'chocolatine'] },
  { key: 'cremerie', label: 'Crèmerie', emoji: '🥛', mots: ['lait', 'beurre', 'fromage', 'yaourt', 'yogourt', 'creme', 'oeuf', 'emmental', 'gruyere', 'comte', 'mozzarella', 'parmesan', 'cheddar', 'chevre', 'camembert', 'brie', 'raclette', 'feta', 'ricotta', 'mascarpone', 'skyr', 'petit suisse', 'compote', 'dessert', 'fromage blanc', 'kefir'] },
  { key: 'boucherie', label: 'Viande et poisson', emoji: '🥩', mots: ['viande', 'poulet', 'boeuf', 'steak', 'hache', 'porc', 'jambon', 'lardon', 'saucisse', 'merguez', 'dinde', 'veau', 'agneau', 'canard', 'poisson', 'saumon', 'cabillaud', 'thon', 'crevette', 'moule', 'charcuterie', 'chorizo', 'saucisson', 'knack', 'bacon', 'escalope', 'cordon bleu', 'nugget'] },
  { key: 'epicerie', label: 'Épicerie', emoji: '🥫', mots: ['sauce tomate', 'coulis', 'concentre de tomate', 'tomate pelee', 'pate', 'spaghetti', 'riz', 'semoule', 'quinoa', 'lentille', 'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'vinaigrette', 'moutarde', 'ketchup', 'mayonnaise', 'sauce', 'conserve', 'thon en boite', 'mais', 'pois chiche', 'haricot', 'soupe', 'bouillon', 'epice', 'cafe', 'the', 'tisane', 'cacao', 'chocolat', 'cereale', 'muesli', 'confiture', 'miel', 'pate a tartiner', 'nutella', 'biscuit', 'gateau', 'gouter', 'chip', 'apero', 'cacahuete', 'olive', 'levure', 'compote', 'puree', 'cornichon', 'bonbon', 'cracker', 'galette', 'crepe', 'pizza', 'taco', 'nouille', 'couscous'] },
  { key: 'surgeles', label: 'Surgelés', emoji: '🧊', mots: ['surgele', 'glace', 'frite', 'poelee', 'legumes surgeles', 'pizza surgelee', 'sorbet', 'esquimau'] },
  { key: 'boissons', label: 'Boissons', emoji: '🧃', mots: ['eau', 'jus', 'soda', 'coca', 'limonade', 'sirop', 'biere', 'vin', 'champagne', 'cidre', 'boisson', 'lait vegetal', 'lait d avoine'] },
  { key: 'bebe', label: 'Bébé', emoji: '🍼', mots: ['couche', 'lingette', 'lait infantile', 'petit pot', 'biberon', 'tetine'] },
  { key: 'maison', label: 'Hygiène et maison', emoji: '🧴', mots: ['papier toilette', 'essuie tout', 'mouchoir', 'lessive', 'adoucissant', 'liquide vaisselle', 'pastille lave vaisselle', 'eponge', 'sac poubelle', 'savon', 'gel douche', 'shampoing', 'dentifrice', 'brosse a dent', 'deodorant', 'coton', 'rasoir', 'serviette', 'nettoyant', 'javel', 'ampoule', 'pile', 'aluminium', 'film', 'croquette', 'litiere', 'patee'] },
]
export const AUTRES: Rayon = { key: 'autres', label: 'Autres', emoji: '🛒', mots: [] }

/** Le rayon d'un article (le mot le plus long trouvé l'emporte : « lait d'avoine » va aux boissons, pas à la crèmerie). */
export function rayonDe(nom: string): Rayon {
  const n = ` ${cle(nom)} `
  let best: { r: Rayon; l: number } | null = null
  for (const r of RAYONS) {
    for (const mot of r.mots) {
      const m = cle(mot)
      if (n.includes(` ${m} `) || n.includes(` ${m}`)) {
        if (!best || m.length > best.l) best = { r, l: m.length }
      }
    }
  }
  return best?.r ?? AUTRES
}

/** Ce qui va avec : « des pâtes » appelle la sauce tomate et le parmesan. */
const AVEC: [string, string[]][] = [
  ['pate', ['Sauce tomate', 'Parmesan']],
  ['spaghetti', ['Sauce tomate', 'Parmesan']],
  ['pain', ['Beurre', 'Confiture']],
  ['cafe', ['Lait', 'Sucre']],
  ['the', ['Citron', 'Miel']],
  ['cereale', ['Lait']],
  ['salade', ['Tomates', 'Vinaigrette']],
  ['farine', ['Œufs', 'Lait', 'Sucre']],
  ['crepe', ['Œufs', 'Lait', 'Pâte à tartiner']],
  ['raclette', ['Pommes de terre', 'Charcuterie', 'Cornichons']],
  ['pizza', ['Mozzarella', 'Sauce tomate']],
  ['burger', ['Pains burger', 'Steaks hachés', 'Cheddar']],
  ['taco', ['Tortillas', 'Avocats', 'Fromage râpé']],
  ['poulet', ['Riz', 'Légumes']],
  ['riz', ['Poulet', 'Sauce soja']],
  ['saumon', ['Citron', 'Riz']],
  ['yaourt', ['Fruits', 'Miel']],
  ['tomate', ['Mozzarella', 'Basilic']],
  ['gateau', ['Farine', 'Œufs', 'Sucre', 'Beurre']],
  ['chocolat', ['Lait', 'Farine']],
  ['steak', ['Frites', 'Salade']],
  ['couche', ['Lingettes']],
  ['lessive', ['Adoucissant']],
  ['brioche', ['Pâte à tartiner', 'Lait']],
  ['apero', ['Chips', 'Olives', 'Jus de fruits']],
  ['chip', ['Jus de fruits', 'Olives']],
]

/** Les idées « pour aller avec » ce qu'il y a déjà dans la liste (pas ce qui y est déjà). */
export function pourAllerAvec(noms: string[]): { avec: string; idees: string[] }[] {
  const presents = new Set(noms.map(cle))
  // « Farine et œufs » contient déjà les œufs : on ne les repropose pas
  const tout = ` ${noms.map(cle).join(' ')} `
  const vus = new Set<string>()
  const out: { avec: string; idees: string[] }[] = []
  for (const nom of noms) {
    const n = ` ${cle(nom)} `
    for (const [mot, idees] of AVEC) {
      if (!n.includes(` ${mot}`)) continue
      const reste = idees.filter((x) => !presents.has(cle(x)) && !vus.has(cle(x)) && !tout.includes(` ${cle(x)} `))
      if (!reste.length) continue
      reste.forEach((x) => vus.add(cle(x)))
      out.push({ avec: nom, idees: reste })
      break
    }
    if (out.length >= 2) break
  }
  return out
}

export const IDEES_COURSES = ['Pain', 'Lait', 'Œufs', 'Fruits', 'Légumes', 'Beurre', 'Fromage', 'Yaourts', 'Café', 'Pâtes', 'Riz', 'Papier toilette', 'Lessive']

type Histo = Record<string, { nom: string; n: number; le: number }>
const HISTO = (famille: string) => `nidoo.courses.${famille}`

function lireHisto(famille: string): Histo {
  try {
    return JSON.parse(localStorage.getItem(HISTO(famille)) ?? '{}') as Histo
  } catch {
    return {}
  }
}

/** On retient ce que la famille ajoute (sur cet appareil), pour le proposer en premier. */
export function retenir(famille: string, nom: string) {
  const h = lireHisto(famille)
  const k = cle(nom)
  if (!k) return
  h[k] = { nom, n: (h[k]?.n ?? 0) + 1, le: Date.now() }
  try {
    localStorage.setItem(HISTO(famille), JSON.stringify(h))
  } catch {
    /* sans conséquence */
  }
}

/** Les idées du moment : d'abord ce qu'on ajoute souvent (et ce qui vient d'être acheté), puis les classiques. */
export function souvent(famille: string, dansLaListe: string[], achetes: string[], max = 10): string[] {
  const presents = new Set(dansLaListe.map(cle))
  const h = lireHisto(famille)
  const frequents = Object.values(h)
    .sort((a, b) => b.n - a.n || b.le - a.le)
    .map((x) => x.nom)
  const out: string[] = []
  for (const nom of [...frequents, ...achetes, ...IDEES_COURSES]) {
    const k = cle(nom)
    if (!k || presents.has(k) || out.some((x) => cle(x) === k)) continue
    out.push(nom)
    if (out.length >= max) break
  }
  return out
}
