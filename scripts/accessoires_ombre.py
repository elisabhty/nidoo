"""Retire l'ombre grise et le liseré blanc laissés autour des accessoires de la boutique
(public/art/persos/acc-*.webp) : sur une figurine, ils faisaient des taches blanches
sous les lunettes, sous le chapeau, entre les pans de l'écharpe…

On enlève les pixels gris (peu colorés, assez clairs) reliés au fond transparent. Le pompon du bonnet
est protégé ; la couronne de fleurs ne garde que son arc de devant.
À lancer une seule fois, sur les images d'origine (git show fdfa56f:public/art/persos/acc-*.webp).
Usage : python3 scripts/accessoires_ombre.py [dossier_origine] [dossier_sortie] [noms…]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

DOSSIER = Path(__file__).resolve().parent.parent / 'public/art/persos'
NOMS = ['bonnet', 'casquette', 'paille', 'fleurs', 'echarpe', 'lunettes', 'couronne', 'noeud', 'boucle']


def nettoie(nom: str, im: Image.Image) -> Image.Image:
    a = np.array(im.convert('RGBA')).astype(int)
    al = a[..., 3]
    rgb = a[..., :3]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    vide = al < 12
    gris = (sat < 0.3) & (mx > 110) & ~vide
    H = a.shape[0]
    if nom == 'bonnet':
        gris[: int(H * 0.4)] = False  # le pompon
    if nom == 'echarpe':
        # l'écharpe était vue d'en haut : un anneau dont on voyait le trou, comme un beignet posé sur
        # la poitrine. On retire l'arrière de l'anneau et son ouverture : il reste le devant enroulé,
        # qui remonte un peu de chaque côté du cou, et les deux pans.
        yy, xx = np.mgrid[0:H, 0 : a.shape[1]]
        cx, cy, ra, rb = 152, 50, 56, 34  # l'ouverture de l'anneau
        trou = ((xx - cx) / ra) ** 2 + ((yy - cy) / rb) ** 2 < 1
        cote = np.abs(xx - cx) - ra
        dos = (yy < cy + 16 * np.clip(cote / 50, 0, None) ** 2) & ~((yy >= cy) & (cote < 0))
        coupe = np.where(trou | dos, 0, 255).astype(np.uint8)
        coupe = np.array(Image.fromarray(coupe).filter(ImageFilter.GaussianBlur(1.2)))
        al = np.minimum(al, coupe)
    if nom == 'fleurs':
        # les pétales blancs des pâquerettes : clairs et tout près d'un cœur jaune ou d'une feuille
        colore = (sat > 0.35) & ~vide
        loin = ndimage.distance_transform_edt(~colore) > 11
        gris &= (mn < 222) | loin
    lab, _ = ndimage.label(gris | vide)
    touche = np.unique(lab[vide])
    ombre = np.isin(lab, touche[touche > 0]) & gris
    al = np.where(ombre, 0, al)
    # un bord doux : on rogne d'un pixel et on adoucit
    m = Image.fromarray(al.astype(np.uint8))
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    al = np.minimum(al, np.array(m))
    if nom == 'fleurs':
        # le dos de la couronne reposait sur un socle blanc : on ne garde que l'arc de devant
        # (fleurs roses et jaunes, feuilles), d'un seul tenant, qui se pose en serre-tête
        al[: int(H * 0.5)] = 0
        lab, n = ndimage.label(al > 40)
        if n:
            tailles = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            garde = ndimage.binary_dilation(lab == int(np.argmax(tailles)) + 1, iterations=2)
            al = np.where(garde, al, 0)
    out = np.dstack([rgb, al]).astype(np.uint8)
    im = Image.fromarray(out)
    # on recadre au plus juste
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())


if __name__ == '__main__':
    # python3 scripts/accessoires_ombre.py [dossier_origine] [dossier_sortie] [noms…]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DOSSIER
    sortie = Path(sys.argv[2]) if len(sys.argv) > 2 else DOSSIER
    noms = sys.argv[3:] or NOMS
    sortie.mkdir(parents=True, exist_ok=True)
    for nom in noms:
        f = source / f'acc-{nom}.webp'
        nettoie(nom, Image.open(f)).save(sortie / f.name, quality=92, method=6)
        print('propre :', f.name)
