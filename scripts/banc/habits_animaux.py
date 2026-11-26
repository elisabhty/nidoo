"""Les objets de l'animalerie (public/art/habit-*, lit-*, jeu-*, shop-*.webp) avaient leur ombre portée dessinée dans
l'image : un aplat gris clair en bas à droite, et un liseré blanc tout autour (ils ont été détourés sur fond blanc).
Sur l'animal, sur l'herbe de sa page ou dans la maison la nuit, ça faisait une languette blanche. On redécoupe l'objet
seul : ce qui a ses couleurs d'un côté, le gris neutre de l'ombre et le blanc du fond de l'autre, et la frontière passe
là où les deux se séparent le mieux (GrabCut).
  python3 scripts/banc/habits_animaux.py [--ecrire]     # planche de contrôle : /tmp/t/banc/habits-animaux.png
Une image déjà nettoyée (plus d'ombre) est laissée telle quelle : on peut relancer sans risque."""
import sys, math, subprocess, io
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage
from PIL import Image

RACINE = Path(__file__).resolve().parents[2]
ART = RACINE / 'public/art'
# nom : la clarté (L) au-dessus de laquelle un gris neutre est de l'ombre (la souris est grise : son ombre est plus claire qu'elle)
OBJETS = {
    'habit-noeud': 40, 'habit-bandana': 40, 'habit-bonnet': 40, 'habit-pull': 40,
    'lit-arbre': 40, 'lit-coussin': 40, 'lit-niche': 40, 'lit-panier': 40,
    'shop-gamelle': 40, 'shop-friandises': 40, 'shop-engrais': 40,
    'jeu-balle': 40, 'jeu-os': 40, 'jeu-pelote': 40, 'jeu-plumeau': 40, 'jeu-souris': 64,
}
ROSEE = {'habit-noeud', 'jeu-balle', 'jeu-pelote'}   # objets rouges ou roses : leur ombre en est teintée

def lab(rgb):
    return cv2.cvtColor(np.ascontiguousarray(rgb[..., :3]).astype(np.float32) / 255, cv2.COLOR_RGB2LAB)

def ombre_de(im, clair):
    """Le cœur de l'ombre : gris bien neutre, clair, relié à l'extérieur de l'objet."""
    a = im[..., 3:4].astype(np.float32) / 255
    blanc = np.clip(im[..., :3].astype(np.float32) * a + 255 * (1 - a), 0, 255).astype(np.uint8)
    L = lab(blanc)
    op = im[..., 3] > 128
    C = np.hypot(L[..., 1], L[..., 2])
    neutre = op & (C < 5) & (L[..., 0] > clair + 5)
    return blanc, L, C, op, ndimage.binary_dilation(~op, iterations=0, mask=(~op) | neutre) & neutre

def plus_gros(m):
    lab_, n = ndimage.label(m)
    if n <= 1:
        return m
    t = ndimage.sum(m, lab_, range(1, n + 1))
    return lab_ == (1 + int(np.argmax(t)))

def objet_gris(im, clair):
    """Un objet gris (la souris) : sa couleur est celle d'une ombre, GrabCut s'y perd. On retire seulement le cœur de
    l'ombre : gris neutre, plus clair que lui, relié à l'extérieur, et sous lui (dans le bas de l'image)."""
    blanc, L, C, op, ombre = ombre_de(im, clair)
    ys = np.where(op.any(1))[0]
    bas = np.mgrid[0:im.shape[0], 0:im.shape[1]][0] > ys.min() + 0.6 * (ys.max() - ys.min())
    ombre = ndimage.binary_dilation(ombre & bas, iterations=2) & op & bas & (C < 9) & (L[..., 0] > clair - 4)
    if ombre.sum() < 150:
        return None
    reste = op & ~ombre
    # d'un seul tenant, un pixel rentré (le liseré blanc part avec), plus ses traits fins et sombres (les moustaches)
    corps = ndimage.binary_erosion(plus_gros(ndimage.binary_opening(reste, iterations=1)), iterations=1)
    m = corps | (reste & (L[..., 0] < 45))
    return cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7)

