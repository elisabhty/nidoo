"""Enlève le liseré blanc autour des figurines (le fond blanc de la planche resté collé aux bords) :
les pixels clairs du bord prennent la couleur du pixel intérieur le plus proche."""
import sys, re
import numpy as np
from PIL import Image
from scipy import ndimage
D = sys.argv[1]
ids = re.findall(r"id: '(\w+)'", open('/home/claude/nidoo/src/lib/persos.ts').read())
for pid in ids:
    im = np.array(Image.open(f'{D}/{pid}.webp').convert('RGBA')).astype(float)
    a = im[..., 3]
    solid = a > 200
    dist_out = ndimage.distance_transform_edt(solid)  # distance au bord, à l'intérieur
    edge = (a > 0) & (dist_out <= 3)
    rgb = im[..., :3]
    mn = rgb.min(axis=2); mx = rgb.max(axis=2)
    light = (mn > 200) & (mx - mn < 30)
    inner = solid & (dist_out > 3)
    # le pixel intérieur le plus proche
    _, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
    near = rgb[iy, ix]
    # seulement si l'intérieur voisin est nettement plus foncé (on ne touche pas aux habits blancs)
    darker = near.mean(axis=2) < mn - 25
    fix = edge & light & darker
    rgb[fix] = near[fix]
    # et on adoucit un peu ces bords
    a[fix & (dist_out <= 1)] *= 0.6
    out = np.dstack([rgb, a]).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(f'{D}/{pid}.webp', quality=88, method=6)
    print(pid, int(fix.sum()), end='  ')
