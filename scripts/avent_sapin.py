"""Calendrier de l'Avent : où accrocher les 24 décorations sur le sapin en feutrine.

Prend la partie verte du sapin (public/art/avent-sapin.webp), sans l'étoile ni le pot, garde les points
où une décoration tient entière, puis en choisit 24 bien répartis (chaque nouveau point est le plus loin
des précédents) : quelle que soit le nombre de cases ouvertes, le sapin est décoré partout.
Écrit src/lib/aventSapin.ts (positions en % de l'image).
"""
import numpy as np
from PIL import Image

im = Image.open('public/art/avent-sapin.webp').convert('RGBA')
a = np.asarray(im).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
vert = (al > 200) & (g > r + 12) & (g > b + 8)
H, W = vert.shape
rad = int(W * 0.078)  # rayon d'une décoration (~16 % de la largeur)
# un point convient si tout le disque autour est vert
ok = vert.copy()
for dy in range(-rad, rad + 1, 3):
    for dx in range(-rad, rad + 1, 3):
        if dx * dx + dy * dy > rad * rad:
            continue
        ok &= np.roll(np.roll(vert, -dy, 0), -dx, 1)
ys, xs = np.nonzero(ok[::4, ::4])
pts = np.stack([xs * 4, ys * 4], 1).astype(float)
print('points possibles', len(pts), 'rayon', rad)
# premier point : en bas au centre, puis le plus loin des précédents
cx = W / 2
first = np.argmin(np.abs(pts[:, 0] - cx) + np.abs(pts[:, 1] - pts[:, 1].max() + rad))
chosen = [first]
d = np.hypot(*(pts - pts[first]).T)
while len(chosen) < 24:
    k = int(np.argmax(d))
    chosen.append(k)
    d = np.minimum(d, np.hypot(*(pts - pts[k]).T))
out = [(round(pts[k, 0] / W * 100, 1), round(pts[k, 1] / H * 100, 1)) for k in chosen]
size = round(2 * rad / W * 100, 1)
with open('src/lib/aventSapin.ts', 'w') as f:
    f.write('// Généré par scripts/avent_sapin.py : où se pose la décoration de chaque case sur le sapin (en % de l\'image).\n')
    f.write(f'export const DECO_TAILLE = {size} // largeur d\'une décoration, en % de la largeur du sapin\n')
    f.write('export const DECO_PLACES: [number, number][] = [\n')
    for x, y in out:
        f.write(f'  [{x}, {y}],\n')
    f.write(']\n')
print(out)
# aperçu
prev = im.copy()
deco = Image.open('public/art/avent-boule.webp').convert('RGBA').resize((2 * rad, 2 * rad))
for x, y in out:
    prev.alpha_composite(deco, (int(x / 100 * W) - rad, int(y / 100 * H) - rad))
bg = Image.new('RGBA', prev.size, (246, 244, 250, 255)); bg.alpha_composite(prev)
bg.convert('RGB').save('/tmp/avent-sapin-places.png')
