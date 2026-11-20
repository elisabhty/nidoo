"""Détoure les habits « portés » (manches le long du corps, générés sur fond vert par ElevenLabs à partir de la
poupée et de l'ancien habit à plat) : le vert devient transparent (y compris dans l'encolure et au bout des manches,
où l'on verra le cou et les mains), les bords sont nettoyés de leur reflet vert, l'image est recadrée au plus juste.
Sortie : public/art/persos/hab-<nom>.webp, et la boîte de recadrage affichée pour reporter les repères.
Usage : python3 scripts/habits_poses.py <dossier des jpg> <dossier de sortie> [noms…]"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = Path(sys.argv[1]), Path(sys.argv[2])
noms = sys.argv[3:] or sorted(p.stem for p in src.glob('*.jpg'))
for nom in noms:
    a = np.asarray(Image.open(src / f'{nom}.jpg').convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vert = g - np.maximum(r, b)  # ~80 sur le fond, ~0 ou moins sur l'habit
    alpha = 1 - np.clip((vert - 12) / 40, 0, 1)
    # les miettes isolées (grain du fond) s'en vont, les petits trous dans l'habit se rebouchent
    plein = alpha > 0.5
    lab, n = ndimage.label(plein)
    if n > 1:
        tailles = ndimage.sum(plein, lab, range(1, n + 1))
        garde = np.isin(lab, [i + 1 for i, t in enumerate(tailles) if t > tailles.max() * 0.02])
        alpha = np.where(garde | (ndimage.binary_dilation(garde, iterations=2) & (alpha <= 0.5)), alpha, 0)
    # le reflet vert sur les bords : le vert ne dépasse jamais les deux autres couleurs
    g2 = np.minimum(g, np.maximum(r, b) + 4)
    rgba = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0.04)
    x0, x1, y0, y1 = xs.min() - 3, xs.max() + 4, ys.min() - 3, ys.max() + 4
    im = Image.fromarray(rgba).crop((x0, y0, x1, y1))
    im.save(out / f'hab-{nom}.webp', quality=84, method=6, alpha_quality=95)
    print(nom, 'boite', (x0, y0, x1, y1), 'taille', im.size)
