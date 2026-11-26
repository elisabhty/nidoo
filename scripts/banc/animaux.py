"""Les compagnons (public/art/pet-<espèce>.webp) : de quoi poser leurs habits comme s'ils les portaient.
Pour chaque animal, on mesure sur son image (ses yeux, sa silhouette) :
- src/lib/animaux.ts : ses repères, en fractions de l'image — le milieu de ses yeux et leur écart, le haut de son
  crâne (sans les oreilles), la largeur de sa tête au front, le milieu de son corps, le haut de ses pattes arrière ;
- public/art/pet-<espèce>-corps.webp : son corps sans sa queue, à la forme duquel le pull est découpé (sinon une
  manche du pull recouvrait la queue du renard).
  python3 scripts/banc/animaux.py            # mesure, dessine la planche de contrôle /tmp/t/banc/animaux-anat.png
  python3 scripts/banc/animaux.py --ecrire   # écrit les repères et les images"""
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[2]
ART = RACINE / 'public/art'
ESPECES = ['chat', 'chien', 'lapin', 'renard', 'panda', 'koala', 'pingouin', 'hibou']
N = 400
yy, xx = np.mgrid[0:N, 0:N]
# où commencent les pattes arrière (le pull s'arrête là) : les oiseaux ont de petites pattes tout en bas
PIEDS = {'pingouin': 0.875, 'hibou': 0.885}
# ceux qui ont des ailes le long du corps : les manches du pull tombent dessus (les autres, assis de face, n'ont pas de
# bras à y glisser : leur pull est sans manches)
MANCHES = {'pingouin', 'hibou'}
# les « yeux » du panda sont ses taches noires : ses vrais yeux sont un peu plus rapprochés
ECART = {'panda': 0.86}

def image(e):
    return np.array(Image.open(ART / f'pet-{e}.webp').convert('RGBA'))

def lab(rgb):
    return cv2.cvtColor(np.ascontiguousarray(rgb[..., :3]).astype(np.float32) / 255, cv2.COLOR_RGB2LAB)

def yeux(im):
    """Les deux yeux : les deux gros disques sombres, à la même hauteur, dans la moitié haute de l'image
    (le museau, seul au milieu, n'a pas de jumeau)."""
    L = lab(im)
    op = im[..., 3] > 200
    sombre = ndimage.binary_opening(op & (L[..., 0] < 30), iterations=2)
    lab_, n = ndimage.label(sombre)
    cands = []
    for i in range(1, n + 1):
        m = lab_ == i
        a = int(m.sum())
        if not (150 <= a <= 7000):
            continue
        ys, xs = np.where(m)
        w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        if 0.6 < w / h < 1.6 and a > 0.55 * w * h and ys.mean() < 0.6 * N:
            cands.append((float(xs.mean()), float(ys.mean()), float(np.sqrt(a / np.pi)), a))
    meilleur = None
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            a, b = cands[i], cands[j]
            if abs(a[1] - b[1]) < 20 and 60 < abs(a[0] - b[0]) < 170 and min(a[3], b[3]) > 0.5 * max(a[3], b[3]):
                if meilleur is None or a[3] + b[3] > meilleur[0]:
                    meilleur = (a[3] + b[3], a, b)
    if not meilleur:
        return None
    return tuple(sorted(meilleur[1:], key=lambda q: q[0]))

def bande(ligne, x):
    """Le morceau plein de cette ligne qui contient x : (gauche, droite), ou None."""
    x = int(round(x))
    if not ligne[x]:
        return None
    g = d = x
    while g > 0 and ligne[g - 1]:
        g -= 1
    while d < N - 1 and ligne[d + 1]:
        d += 1
    return g, d

def mesurer(e):
    im = image(e)
    op = im[..., 3] > 128
    yg, yd = yeux(im)
    ex, ey = (yg[0] + yd[0]) / 2, (yg[1] + yd[1]) / 2
    d = (yd[0] - yg[0]) * ECART.get(e, 1)
    # le crâne : le haut de la silhouette entre les yeux (les oreilles sont sur les côtés) — jamais plus de 1,1 écart
    # au-dessus des yeux (les oreilles du lapin se rejoignent au milieu)
    col = op[:, int(ex - 0.25 * d):int(ex + 0.25 * d) + 1].any(1)
    crane = max(float(np.where(col)[0].min()), ey - 1.1 * d)
    # la largeur de la tête au front, sans les oreilles
    b = bande(op[int(ey - 0.5 * d)], ex)
    tw = min(b[1] - b[0], 2.5 * d)
    cou = ey + 0.6 * d
    pieds = PIEDS.get(e, 0.815) * N
    # le milieu du corps : à mi-chemin entre le milieu des yeux et celui de la silhouette, sous la tête
    xs = np.where(op[int(min(N - 1, ey + 1.55 * d))])[0]
    xc = 0.5 * ex + 0.5 * float(np.median(xs))
    # son corps sans sa queue : ligne par ligne, autour du milieu, pas plus large d'un côté que de l'autre (à 8 % près)
    corps = np.zeros((N, N), bool)
    for y in range(int(cou - 0.3 * d), N):
        r = bande(op[y], xc)
        if not r:
            continue
        demi = min(xc - r[0], r[1] - xc) * 1.08 + 2
        corps[y, max(r[0], int(xc - demi)):min(r[1], int(xc + demi)) + 1] = True
    # lissé de haut en bas (une ligne ne peut pas être bien plus étroite que ses voisines)
    corps = ndimage.binary_closing(corps, structure=np.ones((9, 1))) & op
    # la largeur de son corps (la médiane, du cou aux pattes) : le pull est taillé d'après elle
    larg = [np.ptp(np.where(corps[y])[0]) + 1 for y in range(int(cou), int(pieds)) if corps[y].any()]
    cw = float(np.median(larg))
    return dict(im=im, ex=ex, ey=ey, d=d, crane=crane, tw=tw, xc=xc, cw=cw, pieds=pieds, cou=cou, corps=corps)

