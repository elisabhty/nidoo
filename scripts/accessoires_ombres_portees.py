"""Les ombres portées des accessoires de la boutique (public/art/persos/acc-*-ombre.webp).

Chaque ombre est la silhouette floutée de l'accessoire, avec une marge de 10 % de sa largeur tout autour
(le flou déborde). Dans l'appli, elle est décalée vers le bas et découpée à la forme de la figurine :
le chapeau assombrit le front et les cheveux, l'écharpe le haut du pull, sans jamais déborder sur le fond.
Usage : python3 scripts/accessoires_ombres_portees.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

DOSSIER = Path(__file__).resolve().parent.parent / 'public/art/persos'
NOMS = ['bonnet', 'casquette', 'paille', 'fleurs', 'echarpe', 'couronne', 'noeud', 'manteau', 'fourrure', 'trench', 'blazer', 'robe', 'jupe', 'short', 'colroule', 'chemise', 'mariniere', 'torsade', 'sweat', 'gilet', 'jean']
MARGE = 0.1  # fraction de la largeur, de chaque côté

# les habits « portés » (manches le long du corps, scripts/habits_poses.py) ont leur propre image : hab-<nom>.webp
POSES = ['colroule', 'chemise', 'mariniere', 'torsade', 'sweat', 'gilet', 'manteau', 'fourrure', 'trench', 'blazer']

for nom in NOMS + [f'hab:{n}' for n in POSES]:
    prefixe, nom = ('hab', nom[4:]) if nom.startswith('hab:') else ('acc', nom)
    im = Image.open(DOSSIER / f'{prefixe}-{nom}.webp').convert('RGBA')
    w, h = im.size
    m = int(round(w * MARGE))
    al = Image.new('L', (w + 2 * m, h + 2 * m), 0)
    al.paste(im.getchannel('A'), (m, m))
    al = al.filter(ImageFilter.GaussianBlur(w * 0.035))
    a = (np.array(al).astype(float) * 0.85).astype(np.uint8)
    out = np.zeros((*a.shape, 4), np.uint8)
    out[..., :3] = (38, 26, 30)  # une ombre chaude, pas un gris froid
    out[..., 3] = a
    Image.fromarray(out).save(DOSSIER / f'{prefixe}-{nom}-ombre.webp', quality=80, method=6)
    print(nom, w, h, '→', out.shape[1], out.shape[0])
