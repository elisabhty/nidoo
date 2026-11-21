"""Découpe une planche d'icônes en feutrine sur fond blanc (grille R x C) en WebP carrés détourés, avec un vrai
détourage (rembg, modèle isnet-general-use) : plus de liseré blanc ni d'ombre grise coupée sous les objets.
usage: icones_rembg.py planche.jpg R C noms(virgules, '-' = ignorer) dossier [taille=120]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color
from rembg import new_session, remove
src, R, C, names, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(','), sys.argv[5]
T = int(sys.argv[6]) if len(sys.argv) > 6 else 120
assert len(names) == R * C
img0 = Image.open(src).convert('RGB')
rgb = np.array(img0).astype(np.float32)
H, W = rgb.shape[:2]
dE = np.linalg.norm(color.rgb2lab(rgb / 255) - np.array([100, 0, 0]), axis=2)
graine = ndimage.binary_opening(dE > 18, iterations=2)
lab, n = ndimage.label(graine)
sz = ndimage.sum(graine, lab, range(1, n + 1))
cen = ndimage.center_of_mass(graine, lab, range(1, n + 1))
gros = [i for i in range(n) if sz[i] > 300]
def centres(vals, k):
    v = np.sort(vals)
    coupes = np.sort(np.argsort(np.diff(v))[-(k - 1):])
    return [g.mean() for g in np.split(v, np.array(coupes) + 1)]
cy = centres([cen[i][0] for i in gros], R)
cx = centres([cen[i][1] for i in gros], C)
by = [0] + [int((cy[i] + cy[i + 1]) / 2) for i in range(R - 1)] + [H]
bx = [0] + [int((cx[i] + cx[i + 1]) / 2) for i in range(C - 1)] + [W]
session = new_session('isnet-general-use')
P = 24  # du blanc autour de la case : le modèle voit l'objet entier, bien isolé
for k, nom in enumerate(names):
    r, c = divmod(k, C)
    if nom == '-':
        continue
    y0, y1, x0, x1 = by[r], by[r + 1], bx[c], bx[c + 1]
    case = np.full((y1 - y0 + 2 * P, x1 - x0 + 2 * P, 3), 255, np.uint8)
    case[P:-P, P:-P] = rgb[y0:y1, x0:x1].astype(np.uint8)
    masque = np.array(remove(Image.fromarray(case), session=session, only_mask=True, post_process_mask=False)).astype(np.float32) / 255
    # un bout de l'objet voisin, au bord de la case : on l'enlève (on garde la grosse forme et ce qui l'entoure)
    franc = masque > 0.5
    l2, n2 = ndimage.label(franc)
    if n2 > 1:
        s2 = ndimage.sum(franc, l2, range(1, n2 + 1))
        hh, ww = franc.shape
        garde = []
        for i in range(n2):
            ys_, xs_ = np.where(l2 == i + 1)
            bord = ys_.min() <= P + 3 or ys_.max() >= hh - P - 4 or xs_.min() <= P + 3 or xs_.max() >= ww - P - 4
            if s2[i] >= s2.max() * 0.04 and not (bord and s2[i] < s2.max() * 0.3):
                garde.append(i + 1)
        zone = ndimage.binary_dilation(np.isin(l2, garde), iterations=4)
        masque = masque * zone
    a = np.clip((masque - 0.06) / 0.88, 0, 1)
    # les bords sans le blanc du fond : on retire le blanc mélangé (couleur « démélangée »)
    col = case.astype(np.float32)
    aa = np.maximum(a, 1e-3)[..., None]
    pur = np.clip((col - (1 - aa) * 255) / aa, 0, 255)
    col = np.where(a[..., None] > 0.98, col, pur)
    ys, xs = np.where(a > 0.03)
    yy0, yy1, xx0, xx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out_img = np.dstack([col[yy0:yy1, xx0:xx1], a[yy0:yy1, xx0:xx1, None] * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out_img, 'RGBA')
    s = (T - 4) / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    can = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    can.paste(im, ((T - im.width) // 2, (T - im.height) // 2), im)
    can.save(f'{out}/{nom}.webp', quality=90, method=6)
print('ok', len([x for x in names if x != '-']), 'icônes')
