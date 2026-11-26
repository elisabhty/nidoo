"""Les défauts de détourage des compagnons (public/art/pet-<espèce>.webp) : là où un pelage blanc touchait le fond
blanc de la planche d'origine, le détourage a mordu dans l'animal (la tête et l'oreille du lapin, le haut de la tête
du panda). On retrouve ce qui manque dans la planche d'origine (sources/compagnons.jpg), recalée sur chaque image
(les mêmes points retrouvés dans les deux, à un quart de pixel près), et on le glisse derrière l'image actuelle : tout
ce qui existait reste tel quel, seuls les trous sont comblés.
On retire aussi ce qui restait de leur ombre au sol (voir sans_ombre).
  python3 scripts/banc/animaux_decoupe.py            # montre ce qui changerait : /tmp/t/banc/animaux-decoupe.png
  python3 scripts/banc/animaux_decoupe.py --ecrire"""
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage
from PIL import Image

ICI = Path(__file__).resolve().parent
ART = ICI.parents[1] / 'public/art'
ESPECES = ['chat', 'chien', 'lapin', 'renard', 'panda', 'koala', 'pingouin', 'hibou']   # dans l'ordre de la planche (4 × 2)
N = 400

def recaler(planche, i, pet):
    """La planche d'origine ramenée dans le cadre de l'image du compagnon (sur fond blanc)."""
    H0, W0 = planche.shape[:2]
    r, c = divmod(i, 4)
    x0, x1, y0, y1 = int(c * W0 / 4), int((c + 1) * W0 / 4), int(r * H0 / 2), int((r + 1) * H0 / 2)
    a = pet[..., 3:4] / 255.0
    blanc = (pet[..., :3] * a + 255 * (1 - a)).astype(np.uint8)
    g1 = cv2.resize(cv2.cvtColor(planche[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    g2 = cv2.cvtColor(blanc, cv2.COLOR_RGB2GRAY)
    det = cv2.SIFT_create(nfeatures=4000, contrastThreshold=0.01)
    k1, d1 = det.detectAndCompute(g1, None)
    k2, d2 = det.detectAndCompute(g2, None)
    paires = [p[0] for p in cv2.BFMatcher(cv2.NORM_L2).knnMatch(d1, d2, k=2) if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    p1 = np.float32([k1[m.queryIdx].pt for m in paires]) / 2 + np.array([x0, y0], np.float32)
    p2 = np.float32([k2[m.trainIdx].pt for m in paires])
    M, ok = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    ok = ok.ravel() == 1
    err = float(np.sqrt(((((M[:, :2] @ p1[ok].T).T + M[:, 2]) - p2[ok]) ** 2).sum(1)).mean())
    assert ok.sum() > 200 and err < 0.6, (int(ok.sum()), err)
    return cv2.warpAffine(planche, M, (N, N), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255)), err

def reparer(pet, origine):
    """L'image réparée, et ce qui a été comblé."""
    # l'animal, dans la planche : ce qui a une couleur franche (un pelage blanc y est crème : au moins un canal sous
    # 244 ; le fond et le dégradé du contour sont au-dessus) — d'un seul tenant, sans trous
    solide = origine.min(-1) <= 243
    lab_, n = ndimage.label(ndimage.binary_closing(solide, iterations=1))
    if n > 1:
        t = ndimage.sum(solide, lab_, range(1, n + 1))
        solide = lab_ == (1 + int(np.argmax(t)))
    plein = ndimage.binary_fill_holes(solide)
    yy = np.mgrid[0:N, 0:N][0]
    a = pet[..., 3].astype(np.float32) / 255
    # ce qui manque : plein dans la planche, vide dans l'image — au-dessus des pattes (dessous, c'est son ombre au sol)
    manque = plein & (a < 0.5) & (yy < 0.8 * N)
    # au moins 3 pixels d'épaisseur (le pixel de jeu du contour n'est pas une morsure), et 150 pixels d’un seul tenant
    manque = ndimage.binary_opening(manque, structure=np.ones((3, 3)))
    lab_, n = ndimage.label(manque)
    if n:
        t = ndimage.sum(manque, lab_, range(1, n + 1))
        manque = np.isin(lab_, [k + 1 for k, v in enumerate(t) if v >= 150])
    if not manque.any():
        return pet, manque
    # la pièce : la planche d'origine, là où il manque quelque chose (et un peu dessous l'ancien bord, pour se fondre),
    # un pixel rentré dans l'animal (son bord ne porte pas le blanc du fond)
    dedans = ndimage.binary_erosion(plein, iterations=1)
    zone = ndimage.binary_dilation(manque, iterations=3) & dedans
    pa = cv2.GaussianBlur(zone.astype(np.float32), (3, 3), 0.7) * dedans
    # les fentes qui resteraient entre l'ancien bord et la pièce (un reflet plus clair que le reste) : comblées aussi
    # autour de la pièce, tout l'intérieur de l'animal est plein : pas de fente ni de trou d'épingle entre l'ancien
    # bord (à demi transparent) et la pièce
    pa = np.maximum(pa, (ndimage.binary_dilation(manque, iterations=12) & ndimage.binary_erosion(plein, iterations=2)).astype(np.float32))
    # l'image actuelle devant, la pièce derrière
    oa = a + pa * (1 - a)
    rgb = (pet[..., :3].astype(np.float32) * a[..., None] + origine.astype(np.float32) * (pa * (1 - a))[..., None]) / np.maximum(oa, 1e-4)[..., None]
    out = pet.copy()
    out[..., :3] = np.where(oa[..., None] > 1e-3, np.clip(rgb + 0.5, 0, 255), pet[..., :3]).astype(np.uint8)
    out[..., 3] = np.clip(oa * 255 + 0.5, 0, 255).astype(np.uint8)
    return out, manque

def sans_ombre(pet):
    """Ce qui reste de l'ombre au sol dessinée dans la planche (un liseré gris très clair sous les pattes, qui faisait
    une tache blanche sur l'herbe ou dans la maison la nuit) s'en va. Le fin trait sombre du contact avec le sol reste :
    c'est lui qui pose l'animal."""
    a = pet[..., 3:4].astype(np.float32) / 255
    blanc = np.clip(pet[..., :3].astype(np.float32) * a + 255 * (1 - a), 0, 255).astype(np.uint8)
    L = cv2.cvtColor(blanc.astype(np.float32) / 255, cv2.COLOR_RGB2LAB)
    C = np.hypot(L[..., 1], L[..., 2])
    op = pet[..., 3] > 128
    yy = np.mgrid[0:N, 0:N][0]
    ombre = np.zeros((N, N), bool)
    # déjà fait ? une image nettoyée n'a presque plus de gris neutre très clair relié à l'extérieur, en bas (moins de
    # 70 pixels, contre plus de 200 avant) : on peut donc relancer le script sans rien rogner de plus
    neutre = op & (C < 6) & (L[..., 0] > 86) & (yy > 0.8 * N)
    if (ndimage.binary_dilation(~op, iterations=0, mask=(~op) | neutre) & neutre).sum() < 150:
        return pet, ombre
    for _ in range(4):
        avant = int(ombre.sum())
        reste = op & ~ombre
        # 1. le gris neutre et clair, en bas, relié à l'extérieur
        neutre = reste & (C < 6) & (L[..., 0] > 72) & (yy > 0.8 * N)
        ombre |= ndimage.binary_dilation(~reste, iterations=0, mask=(~reste) | neutre) & neutre
        # 2. sous le trait sombre du contact : les quelques pixels clairs qui restent, colonne par colonne
        reste = op & ~ombre
        for x in range(N):
            ys = np.where(reste[:, x])[0]
            if not len(ys) or ys.max() < 0.8 * N:
                continue
            yb = int(ys.max())
            clairs = []
            for y in range(yb, max(yb - 7, 0), -1):
                if L[y, x, 0] > 58 and C[y, x] < 18:
                    clairs.append(y)
                else:
                    # seulement si on arrive sur le trait sombre (sinon c'est du pelage clair : on n'y touche pas)
                    if L[y, x, 0] < 52 and clairs:
                        ombre[clairs, x] = True
                    break
        if int(ombre.sum()) == avant:
            break
    # les miettes qui se retrouvent détachées de l'animal partent aussi
    reste = op & ~ombre
    lab_, n = ndimage.label(reste)
    if n > 1:
        t = ndimage.sum(reste, lab_, range(1, n + 1))
        ombre |= np.isin(lab_, [k + 1 for k, v in enumerate(t) if v < 60]) & (yy > 0.8 * N)
    if ombre.sum() < 40:
        return pet, ombre
    out = pet.copy()
    al = out[..., 3].astype(np.float32)
    al[ombre] = 0
    # avec elle, son ancien contour à demi transparent : en bas, plus rien ne reste à plus d'un pixel de l'animal
    reste = op & ~ombre
    al[~ndimage.binary_dilation(reste, iterations=1) & (yy > 0.78 * N)] = 0
    doux = cv2.GaussianBlur(al, (3, 3), 0.7)
    pres = ndimage.binary_dilation(ombre, iterations=1)
    al[pres] = np.minimum(al[pres], doux[pres])
    out[..., 3] = al.astype(np.uint8)
    return out, ombre

if __name__ == '__main__':
    planche = np.array(Image.open(ICI / 'sources/compagnons.jpg').convert('RGB'))
    tuiles = []
    for i, e in enumerate(ESPECES):
        f = ART / f'pet-{e}.webp'
        pet = np.array(Image.open(f).convert('RGBA'))
        origine, err = recaler(planche, i, pet)
        out, manque = reparer(pet, origine)
        out, ombre = sans_ombre(out)
        print(e, '| recalage à', round(err, 2), 'px | comblé :', int(manque.sum()), 'px | ombre retirée :', int(ombre.sum()), 'px')
        if manque.any() or ombre.sum() >= 40:
            if '--ecrire' in sys.argv:
                Image.fromarray(out).save(f, quality=92, method=6, exact=True)
            for img in (pet, out):
                al = img[..., 3:4] / 255
                tuiles.append((img[..., :3] * al + np.array([40, 36, 80]) * (1 - al)).astype(np.uint8))
    if tuiles:
        cols = 4
        lignes = [np.concatenate(tuiles[k:k + cols] + [np.full((N, N, 3), 255, np.uint8)] * (cols - len(tuiles[k:k + cols])), 1) for k in range(0, len(tuiles), cols)]
        Image.fromarray(np.concatenate(lignes, 0)).save('/tmp/t/banc/animaux-decoupe.png')
