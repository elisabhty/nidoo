"""Analyse le visage de chaque figurine : yeux, bouche, nez, masques (peau, cheveux/voile, iris, bouche),
et un morceau de visage « sans nez ni bouche » pour poser d'autres nez et bouches.
usage: visage.py dossier_persos meta2.json catalogue.json sortie_dir debug_dir [ids]"""
import sys, json, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
from skimage import color

D, META, CAT, OUT, DBG = sys.argv[1:6]
only = sys.argv[6].split(',') if len(sys.argv) > 6 else None
M = json.load(open(META)); CATA = json.load(open(CAT))
res = {}

def lab(rgb):
    return color.rgb2lab(rgb.astype(np.float32) / 255.0)

for pid, info in CATA.items():
    if only and pid not in only: continue
    im = np.array(Image.open(f'{D}/{pid}.webp').convert('RGBA'))
    H, W = im.shape[:2]
    rgb = im[..., :3]; A = im[..., 3] > 100
    L = lab(rgb)
    m = M[pid]
    t, hh, cx, cw = m['t'] * H, m['h'] * H, m['x'] * W, m['c'] * W
    # ── les yeux : deux taches très sombres, rondes, à la même hauteur, dans le visage
    y0, y1 = int(t + hh * 0.38), int(t + hh * 0.9)
    x0, x1 = int(cx - cw * 0.55), int(cx + cw * 0.55)
    best = None
    for thr in (24, 18, 14, 11):
        dark = (L[..., 0] < thr) & A
        dark = ndimage.binary_fill_holes(dark)
        lab_, n = ndimage.label(dark)
        cands = []
        for i in range(1, n + 1):
            ys, xs = np.where(lab_ == i)
            if len(ys) < 60: continue
            my, mx = ys.mean(), xs.mean()
            if not (y0 <= my <= y1 and x0 <= mx <= x1): continue
            hgt, wid = np.ptp(ys) + 1, np.ptp(xs) + 1
            fill = len(ys) / (hgt * wid)
            if fill < 0.5 or not (0.6 < hgt / wid < 1.6): continue
            if wid > cw * 0.3: continue
            cands.append((len(ys), mx, my, (hgt + wid) / 4, i))
        for a_ in cands:
            for b_ in cands:
                if a_[1] >= b_[1]: continue
                dy = abs(a_[2] - b_[2]); dx = b_[1] - a_[1]
                if dy > max(a_[3], b_[3]) * 0.8 or not (cw * 0.22 < dx < cw * 0.75): continue
                if min(a_[0], b_[0]) < max(a_[0], b_[0]) * 0.62: continue
                sym = abs((a_[1] + b_[1]) / 2 - cx)
                score = -dy * 2 - sym + (a_[0] + b_[0]) * 0.01
                if best is None or score > best[0]: best = (score, a_, b_)
        if best: break
    if not best:
        print(pid, 'PAS D YEUX'); continue
    _, el, er = best
    ex, ey = (el[1] + er[1]) / 2, (el[2] + er[2]) / 2
    d = er[1] - el[1]; er_ = (el[3] + er[3]) / 2
    # ── la peau : sous les yeux, à côté du nez, au menton (les lunettes peuvent cacher l'arête du nez)
    W8 = np.array([0.5, 1.2, 1.4])
    dist = lambda c: np.sqrt((((L - c) * W8) ** 2).sum(axis=2))
    # la couleur de peau : la teinte la plus présente sur le haut du visage (hors yeux, lunettes et barbe)
    band = (ey - d * 0.15, ey + d * 0.22) if info.get('b') else (ey + d * 0.08, ey + d * 0.48)
    gy, gx = np.mgrid[int(band[0]): int(band[1]): 1, int(ex - d * 0.8): int(ex + d * 0.8): 2]
    ok = np.ones(gy.shape, bool)
    for e in (el, er):
        ok &= (gx - e[1]) ** 2 + (gy - e[2]) ** 2 > (e[3] * 1.5) ** 2
    ok &= A[gy.clip(0, H - 1), gx.clip(0, W - 1)]
    S = L[gy[ok], gx[ok]].reshape(-1, 3).astype(np.float32) * np.float32([0.5, 1.2, 1.4])
    _, lab_k, cen = cv2.kmeans(S, 3, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 4, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(lab_k.ravel(), minlength=3)
    skin = cen[int(np.argmax(counts))] / np.float32([0.5, 1.2, 1.4])
    if os.environ.get("DBGV"): print(pid, "peau", skin.round(1), "comptes", counts, "centres", (cen / np.float32([0.5, 1.2, 1.4])).round(1).tolist())
    dE = dist(skin)
    figH = np.where(A.any(axis=1))[0].max() - t
    # les vêtements : quelques échantillons sur le torse et les jambes
    clo = []
    for fy, fx in ((0.52, 0), (0.48, -0.12), (0.48, 0.12), (0.62, 0), (0.75, -0.08), (0.75, 0.08), (0.9, -0.08)):
        y, x = int(t + figH * fy), int(cx + cw * fx * 2)
        if A[y, x]: clo.append(np.median(L[y - 3: y + 4, x - 3: x + 4].reshape(-1, 3), axis=0))
    clo = [c for c in clo if np.sqrt((((c - skin) * W8) ** 2).sum()) > 6]
    dC = np.min([dist(c) for c in clo], axis=0) if clo else np.full_like(dE, 999.0)
    # les cheveux (ou le voile) : la teinte dominante en haut de la tête, hors du visage
    yy, xx = np.mgrid[0:H, 0:W]
    core = ((xx - ex) / (d * 0.95)) ** 2 + ((yy - (ey + d * 0.25)) / (d * 0.95)) ** 2 <= 1
    hz = A & ~core & (yy < ey + d * 0.2) & (yy >= t) & (dE > 10)
    for e in (el, er):
        hz &= (xx - e[1]) ** 2 + (yy - e[2]) ** 2 > (e[3] * 2.4) ** 2
    bald = info['c'] == 'chauve' or hz.sum() < 300
    hair = None
    if not bald:
        S2 = L[hz].astype(np.float32) * np.float32([0.5, 1.2, 1.4])
        _, lk, cen2 = cv2.kmeans(S2, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 4, cv2.KMEANS_PP_CENTERS)
        ys_hz = yy[hz]
        top = ys_hz < t + hh * 0.3
        cnt = [((lk.ravel() == k) & top).sum() for k in range(2)]
        hair = cen2[int(np.argmax(cnt))] / np.float32([0.5, 1.2, 1.4])
        if np.sqrt((((hair - skin) * W8) ** 2).sum()) < 7: bald = True
    hseed = [(int(t + hh * 0.06), int(cx)), (int(t + hh * 0.12), int(cx - cw * 0.25)), (int(t + hh * 0.12), int(cx + cw * 0.25))]
    dHs = dist(hair) if not bald else np.full_like(dE, 999.0)
    near = A & (dE < dHs) & (dE < dC)
    # le visage : dans une ellipse autour des yeux (tout le crâne s'il est chauve), jusqu'au cou
    top_face = t if bald else ey - d * 0.75
    cyf, ryf = (top_face + ey + d * 1.25) / 2, (ey + d * 1.25 - top_face) / 2
    ell = ((xx - ex) / (d * 1.12)) ** 2 + ((yy - cyf) / ryf) ** 2 <= 1
    face = ell & near & (dE < 20)
    fl, fn = ndimage.label(face)
    fseed = fl[int(ey + d * 0.4), int(ex)]
    face = (fl == fseed) if fseed else face
    face = ndimage.binary_closing(face, iterations=2) & ell & A & (dE < 24)
    # mains, pieds nus, jambes : des taches bien de la couleur de la peau, sous la tête
    low = A & near & (dE < 11) & (yy > ey + d * 1.3)
    ll, ln = ndimage.label(low)
    body = np.zeros_like(A)
    for i in range(1, ln + 1):
        comp = ll == i
        sz = comp.sum()
        cyb = np.where(comp)[0].mean()
        fy = (cyb - t) / figH
        if 25 < sz < W * H * 0.01 and ((0.42 < fy < 0.72) or (info['a'] >= 2 and fy >= 0.72)):
            body |= comp
    body = ndimage.binary_closing(body, iterations=1) & A & (dE < 15)
    # les oreilles : de la peau juste à côté du visage
    ell2 = ((xx - ex) / (d * 1.5)) ** 2 + ((yy - cyf) / ryf) ** 2 <= 1
    ears = ell2 & near & (dE < 11) & (yy > ey - d * 0.4)
    skinmask = face | body | ears
    core2 = (((xx - ex) / (d * 0.92)) ** 2 + ((yy - (ey + d * 0.3)) / (d * 0.85)) ** 2 <= 1) & (yy > ey - er_ * 1.3)
    eyes_t = np.zeros_like(A)
    for e in (el, er):
        eyes_t |= (xx - e[1]) ** 2 + (yy - e[2]) ** 2 <= (e[3] * 1.15) ** 2
    hairish = (dHs < dE) & (dE > 14)
    skinmask |= core2 & A & (dE < 30) & ~eyes_t & ~hairish & ((yy < ey + d * 0.8) | (dE < 16))
    cov_core = (((xx - ex) / (d * 0.8)) ** 2 + ((yy - (ey + d * 0.3)) / (d * 0.7)) ** 2 <= 1) & ~eyes_t & A
    COV = round(float((skinmask & cov_core).sum() / max(1, cov_core.sum())), 2)
    # ── la bouche : plus sombre ou plus rouge que la peau, sous les yeux, au milieu
    by0, by1 = int(ey + d * 0.3), int(ey + d * (0.85 if info.get('b') else 0.72))
    bx0, bx1 = int(ex - d * 0.34), int(ex + d * 0.34)
    reg = np.zeros_like(A); reg[by0:by1, bx0:bx1] = True
    mouthc = reg & A & (dE > 14) & (L[..., 0] < skin[0] - 6)
    ml, mn = ndimage.label(mouthc)
    mouth = np.zeros_like(A)
    if mn:
        sizes = ndimage.sum(mouthc, ml, range(1, mn + 1))
        # la plus grosse tache proche du centre
        bestm, bs = 0, -1e9
        for i in range(1, mn + 1):
            ys, xs = np.where(ml == i)
            sc = min(sizes[i - 1], 60) - abs(xs.mean() - ex) * 2 - abs(ys.mean() - (ey + d * 0.55)) * 2
            if sc > bs: bs, bestm = sc, i
        mouth = ml == bestm
        mouth = ndimage.binary_dilation(mouth, iterations=1) & (dE > 9)
    if mouth.any():
        ys, xs = np.where(mouth); mxc, myc, mw = xs.mean(), ys.mean(), np.ptp(xs) + 1
    else:
        mxc, myc, mw = ex, ey + d * 0.55, d * 0.3
    # ── le nez : entre les yeux et la bouche
    nyc = ey + (myc - ey) * 0.48
    # ── le morceau de visage sans nez ni bouche (inpainting)
    erase = np.zeros((H, W), np.uint8)
    erase[mouth] = 255
    cv2.ellipse(erase, (int(ex), int(nyc)), (int(d * 0.16), int(d * 0.13)), 0, 0, 360, 255, -1)
    erase = cv2.dilate(erase, np.ones((3, 3), np.uint8), iterations=2)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    clean = cv2.inpaint(bgr, erase, 5, cv2.INPAINT_TELEA)
    clean = cv2.cvtColor(clean, cv2.COLOR_BGR2RGB)
    ys, xs = np.where(erase > 0)
    px0, py0, px1, py1 = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
    patch = np.dstack([clean[py0:py1, px0:px1], (ndimage.gaussian_filter((erase[py0:py1, px0:px1] > 0).astype(float), 1.2) * 255).clip(0, 255).astype(np.uint8)])
    Image.fromarray(patch).save(f'{OUT}/{pid}-v.webp', lossless=True)
    # la peau sous le nez et la bouche fait partie du masque de peau
    skinmask = skinmask | (erase > 0)
    # ── les cheveux (ou le voile) : depuis le haut de la tête
    hairmask = np.zeros_like(A)
    if not bald and pid not in ('gf6',):
        dH = dHs
        chin = ey + d * 1.05
        eyes = np.zeros_like(A)
        for e in (el, er):
            eyes |= (xx - e[1]) ** 2 + (yy - e[2]) ** 2 <= (e[3] * 2.4) ** 2
        # au-dessus du menton : tout ce qui n'est ni la peau, ni les yeux (et lunettes), ni la bouche
        upper = (yy < chin) & A & ~skinmask & ~eyes & (dE > 9) & (dH < 32)
        upper &= ~((xx - ex) ** 2 / (d * 0.5) ** 2 + (yy - (ey + d * 0.6)) ** 2 / (d * 0.35) ** 2 <= 1)
        # plus bas : les cheveux longs, s'ils ressemblent plus aux cheveux qu'aux vêtements
        lower = (yy >= chin) & (yy < t + hh * 2.0) & A & ~skinmask & (dH < 24) & (dH < dC)
        hc = upper | lower
        hl, hn = ndimage.label(hc)
        sizes = ndimage.sum(hc, hl, range(1, hn + 1))
        ks = {i + 1 for i, sz in enumerate(sizes) if sz > 150 and (hl == i + 1)[: int(ey)].any()}
        hairmask = np.isin(hl, list(ks))
        hairmask = ndimage.binary_closing(hairmask, iterations=1) & A & ~skinmask
        # au-dessus du menton, tout pixel de la tête va à la peau ou aux cheveux : la couleur la plus proche,
        # avec une préférence pour la peau au centre du visage et pour les cheveux autour
        r = np.sqrt(((xx - ex) / (d * 1.0)) ** 2 + ((yy - (ey + d * 0.25)) / (d * 0.95)) ** 2)
        cs = dE + 14 * np.maximum(0, r - 0.92)
        ch = dH + 14 * np.maximum(0, 0.92 - r)
        mouthzone = ((xx - ex) / (d * 0.45)) ** 2 + ((yy - (ey + d * 0.58)) / (d * 0.3)) ** 2 <= 1
        head = A & (yy < chin) & (yy >= t) & ~eyes_t & ~mouthzone & (np.minimum(dE, dH) < 42)
        hairmask = np.where(head, ch < cs, hairmask) & A
        skinmask = np.where(head, cs <= ch, skinmask) & A
        # loin du visage, ce n'est de la peau que si c'est vraiment sa couleur (les oreilles)
        far = head & (r > 1.2) & (dE > 8)
        hairmask |= far
        skinmask &= ~far
        lab_map = np.where(skinmask, 1, np.where(hairmask, 2, 0)).astype(np.uint8)
        zone = (yy < chin) & A & ~eyes_t
        sm = ndimage.generic_filter(lab_map, lambda v: np.bincount(v.astype(int), minlength=3)[1:].argmax() + 1 if (v > 0).sum() > 12 else v[len(v) // 2], size=5)
        hairmask = np.where(zone, sm == 2, hairmask) & A
        skinmask = np.where(zone, sm == 1, skinmask) & A
    # ── les iris : l'intérieur sombre des yeux, sans le reflet
    iris = np.zeros_like(A)
    for e in (el, er):
        comp = (lab_ == e[4]) & ((xx - e[1]) ** 2 + (yy - e[2]) ** 2 <= (e[3] * 1.25) ** 2)
        iris |= comp & (L[..., 0] < 45)
    # ── le masque : R peau, G cheveux, B 255 iris / 170 bouche
    mk = np.zeros((H, W, 3), np.uint8)
    soft = ndimage.gaussian_filter(skinmask.astype(float), 0.7)
    mk[..., 0] = (soft * 255).clip(0, 255)
    mk[..., 1] = (ndimage.gaussian_filter(hairmask.astype(float), 0.7) * 255).clip(0, 255)
    mk[..., 2][mouth] = 170
    mk[..., 2][iris] = 255
    Image.fromarray(mk).save(f'{OUT}/{pid}-m.webp', lossless=True)
    def stats(mask):
        v = L[mask]
        return [round(float(x), 1) for x in v.mean(axis=0)] + [round(float(v[:, 0].std()), 1)] if len(v) else None
    res[pid] = {
        'e': [round(el[1] / W, 4), round(el[2] / H, 4), round(er[1] / W, 4), round(er[2] / H, 4), round(er_ / W, 4)],
        'mo': [round(mxc / W, 4), round(myc / H, 4), round(mw / W, 4)],
        'no': [round(ex / W, 4), round(nyc / H, 4)],
        'p': [int(px0), int(py0)],
        'cov': COV, 'sk': stats(skinmask & (erase == 0)), 'ha': stats(hairmask) if hairmask.any() else None, 'ir': stats(iris),
    }
    # aperçu de contrôle
    dbg = rgb.copy()
    dbg[skinmask] = (dbg[skinmask] * 0.5 + np.array([255, 0, 0]) * 0.5).astype(np.uint8)
    dbg[hairmask] = (dbg[hairmask] * 0.5 + np.array([0, 200, 0]) * 0.5).astype(np.uint8)
    dbg[mouth] = [255, 255, 0]; dbg[iris] = [0, 120, 255]
    cv2.circle(dbg, (int(ex), int(nyc)), 3, (255, 0, 255), -1)
    Image.fromarray(dbg).save(f'{DBG}/{pid}.png')
json.dump(res, open(f'{OUT}/../visages.json' if False else os.path.join(os.path.dirname(OUT.rstrip('/')), 'visages-' + ('part' if only else 'all') + '.json'), 'w'), separators=(',', ':'))
print('ok', len(res))
