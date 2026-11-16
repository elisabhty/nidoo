"""Repères des personnages (toile 300x440) : haut de la tête, hauteur de tête, centre, largeur du crâne
et de la chevelure, cadre du buste. usage: perso_meta.py dossier sortie.json"""
import sys, json, glob, os
import numpy as np
from PIL import Image
HEAD = {'f': 0.42, 'h': 0.42, 'gf': 0.42, 'gm': 0.42, 'fi': 0.46, 'gi': 0.46, 'fa': 0.44, 'ga': 0.44, 'b': 0.5}
out = {}
for p in sorted(glob.glob(sys.argv[1] + '/*.webp')):
    n = os.path.basename(p)[:-5]
    pre = ''.join(c for c in n if c.isalpha())
    k = HEAD[pre]
    a = np.array(Image.open(p))[..., 3] > 80
    H, W = a.shape
    ys, xs = np.where(a)
    top, bot = ys.min(), ys.max()
    hh = (bot - top) * k
    def width(y):
        r = np.where(a[int(y)])[0]
        return (r.min(), r.max()) if len(r) else (0, 0)
    up = a[top: top + int(hh * 0.3)]
    cx = np.where(up)[1].mean()
    l, r = width(top + hh * 0.3)
    crown = r - l
    hw = max(width(y)[1] - width(y)[0] for y in range(top, top + int(hh)))
    side = max(hh * 1.3, min(hw, hh * 1.25) * 1.08)
    out[n] = {'t': round(top / H, 4), 'h': round(hh / H, 4), 'x': round(cx / W, 4), 'c': round(crown / W, 4), 'w': round(hw / W, 4),
              'bx': round((cx - side / 2) / W, 4), 'by': round((top - side * 0.04) / H, 4), 'bs': round(side / W, 4)}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print(len(out), 'personnages')
