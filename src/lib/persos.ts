// Les personnages de la famille : des figurines en feutrine, générées avec ElevenLabs et découpées
// (public/art/persos). Chacun choisit celui qui lui ressemble ; la boutique ajoute ses accessoires.
// Repères m (fractions de la toile 300x440) : haut de la tête, hauteur de la tête, centre, largeur du crâne,
// largeur de la chevelure, puis le cadre du buste (x, y, côté).

import { ACCESSORIES, HAIR_COLORS, HAIRSTYLES, type Look } from './look'

export type Group = 'femme' | 'homme' | 'fille' | 'garcon' | 'bebe'
export type Perso = {
  id: string
  g: Group
  /** taille par défaut : 0 adulte, 1 ado, 2 enfant, 3 bébé */
  a: number
  /** teint, du plus clair au plus foncé */
  t: number
  /** cheveux : blond, roux, brun, noir, gris, voile, chauve */
  c: string
  l?: boolean
  b?: boolean
  /** grand-parent */
  s?: boolean
  label: string
  m: [number, number, number, number, number, number, number, number]
}

export const PERSOS: Perso[] = [
  { id: 'f01', g: 'femme', a: 0, t: 0, c: 'blond', label: 'Longs cheveux blonds', m: [0.0091, 0.4114, 0.4882, 0.5633, 0.6933, 0.096, -0.0123, 0.7844] },
  { id: 'f02', g: 'femme', a: 0, t: 1, c: 'roux', l: true, label: 'Rousse ondulée, lunettes', m: [0.0091, 0.4114, 0.4943, 0.5767, 0.7933, 0.0871, -0.0131, 0.8146] },
  { id: 'f03', g: 'femme', a: 0, t: 2, c: 'brun', label: 'Longs cheveux bruns ondulés', m: [0.0091, 0.4114, 0.4945, 0.5667, 0.8033, 0.0872, -0.0131, 0.8146] },
  { id: 'f04', g: 'femme', a: 0, t: 2, c: 'voile', label: 'Voile rose', m: [0.0091, 0.4114, 0.4943, 0.53, 0.5767, 0.1021, -0.0123, 0.7844] },
  { id: 'f05', g: 'femme', a: 0, t: 3, c: 'noir', label: 'Cheveux afro', m: [0.0091, 0.4114, 0.4936, 0.7467, 0.9333, 0.0863, -0.0131, 0.8146] },
  { id: 'f06', g: 'femme', a: 0, t: 4, c: 'noir', label: 'Longues tresses', m: [0.0091, 0.4114, 0.4891, 0.47, 0.5867, 0.0969, -0.0123, 0.7844] },
  { id: 'f07', g: 'femme', a: 0, t: 0, c: 'blond', label: 'Coupe courte blonde', m: [0.0091, 0.4114, 0.4887, 0.4733, 0.4833, 0.0965, -0.0123, 0.7844] },
  { id: 'f08', g: 'femme', a: 0, t: 1, c: 'brun', l: true, label: 'Chignon, lunettes', m: [0.0091, 0.4114, 0.4947, 0.3967, 0.51, 0.1025, -0.0123, 0.7844] },
  { id: 'f09', g: 'femme', a: 0, t: 1, c: 'noir', label: 'Carré noir à frange', m: [0.0091, 0.4114, 0.4999, 0.4933, 0.5833, 0.1077, -0.0123, 0.7844] },
  { id: 'f10', g: 'femme', a: 0, t: 1, c: 'brun', label: 'Carré châtain à frange', m: [0.0091, 0.4114, 0.5012, 0.4833, 0.58, 0.109, -0.0123, 0.7844] },
  { id: 'f11', g: 'femme', a: 0, t: 3, c: 'noir', label: 'Longue tresse', m: [0.0091, 0.4114, 0.4928, 0.4833, 0.5433, 0.1006, -0.0123, 0.7844] },
  { id: 'f12', g: 'femme', a: 0, t: 4, c: 'noir', label: 'Cheveux courts', m: [0.0091, 0.4114, 0.4991, 0.4667, 0.47, 0.1069, -0.0123, 0.7844] },
  { id: 'f13', g: 'femme', a: 0, t: 1, c: 'roux', label: 'Queue de cheval rousse', m: [0.0091, 0.4114, 0.5075, 0.45, 0.5333, 0.1153, -0.0123, 0.7844] },
  { id: 'f14', g: 'femme', a: 0, t: 2, c: 'noir', label: 'Longs cheveux bouclés', m: [0.0091, 0.4114, 0.4892, 0.5467, 0.7433, 0.0878, -0.0128, 0.8028] },
  { id: 'f15', g: 'femme', a: 0, t: 1, c: 'brun', l: true, label: 'Cheveux bruns, lunettes', m: [0.0091, 0.4114, 0.4892, 0.4733, 0.63, 0.097, -0.0123, 0.7844] },
  { id: 'f16', g: 'femme', a: 0, t: 1, c: 'voile', label: 'Voile bleu marine', m: [0.0091, 0.4114, 0.4974, 0.4733, 0.4967, 0.1052, -0.0123, 0.7844] },
  { id: 'f17', g: 'femme', a: 0, t: 3, c: 'noir', label: 'Chignon bas', m: [0.0091, 0.4114, 0.4938, 0.49, 0.5067, 0.1016, -0.0123, 0.7844] },
  { id: 'f18', g: 'femme', a: 0, t: 4, c: 'noir', l: true, label: 'Vanilles, lunettes', m: [0.0091, 0.4114, 0.491, 0.5333, 0.6767, 0.0987, -0.0123, 0.7844] },
  { id: 'gf1', g: 'femme', a: 0, t: 0, c: 'gris', l: true, s: true, label: 'Mamie aux boucles blanches', m: [0.0091, 0.4114, 0.4901, 0.5733, 0.6767, 0.0979, -0.0123, 0.7844] },
  { id: 'gf2', g: 'femme', a: 0, t: 1, c: 'gris', l: true, s: true, label: 'Mamie au chignon', m: [0.0091, 0.4114, 0.4992, 0.3967, 0.55, 0.107, -0.0123, 0.7844] },
  { id: 'gf3', g: 'femme', a: 0, t: 2, c: 'gris', s: true, label: 'Mamie au carré argenté', m: [0.0091, 0.4114, 0.4986, 0.5567, 0.6933, 0.1064, -0.0123, 0.7844] },
  { id: 'gf4', g: 'femme', a: 0, t: 2, c: 'voile', s: true, label: 'Mamie au voile', m: [0.0091, 0.4114, 0.4951, 0.5067, 0.5533, 0.1029, -0.0123, 0.7844] },
  { id: 'gf5', g: 'femme', a: 0, t: 3, c: 'gris', l: true, s: true, label: 'Mamie aux lunettes rouges', m: [0.0091, 0.4114, 0.4943, 0.6333, 0.6967, 0.1021, -0.0123, 0.7844] },
  { id: 'gf6', g: 'femme', a: 0, t: 4, c: 'voile', s: true, label: 'Mamie au foulard', m: [0.0091, 0.4114, 0.4947, 0.5267, 0.5667, 0.1024, -0.0123, 0.7844] },
  { id: 'h01', g: 'homme', a: 0, t: 0, c: 'blond', label: 'Cheveux blonds', m: [0.0091, 0.4114, 0.4934, 0.5433, 0.5733, 0.1012, -0.0123, 0.7844] },
  { id: 'h02', g: 'homme', a: 0, t: 1, c: 'brun', b: true, label: 'Barbe courte', m: [0.0091, 0.4114, 0.498, 0.5167, 0.5467, 0.1058, -0.0123, 0.7844] },
  { id: 'h03', g: 'homme', a: 0, t: 2, c: 'noir', b: true, label: 'Cheveux ondulés, barbe', m: [0.0091, 0.4114, 0.4859, 0.53, 0.5533, 0.0937, -0.0123, 0.7844] },
  { id: 'h04', g: 'homme', a: 0, t: 3, c: 'noir', l: true, label: 'Bouclé, lunettes', m: [0.0091, 0.4114, 0.4982, 0.5133, 0.5167, 0.106, -0.0123, 0.7844] },
  { id: 'h05', g: 'homme', a: 0, t: 4, c: 'chauve', b: true, label: 'Crâne rasé, barbe', m: [0.0091, 0.4114, 0.4983, 0.4467, 0.5367, 0.1061, -0.0123, 0.7844] },
  { id: 'h06', g: 'homme', a: 0, t: 1, c: 'noir', l: true, label: 'Frange, lunettes', m: [0.0091, 0.4114, 0.4911, 0.5233, 0.54, 0.0988, -0.0123, 0.7844] },
  { id: 'h07', g: 'homme', a: 0, t: 1, c: 'roux', b: true, label: 'Roux barbu', m: [0.0091, 0.4105, 0.4924, 0.4933, 0.5333, 0.1011, -0.0123, 0.7826] },
  { id: 'h08', g: 'homme', a: 0, t: 1, c: 'chauve', l: true, label: 'Chauve, lunettes', m: [0.0091, 0.4114, 0.4954, 0.45, 0.55, 0.1032, -0.0123, 0.7844] },
  { id: 'h09', g: 'homme', a: 0, t: 2, c: 'brun', b: true, label: 'Chignon et barbe', m: [0.0091, 0.4114, 0.5046, 0.4167, 0.51, 0.1124, -0.0123, 0.7844] },
  { id: 'h10', g: 'homme', a: 0, t: 3, c: 'noir', label: 'Coupe haute', m: [0.0091, 0.4114, 0.4936, 0.4333, 0.5067, 0.1014, -0.0123, 0.7844] },
  { id: 'h11', g: 'homme', a: 0, t: 3, c: 'noir', b: true, label: 'Moustache', m: [0.0091, 0.4114, 0.4954, 0.48, 0.52, 0.1032, -0.0123, 0.7844] },
  { id: 'h12', g: 'homme', a: 0, t: 4, c: 'noir', b: true, label: 'Dreadlocks', m: [0.0091, 0.4114, 0.5011, 0.5467, 0.6733, 0.1089, -0.0123, 0.7844] },
  { id: 'h13', g: 'homme', a: 0, t: 1, c: 'brun', label: 'Cheveux bouclés', m: [0.0091, 0.4114, 0.4901, 0.5233, 0.5467, 0.0979, -0.0123, 0.7844] },
  { id: 'h14', g: 'homme', a: 0, t: 2, c: 'noir', b: true, label: 'Bouclé, barbe', m: [0.0091, 0.4114, 0.4998, 0.48, 0.5133, 0.1076, -0.0123, 0.7844] },
  { id: 'h15', g: 'homme', a: 0, t: 1, c: 'brun', b: true, label: 'Grande barbe', m: [0.0091, 0.4114, 0.4956, 0.4767, 0.51, 0.1034, -0.0123, 0.7844] },
  { id: 'h16', g: 'homme', a: 0, t: 3, c: 'noir', l: true, label: 'Vanilles, lunettes', m: [0.0091, 0.4114, 0.4936, 0.5067, 0.52, 0.1014, -0.0123, 0.7844] },
  { id: 'h17', g: 'homme', a: 0, t: 1, c: 'noir', b: true, label: 'Cheveux ras', m: [0.0091, 0.4114, 0.497, 0.4533, 0.5233, 0.1047, -0.0123, 0.7844] },
  { id: 'h18', g: 'homme', a: 0, t: 4, c: 'noir', label: 'Cheveux courts', m: [0.0091, 0.4114, 0.4959, 0.4633, 0.5133, 0.1037, -0.0123, 0.7844] },
  { id: 'gm1', g: 'homme', a: 0, t: 0, c: 'gris', l: true, b: true, s: true, label: 'Papi moustachu', m: [0.0091, 0.4114, 0.4901, 0.6033, 0.6233, 0.0979, -0.0123, 0.7844] },
  { id: 'gm2', g: 'homme', a: 0, t: 1, c: 'gris', b: true, s: true, label: 'Papi barbu', m: [0.0091, 0.4114, 0.5002, 0.5533, 0.5967, 0.108, -0.0123, 0.7844] },
  { id: 'gm3', g: 'homme', a: 0, t: 2, c: 'gris', b: true, s: true, label: 'Papi aux cheveux blancs', m: [0.0091, 0.4114, 0.4843, 0.5633, 0.5967, 0.0921, -0.0123, 0.7844] },
  { id: 'gm4', g: 'homme', a: 0, t: 3, c: 'gris', l: true, b: true, s: true, label: 'Papi aux lunettes', m: [0.0091, 0.4114, 0.4897, 0.5433, 0.5967, 0.0975, -0.0123, 0.7844] },
  { id: 'gm5', g: 'homme', a: 0, t: 4, c: 'gris', b: true, s: true, label: 'Papi à la barbe blanche', m: [0.0091, 0.4114, 0.4974, 0.5433, 0.6133, 0.1052, -0.0123, 0.7844] },
  { id: 'gm6', g: 'homme', a: 0, t: 1, c: 'gris', l: true, s: true, label: 'Papi aux lunettes fines', m: [0.0091, 0.4114, 0.4879, 0.5467, 0.5867, 0.0957, -0.0123, 0.7844] },
  { id: 'fi1', g: 'fille', a: 2, t: 0, c: 'blond', label: 'Couettes blondes', m: [0.0091, 0.4506, 0.5024, 0.5533, 0.7667, 0.0728, -0.0143, 0.8591] },
  { id: 'fi2', g: 'fille', a: 2, t: 1, c: 'roux', label: 'Boucles rousses', m: [0.0091, 0.4506, 0.4983, 0.6267, 0.7667, 0.0688, -0.0143, 0.8591] },
  { id: 'fi3', g: 'fille', a: 2, t: 2, c: 'brun', label: 'Serre-tête jaune', m: [0.0114, 0.4495, 0.4933, 0.54, 0.67, 0.0648, -0.012, 0.8571] },
  { id: 'fi4', g: 'fille', a: 2, t: 3, c: 'noir', label: 'Macarons afro', m: [0.0091, 0.4506, 0.505, 0.7767, 0.78, 0.0755, -0.0143, 0.8591] },
  { id: 'fi5', g: 'fille', a: 2, t: 4, c: 'noir', label: 'Tresses à perles', m: [0.0091, 0.4506, 0.5009, 0.5467, 0.63, 0.0713, -0.0143, 0.8591] },
  { id: 'fi6', g: 'fille', a: 2, t: 1, c: 'noir', label: 'Carré à frange', m: [0.0091, 0.4506, 0.4985, 0.5467, 0.6367, 0.069, -0.0143, 0.8591] },
  { id: 'fa1', g: 'fille', a: 1, t: 1, c: 'brun', l: true, label: 'Queue de cheval, lunettes', m: [0.0091, 0.431, 0.4786, 0.4567, 0.54, 0.0677, -0.0133, 0.8218] },
  { id: 'fa2', g: 'fille', a: 1, t: 2, c: 'voile', label: 'Voile lilas', m: [0.0091, 0.431, 0.4967, 0.46, 0.48, 0.0859, -0.0133, 0.8218] },
  { id: 'fa3', g: 'fille', a: 1, t: 0, c: 'blond', label: 'Longs cheveux blonds', m: [0.0091, 0.431, 0.5068, 0.4733, 0.5933, 0.0959, -0.0133, 0.8218] },
  { id: 'fa4', g: 'fille', a: 1, t: 3, c: 'brun', label: 'Cheveux bouclés', m: [0.0091, 0.431, 0.4962, 0.5767, 0.7167, 0.0853, -0.0133, 0.8218] },
  { id: 'fa5', g: 'fille', a: 1, t: 3, c: 'noir', label: 'Longue tresse', m: [0.0091, 0.431, 0.4977, 0.4533, 0.4767, 0.0869, -0.0133, 0.8218] },
  { id: 'fa6', g: 'fille', a: 1, t: 4, c: 'noir', label: 'Bandeau jaune', m: [0.0091, 0.431, 0.5048, 0.43, 0.44, 0.0939, -0.0133, 0.8218] },
  { id: 'gi1', g: 'garcon', a: 2, t: 0, c: 'blond', label: 'Cheveux blonds', m: [0.0091, 0.4506, 0.488, 0.6367, 0.6733, 0.0584, -0.0143, 0.8591] },
  { id: 'gi2', g: 'garcon', a: 2, t: 1, c: 'brun', l: true, label: 'Lunettes bleues', m: [0.0091, 0.4506, 0.4884, 0.6, 0.6467, 0.0589, -0.0143, 0.8591] },
  { id: 'gi3', g: 'garcon', a: 2, t: 2, c: 'noir', label: 'Cheveux noirs ondulés', m: [0.0091, 0.4506, 0.4925, 0.6333, 0.6833, 0.0629, -0.0143, 0.8591] },
  { id: 'gi4', g: 'garcon', a: 2, t: 3, c: 'noir', label: 'Cheveux bouclés', m: [0.0091, 0.4506, 0.4973, 0.5833, 0.6133, 0.0677, -0.0143, 0.8591] },
  { id: 'gi5', g: 'garcon', a: 2, t: 4, c: 'noir', label: 'Cheveux ras', m: [0.0091, 0.4506, 0.5, 0.5133, 0.5933, 0.0704, -0.0143, 0.8591] },
  { id: 'gi6', g: 'garcon', a: 2, t: 1, c: 'noir', label: 'Frange', m: [0.0091, 0.4506, 0.4936, 0.6, 0.6267, 0.0641, -0.0143, 0.8591] },
  { id: 'ga1', g: 'garcon', a: 1, t: 1, c: 'roux', label: 'Roux', m: [0.0091, 0.431, 0.4971, 0.55, 0.55, 0.0863, -0.0133, 0.8218] },
  { id: 'ga2', g: 'garcon', a: 1, t: 2, c: 'brun', label: 'Boucles brunes', m: [0.0091, 0.431, 0.4959, 0.5267, 0.5267, 0.085, -0.0133, 0.8218] },
  { id: 'ga3', g: 'garcon', a: 1, t: 3, c: 'noir', label: 'Coupe haute', m: [0.0091, 0.43, 0.4945, 0.4533, 0.49, 0.0845, -0.0133, 0.8199] },
  { id: 'ga4', g: 'garcon', a: 1, t: 4, c: 'noir', label: 'Vanilles', m: [0.0091, 0.431, 0.4995, 0.48, 0.5033, 0.0886, -0.0133, 0.8218] },
  { id: 'ga5', g: 'garcon', a: 1, t: 1, c: 'brun', label: 'Cheveux mi-longs', m: [0.0091, 0.431, 0.4973, 0.5, 0.6033, 0.0865, -0.0133, 0.8218] },
  { id: 'ga6', g: 'garcon', a: 1, t: 3, c: 'noir', label: 'Cheveux courts', m: [0.0091, 0.431, 0.4894, 0.5, 0.5067, 0.0785, -0.0133, 0.8218] },
  { id: 'b1', g: 'bebe', a: 3, t: 0, c: 'blond', label: 'Petite mèche blonde', m: [0.0091, 0.4898, 0.4969, 0.5233, 0.6767, 0.03, -0.0164, 0.9338] },
  { id: 'b2', g: 'bebe', a: 3, t: 1, c: 'brun', label: 'Cheveux clairs', m: [0.0091, 0.4898, 0.4986, 0.63, 0.7167, 0.0317, -0.0164, 0.9338] },
  { id: 'b3', g: 'bebe', a: 3, t: 2, c: 'brun', label: 'Boucles brunes', m: [0.0091, 0.4898, 0.4946, 0.66, 0.7267, 0.0277, -0.0164, 0.9338] },
  { id: 'b4', g: 'bebe', a: 3, t: 3, c: 'noir', label: 'Petit nœud rose', m: [0.0091, 0.4898, 0.5026, 0.6667, 0.7267, 0.0356, -0.0164, 0.9338] },
  { id: 'b5', g: 'bebe', a: 3, t: 4, c: 'noir', label: 'Cheveux courts', m: [0.0091, 0.4898, 0.4974, 0.6167, 0.7, 0.0305, -0.0164, 0.9338] },
  { id: 'b6', g: 'bebe', a: 3, t: 1, c: 'noir', label: 'Mèche noire', m: [0.0091, 0.4898, 0.4996, 0.5367, 0.66, 0.0327, -0.0164, 0.9338] },
]

