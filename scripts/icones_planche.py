"""Découpe une planche d'icônes en feutrine sur fond blanc (grille R x C, objets de tailles diverses) en WebP carrés détourés.
usage: icones_planche.py planche.jpg R C noms(virgules, '-' = ignorer) dossier [taille=120]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color
src, R, C, names, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(','), sys.argv[5]
T = int(sys.argv[6]) if len(sys.argv) > 6 else 120
assert len(names) == R * C, f'{len(names)} noms pour {R * C} cases'
rgb = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W = rgb.shape[:2]
dE = np.linalg.norm(color.rgb2lab(rgb / 255) - np.array([100, 0, 0]), axis=2)
graine = ndimage.binary_opening(dE > 18, iterations=2)
lab, n = ndimage.label(graine)
sz = ndimage.sum(graine, lab, range(1, n + 1))
cen = ndimage.center_of_mass(graine, lab, range(1, n + 1))
gros = [i for i in range(n) if sz[i] > 300]
def centres(vals, k):
    v = np.sort(vals)
    coupes = np.sort(np.argsort(np.diff(v))[-(k - 1):]) if k > 1 else []
    return [g.mean() for g in np.split(v, np.array(coupes) + 1)]
cy = centres([cen[i][0] for i in gros], R)
cx = centres([cen[i][1] for i in gros], C)
by = [0] + [int((cy[i] + cy[i + 1]) / 2) for i in range(R - 1)] + [H]
bx = [0] + [int((cx[i] + cx[i + 1]) / 2) for i in range(C - 1)] + [W]
fond = dE > 6
alpha_all = np.clip((dE - 3) / 12, 0, 1)
for k, nom in enumerate(names):
    r, c = divmod(k, C)
    if nom == '-':
        continue
    zone = np.zeros_like(fond)
    e = 3  # un liseré entre les cases : les bouts des voisins y sont coupés
    zone[by[r] + (e if r else 0):by[r + 1] - (e if r < R - 1 else 0), bx[c] + (e if c else 0):bx[c + 1] - (e if c < C - 1 else 0)] = True
    def bord_de(lab_, i):
        ys_, xs_ = np.where(lab_ == i + 1)
        return ys_.min() <= by[r] + 4 or ys_.max() >= by[r + 1] - 5 or xs_.min() <= bx[c] + 4 or xs_.max() >= bx[c + 1] - 5
    # un bout de l'objet voisin, coupé par le bord de la case (vu sur le masque franc) : on l'enlève
    f = ndimage.binary_opening((dE > 12) & zone, iterations=1)
    l2, n2 = ndimage.label(f)
    s2 = ndimage.sum(f, l2, range(1, n2 + 1))
    bouts = np.isin(l2, [i + 1 for i in range(n2) if bord_de(l2, i) and s2[i] < s2.max() * 0.3])
    f = ndimage.binary_opening(fond & zone & ~ndimage.binary_dilation(bouts, iterations=5), iterations=1)
    l3, n3 = ndimage.label(f)
    s3 = ndimage.sum(f, l3, range(1, n3 + 1))
    m = ndimage.binary_fill_holes(np.isin(l3, [i + 1 for i in range(n3) if s3[i] >= max(60, s3.max() * 0.02) and not (bord_de(l3, i) and s3[i] < s3.max() * 0.3)]))
    near = ndimage.binary_dilation(m, iterations=2) & zone
    a = alpha_all * near
    a[ndimage.binary_erosion(m, iterations=2)] = 1
    ys, xs = np.where(near)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    img = np.dstack([rgb[y0:y1, x0:x1], a[y0:y1, x0:x1, None] * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(img, 'RGBA')
    s = (T - 4) / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    can = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    can.paste(im, ((T - im.width) // 2, (T - im.height) // 2), im)
    can.save(f'{out}/{nom}.webp', quality=88, method=6)
print('ok', len([x for x in names if x != '-']), 'icônes')