if __name__ == '__main__':
    ecrire = '--ecrire' in sys.argv
    tuiles, lignes = [], []
    for e in ESPECES:
        a = mesurer(e)
        im = a['im']
        al = im[..., 3:4] / 255
        o = (im[..., :3] * al + np.array([242, 241, 248]) * (1 - al)).astype(np.float32)
        o[a['corps']] = o[a['corps']] * 0.55 + np.array([60, 190, 120]) * 0.45
        T = Image.fromarray(o.astype(np.uint8))
        dr = ImageDraw.Draw(T)
        yf = a['ey'] - 0.5 * a['d']
        dr.line([(a['ex'] - a['tw'] / 2, yf), (a['ex'] + a['tw'] / 2, yf)], fill=(0, 200, 255), width=2)
        for y, c in ((a['crane'], (0, 200, 0)), (a['cou'], (255, 200, 0)), (a['pieds'], (255, 0, 200))):
            dr.line([(a['xc'] - 60, y), (a['xc'] + 60, y)], fill=c, width=2)
        for q in ((a['ex'] - a['d'] / 2, a['ey']), (a['ex'] + a['d'] / 2, a['ey'])):
            dr.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=(255, 0, 0))
        dr.text((4, 2), e, fill=(0, 0, 0))
        tuiles.append(T.resize((240, 240), Image.LANCZOS))
        lignes.append(f"  {e}: {{ ex: {a['ex'] / N:.3f}, ey: {a['ey'] / N:.3f}, d: {a['d'] / N:.3f}, crane: {a['crane'] / N:.3f}, tw: {a['tw'] / N:.3f}, xc: {a['xc'] / N:.3f}, cw: {a['cw'] / N:.3f}, pieds: {a['pieds'] / N:.3f}, manches: {'true' if e in MANCHES else 'false'} }},")
        print(lignes[-1])
        if ecrire:
            # le masque du corps : blanc, opaque là où le pull peut se voir ; bord adouci, et jamais plus que l'animal
            m = cv2.GaussianBlur(a['corps'].astype(np.float32) * 255, (5, 5), 1.0)
            m = np.minimum(m, im[..., 3].astype(np.float32))
            out = np.zeros((N, N, 4), np.uint8)
            out[..., :3] = 255
            out[..., 3] = m.astype(np.uint8)
            Image.fromarray(out).save(ART / f'pet-{e}-corps.webp', lossless=True, quality=100, method=6)
    S = Image.new('RGB', (8 * 240, 240))
    for i, T in enumerate(tuiles):
        S.paste(T, (i * 240, 0))
    S.save('/tmp/t/banc/animaux-anat.png')
    if ecrire:
        (RACINE / 'src/lib/animaux.ts').write_text('''// Généré par scripts/banc/animaux.py : les repères de chaque compagnon (public/art/pet-<espèce>.webp), en fractions
// de son image carrée — le milieu de ses yeux (ex, ey) et leur écart (d), le haut de son crâne sans les oreilles
// (crane), la largeur de sa tête à hauteur du front (tw), le milieu de son corps sous la tête (xc) et sa largeur (cw),
// où commencent ses pattes arrière (pieds), et s'il a des ailes où tombent les manches d'un pull (manches).
// Tout ce qu'il porte se pose d'après eux (lib/habitsAnimaux.ts, components/pet.tsx).

export type Animal = { ex: number; ey: number; d: number; crane: number; tw: number; xc: number; cw: number; pieds: number; manches: boolean }

export const ANIMAUX: Record<string, Animal> = {
''' + '\n'.join(lignes) + '\n}\n', encoding='utf-8')
        print('écrit : src/lib/animaux.ts et', len(ESPECES), 'masques de corps')
