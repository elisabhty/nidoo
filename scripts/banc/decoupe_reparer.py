"""Les défauts de détourage des figurines. Là où un habit blanc touchait le fond blanc d'origine, le détourage a mangé
un bout de l'habit : la manche droite de h14, la jambe droite (collant blanc) de fi6, et les baskets blanches de
beaucoup de figurines dans leurs autres couleurs de peau.
- h14 : sa manche droite reprend la forme de la gauche, en miroir ;
- fi6 : sa jambe reprend la forme qu'elle a dans sa peau la plus foncée (où le détourage est net), en blanc ;
- les autres peaux : leurs habits sont ceux de la figurine de départ (ils ne changent pas d'une peau à l'autre :
  2 à 3 % d'écart, le bruit de la compression) — on les lui reprend, avec leur bord net.
  python3 scripts/banc/decoupe_reparer.py            # montre ce qui changerait (planche /tmp/t/banc/decoupe.png)
  python3 scripts/banc/decoupe_reparer.py --ecrire   # corrige les images"""
import sys, math
import numpy as np
import cv2
from scipy import ndimage
from PIL import Image, ImageDraw
from commun import *
import anatomie as an

yy, xx = np.mgrid[0:H, 0:W]

def gros(m, mini=12):
    lab_, n = ndimage.label(m)
    if not n:
        return m
    t = ndimage.sum(m, lab_, range(1, n + 1))
    return np.isin(lab_, [k + 1 for k, v in enumerate(t) if v >= mini])

def manche_en_miroir(pid, im, bande=16):
    """Le bord extérieur de la manche droite (mangé) repris sur celui de la manche gauche, en miroir."""
    z = an.anatomie(pid)
    mn = MAINS[pid]
    c = (mn[0] + mn[2]) / 2 * W
    out = im.copy()
    sil = im[..., 3] > 128
    change = np.zeros((H, W), bool)
    for y in range(int(menton(pid) * H + 8), int(max(mn[1], mn[3]) * H + 4)):
        xs = np.where(sil[y])[0]
        if len(xs) < 10:
            continue
        xg = xs[0]                          # le bord gauche de la silhouette (net)
        xd = int(round(2 * c - xg))         # où devrait être le bord droit
        for x in range(xd - bande, min(W, xd + 3)):
            q = int(round(2 * c - x))
            if not (0 <= q < W):
                continue
            ici_ok = (im[y, x, 3] < 40) or z['haut'][y, x] or not (z['peau'][y, x] or z['cheveux'][y, x])
            la_ok = z['haut'][y, q] or im[y, q, 3] < 200
            if ici_ok and la_ok and not z['peau'][y, x] and not z['peau'][y, q]:
                out[y, x] = im[y, q]
                change[y, x] = True
    return out, change

def jambe_d_apres(pid, im, ref):
    """Ce que le détourage a mangé d'une jambe : on reprend la forme de `ref` (une autre peau, nette), dans la couleur
    de l'image elle-même, prolongée depuis l'intérieur de la jambe."""
    hy, yb = CORPS[pid][7] * H, CORPS[pid][4] * H
    m = gros(ndimage.binary_opening((im[..., 3] < 100) & (ref[..., 3] > 200) & (yy > hy) & (yy < yb), structure=np.ones((3, 3))), 30)
    if not m.any():
        return im, m
    trou = ndimage.binary_dilation(m, iterations=2) & (im[..., 3] < 250) & (ref[..., 3] > 30)
    rgb = cv2.inpaint(np.ascontiguousarray(im[..., :3]), trou.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    out = im.copy()
    out[..., :3][trou] = rgb[trou]
    out[..., 3][trou] = np.maximum(im[..., 3][trou], ref[..., 3][trou])
    return out, trou

ZONES = ['haut', 'bas', 'chaussures']

def regions(pid):
    """Pour chaque habit : là où il peut s'étendre (sa zone et 8 pixels autour, loin de la peau et des cheveux)."""
    z = an.anatomie(pid)
    chair = z['peau'] | z['cheveux'] | z['sourcils'] | z['iris'] | z['bouche'] | z['autre']
    loin = ~ndimage.binary_dilation(chair, iterations=2)
    res = {}
    for n in ZONES:
        zone = z[n] | (z['jambes'] if n == 'bas' else False)
        autres = np.zeros((H, W), bool)
        for m in ZONES + ['jambes']:
            if m != n and not (n == 'bas' and m == 'jambes'):
                autres |= z[m]
        res[n] = (zone, ndimage.binary_dilation(zone, iterations=8) & loin & ~chair & ~autres)
    return res

def rugosite(im, zone, region):
    """Combien le contour extérieur de l'habit est hérissé : l'écart de son profil (gauche et droit, ligne par ligne)
    à ce même profil lissé."""
    m = (im[..., 3] > 128) & (zone | region)
    sil = im[..., 3] > 128
    ys = np.where(zone.any(1))[0]
    if len(ys) < 12:
        return 0.0
    tot = 0.0
    for cote in (0, 1):
        prof = []
        for y in range(ys.min(), ys.max() + 1):
            xs = np.where(sil[y])[0]
            if not len(xs):
                continue
            x = xs[0] if cote == 0 else xs[-1]
            if m[y, x]:               # le bord de la silhouette est bien cet habit, sur cette ligne
                prof.append(float(x))
            else:
                prof.append(np.nan)
        prof = np.array(prof)
        ok = ~np.isnan(prof)
        if ok.sum() < 12:
            continue
        v = prof[ok]
        lisse = ndimage.median_filter(v, size=11, mode='nearest')
        tot += float(np.abs(v - lisse).sum())
    return tot

def poser(donneur, im, zone, region):
    """L'habit du donneur (sa zone, et ce qu'il a de plus dans la région) repris dans `im`, bord compris."""
    plus = (donneur[..., 3] > 128) & region
    lab_, n = ndimage.label(plus | zone)
    tient = np.isin(lab_, [i for i in np.unique(lab_[zone & region]) if i])
    coeur = tient & region
    autour = ndimage.binary_dilation(coeur, iterations=2) & region
    m = coeur | autour
    w = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7)
    w = np.where(ndimage.binary_erosion(m, iterations=1), 1.0, w)[..., None]
    a0, a1 = donneur[..., 3:4].astype(np.float32) / 255, im[..., 3:4].astype(np.float32) / 255
    p = donneur[..., :3].astype(np.float32) * a0 * w + im[..., :3].astype(np.float32) * a1 * (1 - w)
    a = a0 * w + a1 * (1 - w)
    out = np.concatenate([np.where(a > 1e-4, p / np.maximum(a, 1e-4), im[..., :3]), a * 255], -1)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)

