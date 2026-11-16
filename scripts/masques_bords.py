"""Après l'enlèvement du liseré blanc : les pixels du bord (devenus de la couleur des cheveux ou de la peau)
rejoignent le masque de leur voisin, pour être recolorés eux aussi."""
import re
import numpy as np
from PIL import Image
from scipy import ndimage
D = '/home/claude/nidoo/public/art/persos'
ids = re.findall(r"id: '(\w+)'", open('/home/claude/nidoo/src/lib/persos.ts').read())
for pid in ids:
    im = np.array(Image.open(f'{D}/{pid}.webp').convert('RGBA'))
    mk = np.array(Image.open(f'{D}/{pid}-m.webp').convert('RGB')).astype(np.uint8)
    a = im[..., 3]
    dist_out = ndimage.distance_transform_edt(a > 200)
    band = (a > 0) & (dist_out <= 4)
    R, G, B = mk[..., 0].copy(), mk[..., 1].copy(), mk[..., 2]
    free = band & (R < 100) & (G < 100) & (B < 60)
    gR = ndimage.grey_dilation(R, size=7); gG = ndimage.grey_dilation(G, size=7)
    takeG = free & (gG >= 128) & (gG >= gR)
    takeR = free & (gR >= 128) & (gR > gG)
    G[takeG] = 255; R[takeR] = 255
    Image.fromarray(np.dstack([R, G, B])).save(f'{D}/{pid}-m.webp', lossless=True)
    print(pid, int(takeG.sum()), int(takeR.sum()), end='  ')
