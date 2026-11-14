"""Transforme une planche d'animation (grille de poses du même objet) en bande de sprites alignée.
usage: planche_animation.py planche.png lignes colonnes taille sortie.webp ordre
ordre : indices des cases à enchaîner, ex. 0,1,2,3,4,5,4,3,2,1 pour un aller-retour.
Chaque pose est recalée sur la première (les parties fixes ne doivent pas trembler)."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, rows, cols, size, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
order = [int(x) for x in sys.argv[6].split(',')]
im = Image.open(src)
opaque = im.mode not in ('RGBA', 'LA')
im = im.convert('RGBA')
W, H = im.size
if opaque:  # aperçu sur fond blanc : détourage approximatif, pour essayer seulement
    near = np.array(im.convert('RGB')).min(axis=2) > 238
    lab0, _ = ndimage.label(near)
    edge = (set(lab0[0]) | set(lab0[-1]) | set(lab0[:, 0]) | set(lab0[:, -1])) - {0}
    im.putalpha(Image.fromarray(((~np.isin(lab0, list(edge))) * 255).astype('uint8')))
alpha = np.array(im)[..., 3]
mask = alpha > 40
lab, _ = ndimage.label(ndimage.binary_dilation(mask, iterations=max(1, W // 400)))
cells = {}
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    part = mask[sl] & (lab[sl] == i)
    if part.sum() < W * H * 0.00004:
        continue
    ys, xs = np.where(part)
    key = (min(rows - 1, int((sl[0].start + ys.mean()) / H * rows)), min(cols - 1, int((sl[1].start + xs.mean()) / W * cols)))
    b = (sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1)
    c = cells.get(key)
    cells[key] = b if c is None else (min(c[0], b[0]), min(c[1], b[1]), max(c[2], b[2]), max(c[3], b[3]))
assert len(cells) == rows * cols, f'{len(cells)} poses trouvées au lieu de {rows * cols}'

# Chaque pose est posée sur une toile commune, centrée sur le centre de sa case.
side = int(max(max(b[2] - b[0], b[3] - b[1]) for b in cells.values()) * 1.25)
frames = []
for idx in range(rows * cols):
    b = cells[(idx // cols, idx % cols)]
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im.crop(b), ((side - (b[2] - b[0])) // 2, (side - (b[3] - b[1])) // 2))
    frames.append(canvas)

# Recalage : on cherche le décalage qui superpose le mieux chaque pose à la première.
def small(f):
    return np.array(f.resize((side // 4, side // 4), Image.BILINEAR)).astype(np.float32) / 255
ref = small(frames[0])
aligned = [frames[0]]
for f in frames[1:]:
    cur = small(f)
    best, shift = None, (0, 0)
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            moved = np.roll(np.roll(cur, dy, axis=0), dx, axis=1)
            score = np.abs(moved - ref).sum()
            if best is None or score < best:
                best, shift = score, (dx, dy)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(f, (0, 0))
    aligned.append(canvas.transform((side, side), Image.AFFINE, (1, 0, -shift[0] * 4, 0, 1, -shift[1] * 4), resample=Image.BICUBIC))

# Recadrage commun au plus juste, puis bande horizontale.
union = np.zeros((side, side), bool)
for f in aligned:
    union |= np.array(f)[..., 3] > 20
ys, xs = np.where(union)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
s = int(max(box[2] - box[0], box[3] - box[1]) * 1.04)
strip = Image.new('RGBA', (size * len(order), size), (0, 0, 0, 0))
for n, idx in enumerate(order):
    cell = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    crop = aligned[idx].crop(box)
    cell.alpha_composite(crop, ((s - crop.width) // 2, s - crop.height))  # posé au sol
    strip.alpha_composite(cell.resize((size, size), Image.LANCZOS), (n * size, 0))
strip.save(out, quality=88, method=6)
print(out, f'{len(order)} images de {size}px')
