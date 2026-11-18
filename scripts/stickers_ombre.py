"""Enlève l'ombre portée foncée cuite autour des stickers émojis (elle venait de la photo de la planche).
Seul le presque-noir relié au vide autour du sticker part ; les yeux et les lunettes, à l'abri derrière le bord blanc, restent.
(Le trou de l'auréole de emo-ange a ensuite été vidé à la main de la même façon.)
usage: stickers_ombre.py dossier_de_sortie   (depuis la racine du projet)"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage
out = sys.argv[1]
for f in sorted(glob.glob('public/art/stickers/emo-*.webp')):
    im = np.asarray(Image.open(f).convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    # l'ombre : du presque noir relié au vide autour du sticker (les yeux, eux, sont à l'abri derrière le bord blanc)
    sombre = (lum < 90) | (a < 128)
    lbl, n = ndimage.label(sombre)
    bord = set(np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]]))) - {0}
    ombre = np.isin(lbl, list(bord))
    fuite = ombre & (a > 128) & (lum > 60)
    # la lisière entre le bord blanc et l'ombre : on la fond (plus elle est sombre, plus elle est transparente)
    lisiere = ndimage.binary_dilation(ombre, iterations=3) & ~ombre & (lum < 215)
    k = np.clip((lum - 90) / (215 - 90), 0, 1)
    a2 = np.where(ombre, 0, np.where(lisiere, a * k, a))
    rgb2 = np.where((ombre | lisiere)[..., None], 255, rgb)
    res = np.dstack([rgb2, a2]).clip(0, 255).astype(np.uint8)
    Image.fromarray(res, 'RGBA').save(os.path.join(out, os.path.basename(f)), 'WEBP', quality=88, method=6)
    print(os.path.basename(f), 'fuite', int(fuite.sum()), 'enlevé', int((ombre & (a > 128)).sum()))
