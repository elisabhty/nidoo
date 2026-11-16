"""Prépare les coloriages : le trait (noir sur transparent) et la carte des zones pour le pot de peinture.
Chaque page est mise à la taille de la feuille (1000 x 467). Les zones fermées sont numérotées
(rouge + vert x 256) ; les pixels du trait reviennent à la zone la plus proche, pour qu'il n'y ait
pas de liseré blanc entre la couleur et le trait.
usage: coloriages.py dossier_source dossier_sortie cle1 cle2 ..."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out, keys = sys.argv[1], sys.argv[2], sys.argv[3:]
W, H = 1000, 467
for k in keys:
    g = np.array(Image.open(f'{src}/{k}.jpg').convert('L')).astype(np.float32)
    # le cadre rectangulaire que l'IA ajoute parfois sur les bords : seulement les lignes presque pleines,
    # pour garder les traits qui touchent le bord (le sol, une branche) et qui ferment leurs zones
    for i in list(range(12)) + list(range(-12, 0)):
        if (g[i, :] < 140).mean() > 0.5:
            g[i, :] = 255
        if (g[:, i] < 140).mean() > 0.5:
            g[:, i] = 255
    im = Image.fromarray(g.clip(0, 255).astype(np.uint8))
    # à la largeur de la feuille, puis on garde le milieu en hauteur
    s = W / im.width
    im = im.resize((W, round(im.height * s)), Image.LANCZOS)
    top = (im.height - H) // 2
    g = np.array(im.crop((0, top, W, top + H))).astype(np.float32)
    # le trait : encre sombre, transparent ailleurs
    a = np.clip((235 - g) / 150, 0, 1)
    art = np.zeros((H, W, 4), np.uint8)
    art[..., 0], art[..., 1], art[..., 2] = 0x24, 0x1F, 0x33
    art[..., 3] = (a * 255).astype(np.uint8)
    Image.fromarray(art).save(f'{out}/{k}.webp', lossless=True, method=6)
    # les zones : ce qui n'est pas du trait, avec le trait un peu épaissi pour fermer les petits trous
    trait = ndimage.binary_dilation(g < 170, iterations=1)
    lab, n = ndimage.label(~trait)
    sz = ndimage.sum(np.ones_like(lab), lab, range(n + 1))
    petit = sz < 40
    petit[0] = True
    lab[petit[lab]] = 0
    # chaque pixel sans zone (trait, miettes) rejoint la zone la plus proche
    _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    lab = lab[iy, ix]
    # numéros consécutifs
    u, inv = np.unique(lab, return_inverse=True)
    lab = (inv.reshape(lab.shape) + 1).astype(np.uint32)
    z = np.zeros((H, W, 3), np.uint8)
    z[..., 0] = lab & 255
    z[..., 1] = (lab >> 8) & 255
    Image.fromarray(z).save(f'{out}/{k}-z.png', optimize=True)
    print(k, 'zones', len(u))
