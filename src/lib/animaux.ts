// Généré par scripts/banc/animaux.py : les repères de chaque compagnon (public/art/pet-<espèce>.webp), en fractions
// de son image carrée — le milieu de ses yeux (ex, ey) et leur écart (d), le haut de son crâne sans les oreilles
// (crane), la largeur de sa tête à hauteur du front (tw), le milieu de son corps sous la tête (xc) et sa largeur (cw),
// où commencent ses pattes arrière (pieds), et s'il a des ailes où tombent les manches d'un pull (manches).
// Tout ce qu'il porte se pose d'après eux (lib/habitsAnimaux.ts, components/pet.tsx).

export type Animal = { ex: number; ey: number; d: number; crane: number; tw: number; xc: number; cw: number; pieds: number; manches: boolean }

export const ANIMAUX: Record<string, Animal> = {
  chat: { ex: 0.573, ey: 0.394, d: 0.226, crane: 0.146, tw: 0.564, xc: 0.565, cw: 0.482, pieds: 0.815, manches: false },
  chien: { ex: 0.497, ey: 0.334, d: 0.258, crane: 0.050, tw: 0.645, xc: 0.469, cw: 0.463, pieds: 0.815, manches: false },
  lapin: { ex: 0.501, ey: 0.515, d: 0.206, crane: 0.289, tw: 0.425, xc: 0.500, cw: 0.380, pieds: 0.815, manches: false },
  renard: { ex: 0.552, ey: 0.418, d: 0.235, crane: 0.160, tw: 0.587, xc: 0.511, cw: 0.472, pieds: 0.815, manches: false },
  panda: { ex: 0.502, ey: 0.365, d: 0.263, crane: 0.075, tw: 0.657, xc: 0.503, cw: 0.532, pieds: 0.815, manches: false },
  koala: { ex: 0.496, ey: 0.400, d: 0.261, crane: 0.113, tw: 0.652, xc: 0.495, cw: 0.516, pieds: 0.815, manches: false },
  pingouin: { ex: 0.494, ey: 0.331, d: 0.266, crane: 0.039, tw: 0.542, xc: 0.496, cw: 0.618, pieds: 0.875, manches: true },
  hibou: { ex: 0.501, ey: 0.348, d: 0.265, crane: 0.056, tw: 0.635, xc: 0.498, cw: 0.770, pieds: 0.885, manches: true },
}
