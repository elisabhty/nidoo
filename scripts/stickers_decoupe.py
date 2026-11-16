"""Découpe une planche de stickers en feutrine (grille 3x3, bord blanc, fond uni coloré) en images détourées.
Le fond est mesuré dans les coins ; tout ce qui s'en écarte est le sticker (le bord blanc compris).
Les trous qui laissent voir le fond (couronne de fleurs, serre-tête) restent transparents.
usage: stickers_decoupe.py planche.jpg noms(virgules, ligne par ligne) dossier [taille_max]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color

src, names, out = sys.argv[1], sys.argv[2].split(','), sys.argv[3]
size = int(sys.argv[4]) if len(sys.argv) > 4 else 0
R = C = 3
rgb = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W = rgb.shape[:2]
lab = color.rgb2lab(rgb / 255)
coins = np.concatenate([lab[:24, :24].reshape(-1, 3), lab[:24, -24:].reshape(-1, 3), lab[-24:, :24].reshape(-1, 3), lab[-24:, -24:].reshape(-1, 3)])
fond = np.median(coins, axis=0)
dE = np.linalg.norm(lab - fond, axis=2)
fig = ndimage.binary_opening(dE > 14, iterations=1)
lbl, n = ndimage.label(fig)
sz = ndimage.sum(fig, lbl, range(1, n + 1))
comps = []
for i in range(1, n + 1):
    if sz[i - 1] < 60:
        continue
    ys, xs = np.where(lbl == i)
    comps.append((i, ys.mean(), xs.mean(), sz[i - 1]))
# les neuf plus grosses formes sont les stickers ; les petites (l'étoile de la lune…) rejoignent la plus proche
big = sorted(sorted(comps, key=lambda c: -c[3])[:R * C], key=lambda c: (c[1], c[2]))
bigids = {b[0] for b in big}
assert len(big) == R * C and sorted(comps, key=lambda c: -c[3])[R * C - 1][3] > 8000, 'il manque un sticker'
rows = [sorted(big[r * C:(r + 1) * C], key=lambda c: c[2]) for r in range(R)]
# bord doux : 0 sur le fond, 1 dès qu'on s'en écarte franchement
alpha_all = np.clip((dE - 8) / 22, 0, 1)
k = 0
for r in range(R):
    for c in range(C):
        main = rows[r][c]
        mine = [main[0]] + [cc[0] for cc in comps if cc[0] not in bigids and min(big, key=lambda b: (b[1] - cc[1]) ** 2 + (b[2] - cc[2]) ** 2)[0] == main[0]]
        m = np.isin(lbl, mine)
        # le feutre bleu ressemble au fond : ce qui est entouré par le sticker en fait partie,
        # sauf un vrai trou qui laisse voir le fond (le milieu de la couronne de fleurs, entre les notes),
        # reconnaissable à sa couleur exactement celle du fond (le feutre, lui, s'en écarte un peu)
        trous, nt = ndimage.label(ndimage.binary_fill_holes(m) & ~m)
        for t in range(1, nt + 1):
            h = trous == t
            if np.median(dE[h]) > 4:
                m |= h
        near = ndimage.binary_dilation(m, iterations=3)
        a = alpha_all * near
        a[ndimage.binary_erosion(m, iterations=2)] = 1
        # la couleur du bord : celle du pixel plein le plus proche (le blanc du bord, sans bleu du fond)
        solid = a > 0.98
        _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
        col = rgb.copy()
        e = ~solid
        col[e] = rgb[iy, ix][e]
        ys, xs = np.where(a > 0.02)
        pad = 4
        y0, y1, x0, x1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1), max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
        img = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
        img[..., :3] = col[y0:y1, x0:x1]
        img[..., 3] = a[y0:y1, x0:x1] * 255
        im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
        if size and max(im.size) > size:
            sc = size / max(im.size)
            im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
        im.save(f'{out}/{names[k]}.webp', quality=88, method=6)
        print(names[k], im.size)
        k += 1