def deja_propre(im):
    """Une image pas encore nettoyée a un liseré blanc tout autour (le reste du fond blanc) : plus des trois quarts de
    son contour ; une image nettoyée, presque plus."""
    a = im[..., 3:4].astype(np.float32) / 255
    L = lab(np.clip(im[..., :3].astype(np.float32) * a + 255 * (1 - a), 0, 255).astype(np.uint8))
    op = im[..., 3] > 128
    bord = op & ndimage.binary_dilation(~op, iterations=1)
    return float(((L[..., 0] > 88) & (np.hypot(L[..., 1], L[..., 2]) < 9))[bord].mean()) < 0.3

def objet(im, clair=40, rosee=False):
    """Le masque (0 à 1, bord adouci) de l'objet sans son ombre, ou None s'il est déjà propre."""
    if deja_propre(im):
        return None
    if clair > 50:
        return objet_gris(im, clair)
    blanc, L, C, op, ombre = ombre_de(im, clair)
    if ombre.sum() < 150:
        return None
    # sûrement l'objet : ce qui a de la couleur, loin du bord ; sûrement le fond : hors de l'image et le cœur de l'ombre
    couleur = ndimage.binary_erosion(op & ((C > 18) | (L[..., 0] < clair - 6)), iterations=4)
    g = np.full(im.shape[:2], cv2.GC_PR_FGD, np.uint8)
    g[ombre] = cv2.GC_PR_BGD
    g[ndimage.binary_erosion(ombre, iterations=2)] = cv2.GC_BGD
    g[~op] = cv2.GC_BGD
    g[couleur] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(cv2.cvtColor(blanc, cv2.COLOR_RGB2BGR), g, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    m = (g == cv2.GC_FGD) | (g == cv2.GC_PR_FGD)
    m = ndimage.binary_fill_holes(plus_gros(m))
    # ce qui reste d'ombre contre l'objet (teintée par lui, GrabCut l'a prise pour un pois clair du tissu) : presque
    # sans couleur — ou un peu rosée par un objet rouge — et reliée à l'extérieur ; un vrai pois est entouré de tissu
    reste = (C < 8)
    if rosee:
        reste |= (C < 24) & (L[..., 0] < 78) & (L[..., 1] > 1) & (L[..., 1] < 20) & (L[..., 2] > -2) & (L[..., 2] < L[..., 1] + 3)
    reste &= m & (L[..., 0] > clair)
    m &= ~(ndimage.binary_dilation(~m, iterations=0, mask=(~m) | reste) & reste)
    m = plus_gros(ndimage.binary_opening(m, iterations=1))
    # un pixel rentré (le liseré blanc du détourage part avec), bord adouci
    m = ndimage.binary_erosion(m, iterations=1)
    return cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7)

def avant(nom):
    """L'image telle qu'elle est dans le dernier commit (pour la planche de contrôle)."""
    r = subprocess.run(['git', '-C', str(RACINE), 'show', f'HEAD:public/art/{nom}.webp'], capture_output=True)
    return np.array(Image.open(io.BytesIO(r.stdout)).convert('RGBA')) if r.returncode == 0 else None

if __name__ == '__main__':
    noms = [a for a in sys.argv[1:] if not a.startswith('--')] or list(OBJETS)
    t = []
    for nom in noms:
        f = ART / f'{nom}.webp'
        im = np.array(Image.open(f).convert('RGBA'))
        m = objet(im, OBJETS.get(nom, 40), nom in ROSEE)
        if m is None:
            print(nom, ': déjà propre')
            out = im
        else:
            out = im.copy()
            out[..., 3] = np.round(im[..., 3].astype(np.float32) * m).astype(np.uint8)
            ys, xs = np.where(out[..., 3] > 128)
            print(nom, '| retiré :', int(((im[..., 3] > 128) & (out[..., 3] < 128)).sum()), 'px | objet :', (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
            if '--ecrire' in sys.argv:
                Image.fromarray(out).save(f, quality=92, method=6, exact=True)
        ref = avant(nom)
        for img in ((ref if ref is not None else im), out):
            for fond in ([150, 205, 140], [40, 36, 80]):
                a = img[..., 3:4] / 255
                t.append(cv2.resize((img[..., :3] * a + np.array(fond) * (1 - a)).astype(np.uint8), (200, 200), interpolation=cv2.INTER_AREA))
    lignes = [np.concatenate(t[i:i + 8] + [np.full((200, 200, 3), 255, np.uint8)] * (8 - len(t[i:i + 8])), 1) for i in range(0, len(t), 8)]
    Image.fromarray(np.concatenate(lignes, 0)).save('/tmp/t/banc/habits-animaux.png')
