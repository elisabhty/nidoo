// Généré par tools/lunettes_planche.py : les lunettes à poser sur les figurines (public/art/persos/lun-*.webp).
// w, h : la taille de l'image ; l, r : le centre du verre gauche et du verre droit ; v : la largeur et la hauteur d'un verre.

export type Monture = { w: number; h: number; l: [number, number]; r: [number, number]; v: [number, number] }

export const LUNETTES_IMG: Record<string, Monture> = {
  'lun-rondes-noire': { w: 285, h: 122, l: [78.4, 58.7], r: [206.3, 58.7], v: [76.0, 70.0] },
  'lun-carrees-noire': { w: 279, h: 106, l: [75.3, 49.7], r: [202.8, 49.7], v: [80.0, 57.0] },
  'lun-papillon-noire': { w: 288, h: 105, l: [78.5, 48.7], r: [208.8, 48.8], v: [83.5, 54.0] },
  'lun-rondes-ecaille': { w: 285, h: 124, l: [78.3, 59.5], r: [206.0, 59.6], v: [76.0, 70.0] },
  'lun-carrees-ecaille': { w: 279, h: 106, l: [75.5, 49.6], r: [202.9, 49.6], v: [79.5, 57.0] },
  'lun-papillon-ecaille': { w: 287, h: 105, l: [78.8, 48.4], r: [208.9, 48.5], v: [83.5, 54.0] },
  'lun-rondes-doree': { w: 286, h: 121, l: [78.8, 57.8], r: [207.1, 57.8], v: [79.0, 73.0] },
  'lun-carrees-doree': { w: 280, h: 105, l: [75.1, 49.0], r: [203.9, 49.0], v: [83.5, 59.0] },
  'lun-papillon-doree': { w: 287, h: 102, l: [78.3, 46.6], r: [208.9, 46.5], v: [85.0, 54.5] },
  'lun-rondes-rouge': { w: 287, h: 123, l: [79.1, 58.5], r: [207.0, 58.5], v: [76.5, 70.0] },
  'lun-carrees-rouge': { w: 279, h: 105, l: [75.3, 48.8], r: [203.2, 48.9], v: [79.5, 55.0] },
  'lun-papillon-rouge': { w: 288, h: 104, l: [78.1, 48.1], r: [209.0, 48.1], v: [84.0, 53.5] },
  'lun-rondes-bleue': { w: 284, h: 118, l: [78.3, 56.2], r: [205.9, 56.2], v: [76.0, 67.0] },
  'lun-carrees-bleue': { w: 279, h: 103, l: [75.2, 48.6], r: [203.2, 48.7], v: [79.5, 53.0] },
  'lun-papillon-bleue': { w: 287, h: 102, l: [78.1, 47.4], r: [208.9, 47.6], v: [84.0, 52.0] },
  'lun-rondes-rose': { w: 284, h: 106, l: [78.3, 57.6], r: [206.1, 57.6], v: [77.0, 68.0] },
  'lun-carrees-rose': { w: 279, h: 96, l: [75.4, 48.9], r: [203.1, 49.0], v: [79.5, 55.5] },
  'lun-papillon-rose': { w: 287, h: 91, l: [78.0, 47.9], r: [209.1, 48.0], v: [84.0, 53.0] },
}

export const FORMES_LUNETTES = ['rondes', 'carrees', 'papillon']
export const COULEURS_MONTURE = ['noire', 'ecaille', 'doree', 'rouge', 'bleue', 'rose']
