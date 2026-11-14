"""Découpe une planche d'illustrations (grille lignes x colonnes) en fichiers WebP détourés.
usage: slice.py planche.png lignes colonnes taille dossier nom1,nom2,...  (nom '-' = ignorer)
PNG avec transparence : on garde l'alpha d'origine. JPEG sur fond blanc (aperçu) : détourage approximatif."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

src, rows, cols, size, out, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6].split(',')
im = Image.open(src)
has_alpha = im.mode in ('RGBA', 'LA') and np.array(im.convert('RGBA'))[..., 3].min() < 250
im = im.convert('RGBA')
W, H = im.size
if not has_alpha:
    rgb = im.convert('RGB')
    near = np.array(rgb).min(axis=2) > 238
    lab0, _ = ndimage.label(near)
    edge = set(lab0[0]) | set(lab0[-1]) | set(lab0[:, 0]) | set(lab0[:, -1])
    edge.discard(0)
    bg = np.isin(lab0, list(edge))
    a = Image.fromarray(((~bg) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(a)
alpha = np.array(im)[..., 3]
mask = alpha > 40
grow = ndimage.binary_dilation(mask, iterations=max(1, W // 400))
lab, n = ndimage.label(grow)
cells = {}
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    part = mask[sl] & (lab[sl] == i)
    if part.sum() < (W * H) * 0.00004:
        continue
    ys, xs = np.where(part)
    cy, cx = sl[0].start + ys.mean(), sl[1].start + xs.mean()
    key = (min(rows - 1, int(cy / H * rows)), min(cols - 1, int(cx / W * cols)))
    b = (sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1)
    c = cells.get(key)
    cells[key] = b if c is None else (min(c[0], b[0]), min(c[1], b[1]), max(c[2], b[2]), max(c[3], b[3]))
assert len(cells) == rows * cols, f'{len(cells)} cases trouvées au lieu de {rows * cols}'
for idx, name in enumerate(names):
    if name == '-':
        continue
    b = cells[(idx // cols, idx % cols)]
    crop = im.crop(b)
    side = int(max(crop.size) * 1.06)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    sq.resize((size, size), Image.LANCZOS).save(f'{out}/{name}.webp', quality=90, method=6)
print(src.split('/')[-1], '->', len([n for n in names if n != '-']), 'fichiers', '(alpha natif)' if has_alpha else '(aperçu détouré)')
