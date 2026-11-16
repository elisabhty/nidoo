"""Découpe la planche de lunettes (6 montures x 3 formes) en 18 images détourées, verres transparents,
avec une petite ombre portée (comme de vraies lunettes posées sur le visage), et écrit leurs repères :
le centre de chaque verre et sa taille, pour les poser exactement sur les yeux de chaque figurine.
usage: lunettes_planche.py planche.jpg dossier_images fichier_ts"""
import sys, json
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
from skimage import color

src, out, ts = sys.argv[1:4]
FORMES = ['rondes', 'carrees', 'papillon']
MONTURES = ['noire', 'ecaille', 'doree', 'rouge', 'bleue', 'rose']
rgb = np.array(Image.open(src).convert('RGB')).astype(np.float32)
L = color.rgb2lab(rgb / 255)
dE = np.linalg.norm(L - np.array([100, 0, 0]), axis=2)
frame = dE > 12
lab, n = ndimage.label(frame)
sz = ndimage.sum(frame, lab, range(1, n + 1))
parts = [i + 1 for i, s in enumerate(sz) if s > 800]
boxes = []
for i in parts:
    ys, xs = np.where(lab == i)
    boxes.append((ys.mean(), xs.mean(), i))
boxes.sort()
rows = [sorted(boxes[r * 3:(r + 1) * 3], key=lambda b: b[1]) for r in range(6)]
meta = {}
PAD = 14
for r, row in enumerate(rows):
    for c, (_, _, i) in enumerate(row):
        ys, xs = np.where(lab == i)
        y0, y1, x0, x1 = ys.min() - PAD, ys.max() + PAD + 6, xs.min() - PAD, xs.max() + PAD
        sub = rgb[y0:y1, x0:x1]
        d = dE[y0:y1, x0:x1]
        core = (lab[y0:y1, x0:x1] == i)
        # les trous : deux grands (les verres) et quelques reflets à reboucher
        holes = ndimage.binary_fill_holes(core) & ~core
        hl, hn = ndimage.label(holes)
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        order = np.argsort(hs)[::-1]
        lens_ids = [k + 1 for k in order[:2]]
        solid = core | (holes & ~np.isin(hl, lens_ids))
        # bord doux : l'alpha suit l'écart au blanc, seulement autour de la monture
        near = ndimage.binary_dilation(solid, iterations=2)
        a = np.clip((d - 4) / 14, 0, 1) * near
        a[solid] = 1
        a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.6)
        a[ndimage.binary_erosion(solid, iterations=1)] = 1
        # couleur des bords : celle de la monture voisine (pas le blanc de la planche)
        _, (iy, ix) = ndimage.distance_transform_edt(~ndimage.binary_erosion(solid, iterations=1), return_indices=True)
        colr = sub.copy()
        edge = (a < 0.999)
        colr[edge] = sub[iy, ix][edge]
        # l'ombre portée, un peu plus bas
        H, W = a.shape
        sh = cv2.GaussianBlur(a, (0, 0), 3.2)
        sh = np.roll(sh, int(round(W * 0.018)), axis=0) * 0.32
        alpha = a + sh * (1 - a)
        rgb_out = (colr * a[..., None] + np.array([40, 22, 18]) * (sh * (1 - a))[..., None]) / np.maximum(alpha, 1e-3)[..., None]
        img = np.dstack([rgb_out.clip(0, 255), alpha * 255]).astype(np.uint8)
        name = f'lun-{FORMES[c]}-{MONTURES[r]}'
        Image.fromarray(img).save(f'{out}/{name}.webp', quality=92, method=6)
        cs = []
        for k in lens_ids:
            yy, xx = np.where(hl == k)
            cs.append((xx.mean(), yy.mean(), np.sqrt(len(xx) / np.pi), xx.max() - xx.min() + 1, yy.max() - yy.min() + 1))
        cs.sort()
        (lx, ly, lr, lw, lh), (rx, ry, rr, rw, rh) = cs
        meta[name] = {'w': W, 'h': H, 'l': [round(lx, 1), round(ly, 1)], 'r': [round(rx, 1), round(ry, 1)], 'v': [round((lw + rw) / 2, 1), round((lh + rh) / 2, 1)]}
        print(name, W, H, meta[name])
lines = ['// Généré par tools/lunettes_planche.py : les lunettes à poser sur les figurines (public/art/persos/lun-*.webp).',
         '// w, h : la taille de l\'image ; l, r : le centre du verre gauche et du verre droit ; v : la largeur et la hauteur d\'un verre.',
         '',
         'export type Monture = { w: number; h: number; l: [number, number]; r: [number, number]; v: [number, number] }',
         '',
         'export const LUNETTES_IMG: Record<string, Monture> = {']
for k, m in meta.items():
    lines.append(f"  '{k}': {{ w: {m['w']}, h: {m['h']}, l: [{m['l'][0]}, {m['l'][1]}], r: [{m['r'][0]}, {m['r'][1]}], v: [{m['v'][0]}, {m['v'][1]}] }},")
lines += ['}', '', f"export const FORMES_LUNETTES = {json.dumps(FORMES)}", f"export const COULEURS_MONTURE = {json.dumps(MONTURES)}", '']
open(ts, 'w').write('\n'.join(lines).replace('"', "'"))
