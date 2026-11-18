"""Les poignets de chaque figurine (src/lib/mains.ts) : pour poser une montre ou un bracelet.

Sur le masque de la figurine (rouge = peau), on cherche de chaque côté du buste la peau à hauteur des hanches
(la main) : le poignet est une largeur de main au-dessus de son bout. Fractions de la toile 300 x 440 :
[x gauche, y gauche, x droit, y droit, largeur de la main].
Usage : python3 scripts/mains_personnages.py
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

RACINE = Path(__file__).resolve().parent.parent
D = RACINE / 'public/art/persos'
corps = {}
for m in re.finditer(r"(\w+): \[([^\]]+)\]", (RACINE / 'src/lib/corps.ts').read_text()):
    corps[m.group(1)] = [float(v) for v in m.group(2).split(',')]

lignes = []
for pid, c in sorted(corps.items()):
    pl, wl, pr, wr, yb, bx, bw, hy = c
    im = np.array(Image.open(D / f'{pid}.webp').convert('RGBA'))
    mk = np.array(Image.open(D / f'{pid}-m.webp').convert('RGB'))
    H, W = im.shape[:2]
    peau = (mk[..., 0] > 160) & (im[..., 3] > 200)
    y0, y1 = int((hy - 0.22) * H), int((hy + 0.14) * H)
    res = []
    for side in (-1, 1):
        zone = np.zeros_like(peau)
        xs = np.arange(W)
        cote = (xs - bx * W) * side > bw * 0.16 * W
        zone[y0:y1, :] = peau[y0:y1, :] & cote[None, :]
        lab, n = ndimage.label(zone)
        if not n:
            res.append(None)
            continue
        tailles = ndimage.sum(zone, lab, range(1, n + 1))
        k = int(np.argmax(tailles)) + 1
        ys, xx = np.where(lab == k)
        # le bout de la main (la peau la plus basse), puis le poignet une largeur de main plus haut
        # (le haut de la peau peut être le coude, sous une manche courte)
        bas = ys.max()
        main = (ys > bas - 0.03 * H)
        larg = xx[main].max() - xx[main].min() + 1
        poignet = max(ys.min(), bas - larg * 1.05)
        pres = np.abs(ys - poignet) < 3
        res.append((xx[pres].mean() / W, poignet / H, larg / W))
    if None in res:
        res = [r or ((bx + s * bw * 0.42), hy - 0.03, bw * 0.16) for r, s in zip(res, (-1, 1))]
    (lx, ly, lw), (rx, ry, rw) = res
    lignes.append(f"  {pid}: [{lx:.4f}, {ly:.4f}, {rx:.4f}, {ry:.4f}, {(lw + rw) / 2:.4f}],")

(RACINE / 'src/lib/mains.ts').write_text(
    "// Les poignets de chaque figurine (fractions de la toile 300x440), calculés par scripts/mains_personnages.py :\n"
    "// x et y du poignet gauche (à gauche de l'image), puis de la droite, et la largeur d'une main.\n"
    "// Ils servent à poser la montre de la boutique.\n\n"
    "export const MAINS: Record<string, [number, number, number, number, number]> = {\n" + "\n".join(lignes) + "\n}\n"
)
print(len(lignes), 'figurines'); print('\n'.join(lignes[:4]))
