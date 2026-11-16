"""Bouche les petits trous dans la zone des cheveux (mèches, perles, ombres)."""
import re
import numpy as np
from PIL import Image
from scipy import ndimage
D = '/home/claude/nidoo/public/art/persos'
ids = re.findall(r"id: '(\w+)'", open('/home/claude/nidoo/src/lib/persos.ts').read())
for pid in ids:
    im = np.array(Image.open(f'{D}/{pid}.webp').convert('RGBA'))
    mk = np.array(Image.open(f'{D}/{pid}-m.webp').convert('RGB'))
    A = im[..., 3] > 60
    R, G, B = mk[..., 0], mk[..., 1].copy(), mk[..., 2]
    hair = G >= 128
    if not hair.any(): continue
    closed = ndimage.binary_closing(hair, iterations=2)
    holes = ndimage.binary_fill_holes(hair) & ~hair
    lab, n = ndimage.label(holes)
    small = np.zeros_like(hair)
    if n:
        sz = ndimage.sum(holes, lab, range(1, n + 1))
        small = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s < 60])
    add = (closed | small) & ~hair & A & (R < 100) & (B < 60)
    G[add] = 255
    Image.fromarray(np.dstack([R, G, B])).save(f'{D}/{pid}-m.webp', lossless=True)
    print(pid, int(add.sum()), end='  ')
