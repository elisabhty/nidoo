"""Audit / correction des masques : sous le menton, des pixels d'habit (cols de chemise, épaules) étiquetés « cheveux » (vert).
Un pixel vert sous le menton dont la couleur est loin de celles des cheveux et proche de celles de l'habit n'est pas un cheveu.
Sinon, quand on change de haut, ce bout de col repasserait devant le nouvel habit avec les cheveux.
  python3 scripts/masques_cols.py            # audit (ajouter --voir : aperçus dans /tmp/masques-cols)
  python3 scripts/masques_cols.py --ecrire   # corrige public/art/persos/<id>-m.webp"""
import re, sys, glob, os
import numpy as np
from PIL import Image
from skimage import color
from scipy import ndimage
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(RACINE, 'public/art/persos')
src = open(os.path.join(RACINE, 'src/lib/visages.ts')).read()
ECRIRE = '--ecrire' in sys.argv
tot = []
for mm in re.finditer(r"(\w+): \{ e: \[([^\]]+)\], mo: \[([^\]]+)\]", src):
    k = mm.group(1); e = [float(v) for v in mm.group(2).split(',')]; mo = [float(v) for v in mm.group(3).split(',')]
    R = 440 / 300
    menton = mo[1] + ((e[2] - e[0]) / R) * 0.42
    fm = f'{D}/{k}-m.webp'
    if not os.path.exists(fm): continue
    im = np.array(Image.open(f'{D}/{k}.webp').convert('RGBA').resize((300, 440)))
    m = np.array(Image.open(fm).convert('RGB').resize((300, 440), Image.NEAREST))
    lab = color.rgb2lab(im[..., :3] / 255.0)
    op = im[..., 3] > 200
    vert = (m[..., 1] >= 128) & op
    H, W = vert.shape
    yy = np.arange(H)[:, None] * np.ones((1, W))
    ym = menton * H
    haut = vert & (yy < mo[1] * H)
    bas = vert & (yy > ym - 0.03 * H) & (yy < ym + 0.14 * H)
    xx = np.ones((H, 1)) * np.arange(W)[None, :]
    cx = (e[0] + e[2]) / 2 * W
    # l'habit : sa poitrine, bien sous le menton et au milieu (pas les ombres des cheveux sur les côtés)
    habit = op & (m[..., 0] < 128) & (m[..., 1] < 128) & (m[..., 2] < 40) & (yy > ym + 0.04 * H) & (yy < ym + 0.16 * H) & (abs(xx - cx) < 0.13 * W)
    if haut.sum() < 200 or bas.sum() < 20 or habit.sum() < 200: continue
    ch = lab[haut]; hb = lab[habit]
    # distance au plus proche parmi un échantillon de chaque famille
    rng = np.random.default_rng(0)
    ech_c = ch[rng.choice(len(ch), min(600, len(ch)), replace=False)]
    ech_h = hb[rng.choice(len(hb), min(600, len(hb)), replace=False)]
    pts = lab[bas]
    def dmin(p, e):
        d = np.sqrt(((p[:, None, :] - e[None, :, :]) ** 2 * np.array([0.5, 1, 1])).sum(-1))
        return np.sort(d, axis=1)[:, :5].mean(1)
    dc = dmin(pts, ech_c); dh = dmin(pts, ech_h)
    faux = np.zeros_like(vert); faux[bas] = (dc > 10) & (dh < dc * 0.6) & (dh < 12)
    faux = ndimage.binary_opening(faux, iterations=1)
    lab_, n = ndimage.label(faux)
    garde = np.zeros_like(faux)
    for i in range(1, n + 1):
        if (lab_ == i).sum() >= 12: garde |= lab_ == i
    c = int(garde.sum())
    if c:
        tot.append((k, c))
        if ECRIRE:
            mo_ = Image.open(fm).convert('RGB'); a = np.array(mo_)
            g2 = np.array(Image.fromarray(garde.astype(np.uint8) * 255).resize(mo_.size, Image.NEAREST)) > 0
            g2 = ndimage.binary_dilation(g2, iterations=1) & (a[..., 1] >= 128)
            a[g2] = [0, 0, 0]
            Image.fromarray(a).save(fm, lossless=True)
        vis = im.copy(); vis[garde] = [255, 0, 255, 255]
        if '--voir' in sys.argv:
            os.makedirs('/tmp/masques-cols', exist_ok=True)
            Image.fromarray(vis).crop((30, int(ym) - 30, 270, int(ym) + 90)).save(f'/tmp/masques-cols/{k}.png')
print(sorted(tot, key=lambda t: -t[1]))