export const GROUPS: { key: Group; label: string }[] = [
  { key: 'femme', label: 'Femme' },
  { key: 'homme', label: 'Homme' },
  { key: 'fille', label: 'Fille' },
  { key: 'garcon', label: 'Garçon' },
  { key: 'bebe', label: 'Bébé' },
]
export const TONES = ['#F7DFCB', '#EDC7A6', '#D4A276', '#A46B45', '#6A4128']

/** Les dimensions de la toile d'un personnage. */
export const CW = 300
export const CH = 440
const R = CH / CW

/** Le personnage d'un « look » : celui choisi, ou à défaut le plus proche de l'ancien personnage dessiné. */
export function persoOf(look: Look): Perso {
  if (look.k && PERSOS[look.k - 1]) return PERSOS[look.k - 1]
  return nearest(look)
}

const TONE_OF_SKIN = [0, 1, 1, 2, 3, 3, 4]
const HAIR_OF = (c: number) => {
  const k = HAIR_COLORS[c]?.key ?? 'brun'
  return k === 'chatain' ? 'brun' : k === 'platine' ? 'blond' : k === 'blanc' ? 'gris' : k === 'rose' || k === 'bleu' ? 'noir' : k
}
const memo = new Map<string, Perso>()

/** L'ancien personnage (dessiné) devient la figurine qui lui ressemble le plus. */
export function nearest(look: Look): Perso {
  const key = `${look.s}.${look.h}.${look.c}.${look.a}.${look.g}.${look.b}.${look.o}.${look.l}`
  const hit = memo.get(key)
  if (hit) return hit
  const style = HAIRSTYLES[look.h]?.key ?? 'court'
  const hair = HAIR_OF(look.c)
  const feminine = look.b === 0 && (['longs', 'bouclesLongs', 'carre', 'chignon', 'queue', 'tresses'].includes(style) || look.l > 0 || look.o > 0)
  const group: Group = look.a === 3 ? 'bebe' : look.a === 0 ? (feminine ? 'femme' : 'homme') : feminine ? 'fille' : 'garcon'
  const tone = TONE_OF_SKIN[look.s] ?? 1
  const senior = look.a === 0 && hair === 'gris'
  let best = PERSOS[0]
  let score = -1e9
  for (const p of PERSOS) {
    if (p.g !== group) continue
    let s = 0
    s -= Math.abs(p.t - tone) * 3
    if (p.c === hair) s += 3
    if (!!p.s === senior) s += 2
    if (!!p.l === look.g > 0) s += 1.5
    if (!!p.b === look.b > 0) s += 1.5
    if (p.a === look.a) s += 1
    if (style === 'chauve' && p.c === 'chauve') s += 2
    if (p.c === 'voile') s -= 4
    if (s > score) {
      score = s
      best = p
    }
  }
  memo.set(key, best)
  return best
}

