"""Les habits « portés » (public/art/persos/hab-<nom>.webp) sont photographiés à plat : dans l'encolure, on voit le dos
du col. Sur une figurine, le cou est à cet endroit : on retire donc ce dos de col (tout ce qui est au-dessus du trou de
l'encolure), sans changer la taille de l'image — les repères de src/lib/persos.ts (HABITS) restent justes.
À lancer après scripts/habits_poses.py, puis scripts/accessoires_ombres_portees.py pour les ombres.

  python3 scripts/habits_cols.py"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

D = Path(__file__).resolve().parent.parent / 'public/art/persos'
for f in sorted(D.glob('hab-*.webp')):
    if f.stem.endswith('-ombre'):
        continue
    a = np.array(Image.open(f).convert('RGBA'))
    H, W = a.shape[:2]
    lab, k = ndimage.label(a[..., 3] < 40)
    bord = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    trou = np.zeros((H, W), bool)
    for i in range(1, k + 1):
        if i in bord:
            continue
        ys, xs = np.where(lab == i)
        # l'encolure : un trou en haut, au milieu
        if len(ys) > 150 and ys.mean() < 0.45 * H and abs(xs.mean() - W / 2) < 0.15 * W:
            trou |= lab == i
    if not trou.any():
        continue
    ote = np.zeros((H, W), bool)
    for x in np.where(trou.any(axis=0))[0]:
        ote[: np.argmax(trou[:, x]), x] = True
    # bord adouci d'un pixel
    doux = ndimage.gaussian_filter(ote.astype(float), 0.8)
    a[..., 3] = (a[..., 3] * (1 - np.clip(doux * 1.6, 0, 1))).astype(np.uint8)
    Image.fromarray(a).save(f, quality=84, method=6, alpha_quality=95)
    print(f.name, int(ote.sum()), 'pixels de dos de col retirés')