def reparer(pid):
    """Les images réparées de la figurine : {t: (avant, après, pixels changés)} pour celles qui changent vraiment.
    - fi6 : sa jambe droite (collant blanc sur fond blanc) reprend la forme qu'elle a dans sa peau la plus foncée ;
    - les chaussures blanches mangées dans une autre peau sont reprises sur la figurine de départ (les mêmes chaussures)."""
    ts = [0] + PEAUX.get(pid, [])
    ims = {t: image(pid, t) for t in ts}
    neufs = dict(ims)
    if pid == 'fi6':
        for t in (0, 1):
            neufs[t], _ = jambe_d_apres(pid, ims[t], ims[4])
    donneurs = {}
    if len(ts) > 1:
        zone, region = regions(pid)['chaussures']
        if zone.sum() >= 200:
            for t in ts[1:]:
                # un vrai morceau qui manque (pas le pixel de jeu du tour de la chaussure)
                manque = gros(ndimage.binary_opening((ims[0][..., 3] > 128) & (ims[t][..., 3] < 100) & (zone | region), structure=np.ones((3, 3))), 20)
                if manque.sum() >= 40:
                    neufs[t] = poser(ims[0], neufs[t], zone, region)
                    donneurs[t] = int(manque.sum())
    res = {}
    for t in ts:
        da = np.abs(neufs[t][..., 3].astype(int) - ims[t][..., 3].astype(int))
        if (da > 100).sum() >= 12:
            res[t] = (ims[t], neufs[t], int((da > 100).sum()))
    return res, donneurs

if __name__ == '__main__':
    ecrire = '--ecrire' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or IDS
    tuiles, total, bilan = [], 0, []
    for pid in ids:
        res, donneurs = reparer(pid)
        if donneurs:
            print(pid, 'chaussures reprises (pixels qui manquaient) :', donneurs)
        for t, (avant, apres, n) in res.items():
            total += 1
            bilan.append((n, pid, t))
            if ecrire:
                Image.fromarray(apres).save(ART / f"{pid}{f'-t{t}' if t else ''}.webp", quality=92, method=6, exact=True)
            if '--voir' in sys.argv and len(tuiles) < 28 and t == max(res, key=lambda u: res[u][2]):
                def vue(im):
                    a = im[..., 3:4] / 255
                    return (im[..., :3] * a + np.array([60, 60, 70]) * (1 - a)).astype(np.uint8)[int(CORPS[pid][7] * H) + 30:]
                T = Image.fromarray(np.concatenate([vue(avant), vue(apres)], 1))
                T.thumbnail((440, 220))
                cv_ = Image.new('RGB', (440, 234), (255, 255, 255))
                cv_.paste(T, (0, 14))
                ImageDraw.Draw(cv_).text((3, 1), f'{pid} t{t} : {n} px', fill=(0, 0, 0))
                tuiles.append(cv_)
    bilan.sort(reverse=True)
    print(total, 'images changent ; les plus touchées :', bilan[:16])
    if tuiles:
        cols = 4
        S = Image.new('RGB', (cols * 440, math.ceil(len(tuiles) / cols) * 234), (255, 255, 255))
        for i, T in enumerate(tuiles):
            S.paste(T, ((i % cols) * 440, (i // cols) * 234))
        S.save('/tmp/t/banc/decoupe.png')
        print(S.size)
