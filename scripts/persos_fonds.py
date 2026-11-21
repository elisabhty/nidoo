"""Les autres peaux des figurines (<id>-t<n>.webp) gardaient par endroits le fond blanc de l'image d'origine :
entre les couettes et les épaules, sous les bras… (Elisa, 21 novembre : des taches blanches autour du cou de la fillette).
La silhouette d'une autre peau est celle de la figurine de départ : là où la figurine de départ est transparente,
un pixel clair et sans couleur de l'autre peau est un reste de fond. On l'efface, en douceur sur le bord.

    python3 scripts/persos_fonds.py            # corrige les fichiers
    python3 scripts/persos_fonds.py --verifier # compte seulement
"""
import glob, os, re, sys
import numpy as np
from PIL import Image, ImageFilter

DOSSIER = os.path.join(os.path.dirname(__file__), '..', 'public', 'art', 'persos')


def nettoyer(variante, base):
    V = np.asarray(Image.open(variante).convert('RGBA')).astype(np.int16)
    B = np.asarray(Image.open(base).convert('RGBA')).astype(np.int16)
    if V.shape != B.shape:
        return None, 0
    rgb = V[..., :3]
    clair = (rgb.min(axis=2) > 196) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 34)
    hors = B[..., 3] < 70
    fond = clair & hors & (V[..., 3] > 0)
    n = int(fond.sum())
    A = V[..., 3].copy()
    A[fond] = np.minimum(A[fond], B[..., 3][fond])
    # le liseré blanc qui reste le long de la silhouette (autour du cou, sous les couettes) : à moins de 3 px du fond,
    # un pixel presque blanc et sans couleur s'efface d'autant plus qu'il est blanc
    pres = np.asarray(Image.fromarray(((B[..., 3] < 70) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    blanc = np.clip((rgb.min(axis=2) - 188) / 40, 0, 1) * ((rgb.max(axis=2) - rgb.min(axis=2)) < 36)
    A = (A * (1 - blanc * pres)).astype(np.int16)
    out = V.copy()
    out[..., 3] = A
    return Image.fromarray(out.astype(np.uint8), 'RGBA'), n + int(((blanc * pres) > 0.3).sum())


def main():
    verifier = '--verifier' in sys.argv
    total = 0
    for f in sorted(glob.glob(os.path.join(DOSSIER, '*-t[0-9]*.webp'))):
        m = re.match(r'(.+?)-t\d+\.webp$', os.path.basename(f))
        if not m or f.endswith('-v.webp'):
            continue
        base = os.path.join(DOSSIER, m.group(1) + '.webp')
        if not os.path.exists(base):
            continue
        im, n = nettoyer(f, base)
        if n >= 20:
            total += 1
            if not verifier:
                im.save(f, 'WEBP', quality=90, method=6)
    print(('à corriger : ' if verifier else 'corrigées : ') + str(total))


if __name__ == '__main__':
    main()