/** Les accessoires de la boutique, posés sur la figurine : largeur et position (fractions de la toile). */
export type AccPlace = { w: number; x: number; y: number; anchor: 'bottom' | 'center' | 'top'; ar: number }
const AR: Record<string, number> = { bonnet: 1.06, casquette: 0.805, paille: 0.722, fleurs: 0.714, echarpe: 1.003, lunettes: 0.566, couronne: 1.031, noeud: 0.638 }

export function accPlace(p: Perso, acc: string): AccPlace | null {
  const [t, h, x, c] = p.m
  const hw = h * R
  const ar = AR[acc]
  switch (acc) {
    case 'bonnet':
      return { w: Math.min(c * 1.02, hw * 0.95), x, y: t + h * 0.52, anchor: 'bottom', ar }
    case 'casquette':
      return { w: Math.min(c * 1.2, hw * 1.1), x: x + c * 0.05, y: t + h * 0.5, anchor: 'bottom', ar }
    case 'paille':
      return { w: Math.min(c * 1.6, hw * 1.45), x, y: t + h * 0.5, anchor: 'bottom', ar }
    case 'fleurs':
      return { w: Math.min(c * 1.12, hw), x, y: t + h * 0.4, anchor: 'bottom', ar }
    case 'couronne':
      return { w: Math.min(c * 0.55, hw * 0.5), x, y: t + h * 0.16, anchor: 'bottom', ar }
    case 'noeud':
      return { w: hw * 0.42, x: x + c * 0.36, y: t + h * 0.2, anchor: 'center', ar }
    case 'lunettes':
      return { w: hw * 0.8, x, y: t + h * 0.6, anchor: 'center', ar }
    case 'echarpe':
      return { w: hw * 0.72, x, y: t + h * 0.86, anchor: 'top', ar }
    default:
      return null
  }
}

/** Le haut de l'accessoire (fraction de la hauteur de la toile ; négatif s'il dépasse au-dessus). */
export function accTop(pl: AccPlace) {
  const hgt = (pl.w * pl.ar) / R
  return pl.anchor === 'bottom' ? pl.y - hgt : pl.anchor === 'center' ? pl.y - hgt / 2 : pl.y
}

export const accessoryOf = (look: Look) => ACCESSORIES[look.v ?? 0] ?? ''
