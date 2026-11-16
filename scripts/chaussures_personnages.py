"""Répare les baskets blanches « mangées » par le détourage (fond blanc) :
chaque chaussure est recopiée en miroir SOUS l'autre (on ne remplace aucun
pixel existant, on comble seulement les trous, le plus souvent à droite).

usage : python3 chaussures.py [--write] fichier.webp ...
"""
import sys
import numpy as np
from PIL import Image


def lab_lc(rgb):
    r, g, b = [rgb[..., i] / 255.0 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    return mx * 100, (mx - mn) * 100  # « clarté » et « couleur » approximatives


def repare(im):
    a = np.array(im.convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]
    al = a[..., 3]
    L, C = lab_lc(a[..., :3])
    blanc = (al > 160) & (L > 80) & (C < 16)
    y0 = int(H * 0.86)
    # colonnes occupées tout en bas : on sépare les deux pieds par le trou du milieu
    bas = (al[H - 14:H - 2] > 100).any(axis=0)
    xs = np.nonzero(bas)[0]
    if len(xs) < 20:
        return None, 'pas de pieds'
    mid = (xs.min() + xs.max()) / 2
    cols = np.arange(W)
    trou = [x for x in range(int(mid - 25), int(mid + 25)) if not bas[x]]
    if not trou:
        # pieds collés : on coupe au milieu de la silhouette
        trou = [int(mid)]
    g1 = min(trou) - 1  # bord intérieur du pied gauche
    d0 = max(trou) + 1  # bord intérieur du pied droit
    gauche = blanc[y0:, :g1 + 1].sum()
    if gauche < 120:
        return None, 'pas de baskets blanches'
    # haut des chaussures : première ligne où la chaussure gauche est bien blanche
    lignes = blanc[y0:, xs.min():g1 + 1].sum(axis=1)
    larg = max(1, g1 + 1 - xs.min())
    hauts = np.nonzero(lignes > larg * 0.25)[0]
    if not len(hauts):
        return None, 'pas de haut'
    ytop = y0 + hauts[0] - 2
    # décalage vertical : on aligne le bas des deux pieds (côté intérieur, rarement abîmé)
    def bas_de(x0, x1):
        ys = np.nonzero((al[:, x0:x1] > 128).any(axis=1))[0]
        return ys.max() if len(ys) else None
    bg = bas_de(max(0, g1 - 12), g1 + 1)
    bd = bas_de(d0, min(W, d0 + 13))
    dy = 0 if bg is None or bd is None else int(np.clip(bd - bg, -4, 4))
    axe = (g1 + d0) / 2.0
    out = a.copy()
    ajoute = 0
    for y in range(ytop, H):
        for x in range(W):
            if abs(x - axe) < 0.5 or (x < axe and y < ytop + 5):
                continue
            # le pied droit est un peu plus haut/bas que le gauche : dy dans un sens, -dy dans l'autre
            ys = y - dy if x > axe else y + dy
            xs_ = int(round(2 * axe - x))
            if ys < 0 or ys >= H or xs_ < 0 or xs_ >= W:
                continue
            s = a[ys, xs_]
            if s[3] < 8:
                continue
            ls, cs = L[ys, xs_], C[ys, xs_]
            # on ne recopie que la chaussure (blanche) et son contour
            if not (ls > 72 and cs < 20):
                # contour à demi transparent : seulement s'il est clair (pas un bout de pantalon)
                if s[3] > 200 or ls < 62 or cs > 24:
                    continue
            dpx = out[y, x]
            da = dpx[3] / 255.0
            sa = s[3] / 255.0
            if sa <= da + 0.05:
                continue
            # le pixel existant reste devant, la copie miroir passe dessous
            oa = da + sa * (1 - da)
            rgb = (dpx[:3] * da + s[:3] * sa * (1 - da)) / max(oa, 1e-6)
            out[y, x, :3] = rgb
            out[y, x, 3] = oa * 255
            ajoute += 1
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA'), f'+{ajoute}px axe={axe:.1f} dy={dy} haut={ytop}'


if __name__ == '__main__':
    write = '--write' in sys.argv
    for f in [x for x in sys.argv[1:] if not x.startswith('--')]:
        im = Image.open(f)
        res, msg = repare(im)
        print(f, msg)
        if res is not None and write:
            res.save(f, 'WEBP', quality=88, method=6)
