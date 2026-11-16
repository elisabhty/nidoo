"""Découpe une planche d'objets en feutrine sur fond blanc (grille lignes x colonnes) en images détourées.
mode « boule » : un carré centré sur la plus grosse forme de la case (le smiley), les petits ajouts autour (chapeau, z, cœur, larme) gardés.
mode « serre » : au plus près de l'objet.
usage: feutre_decoupe.py planche.jpg lignes colonnes noms(virgules) dossier mode [taille]"""
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
from skimage import color
src, R, C, names, out, mode = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(','), sys.argv[5], sys.argv[6]
size = int(sys.argv[7]) if len(sys.argv) > 7 else 0
rgb = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W = rgb.shape[:2]
dE = np.linalg.norm(color.rgb2lab(rgb / 255) - np.array([100, 0, 0]), axis=2)
fig = dE > 10
fig = ndimage.binary_opening(fig, iterations=1)
lab, n = ndimage.label(fig)
sz = ndimage.sum(fig, lab, range(1, n + 1))
comps = []
for i in range(1, n + 1):
    if sz[i - 1] < 120:
        continue
    ys, xs = np.where(lab == i)
    comps.append((i, ys.mean(), xs.mean(), sz[i - 1]))
# chaque objet dans sa case : on découpe la planche en bandes d'après les centres des grosses formes
big = sorted([c for c in comps if c[3] > 3000], key=lambda c: (c[1], c[2]))
assert len(big) == R * C, f'{len(big)} grosses formes au lieu de {R * C}'
rows = [sorted(big[r * C:(r + 1) * C], key=lambda c: c[2]) for r in range(R)]
alpha_all = np.clip((dE - 4) / 14, 0, 1)
k = 0
for r in range(R):
    for c in range(C):
        main = rows[r][c]
        # les petites formes rattachées à la grosse la plus proche
        mine = [main[0]] + [cc[0] for cc in comps if cc[3] <= 3000 and min(big, key=lambda b: (b[1] - cc[1]) ** 2 + (b[2] - cc[2]) ** 2)[0] == main[0]]
        m = np.isin(lab, mine)
        near = ndimage.binary_dilation(m, iterations=3)
        a = alpha_all * near
        a[ndimage.binary_erosion(m, iterations=2)] = 1
        solid = a > 0.98
        _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
        col = rgb.copy()
        e = ~solid
        col[e] = rgb[iy, ix][e]
        ys, xs = np.where(near)
        if mode == 'boule':
            # la boule seule (le jaune), sans le chapeau qui la touche
            Lb = color.rgb2lab(rgb / 255)
            yel = (lab == main[0]) & (Lb[..., 2] > 35) & (Lb[..., 1] < 25)
            yel = ndimage.binary_opening(yel, iterations=2)
            yl, yn = ndimage.label(yel)
            yel = yl == (1 + int(np.argmax(ndimage.sum(yel, yl, range(1, yn + 1)))))
            yel = ndimage.binary_fill_holes(yel)
            my, mx = np.where(yel)
            cy, cx = (my.min() + my.max()) / 2, (mx.min() + mx.max()) / 2
            dia = max(my.max() - my.min(), mx.max() - mx.min())
            half = dia * 1.0
            y0, y1, x0, x1 = int(cy - half), int(cy + half), int(cx - half), int(cx + half)
        else:
            pad = 6
            y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad, xs.min() - pad, xs.max() + pad
        img = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
        sy0, sx0 = max(0, y0), max(0, x0)
        sy1, sx1 = min(H, y1), min(W, x1)
        img[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0, :3] = col[sy0:sy1, sx0:sx1]
        img[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0, 3] = a[sy0:sy1, sx0:sx1] * 255
        im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
        if size:
            sc = size / max(im.size)
            im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
        im.save(f'{out}/{names[k]}.webp', quality=90, method=6)
        print(names[k], im.size)
        k += 1
