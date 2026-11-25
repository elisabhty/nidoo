"""L'anatomie d'une figurine : où sont sa peau, ses cheveux, son haut, son bas, ses jambes et ses chaussures.
Tout le reste (teindre les cheveux, enfiler un habit de la boutique, poser un chapeau) s'appuie là-dessus : tant que
ces zones étaient devinées à la couleur, pixel par pixel, dans le navigateur, un pull bleu marine sous des cheveux
noirs ou une oreille de la couleur d'une barbe suffisaient à tout fausser.

- la peau : lue dans les autres couleurs de peau de la figurine (peau_variantes.py) ;
- les cheveux et les habits : découpés par Segment Anything (sam.py), à qui l'on montre des points sûrs.

  python3 scripts/banc/anatomie.py [ids…]     # calcule (cache dans /tmp/t/anat) et dessine les planches de contrôle
"""
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage
from commun import *
import peau_variantes as pv
import sam

CACHE = Path('/tmp/t/anat')
yy, xx = np.mgrid[0:H, 0:W]
VERT = np.array([60, 200, 90], np.float32)

def reperes(pid):
    v, c = VISAGES[pid], CORPS[pid]
    pl, wl, pr, wr, yb, bx, bw, hy = c
    return dict(
        ex=(v['e'][0] + v['e'][2]) / 2 * W, ey=(v['e'][1] + v['e'][3]) / 2 * H, d=(v['e'][2] - v['e'][0]) * W,
        ch=menton(pid) * H, pl=pl * W, wl=wl * W, pr=pr * W, wr=wr * W, yb=yb * H, bx=bx * W, bw=bw * W, hy=hy * H,
    )

def grands(m, mini):
    """Garde les morceaux d'au moins `mini` pixels."""
    lab_, n = ndimage.label(m)
    if not n:
        return m
    t = ndimage.sum(m, lab_, range(1, n + 1))
    return np.isin(lab_, [i + 1 for i, s in enumerate(t) if s >= mini])

def bouche_trous(m, maxi, sauf=None):
    """Remplit les trous de moins de `maxi` pixels (sauf ceux qui touchent `sauf`)."""
    trous = ndimage.binary_fill_holes(m) & ~m
    lab_, n = ndimage.label(trous)
    if not n:
        return m
    t = ndimage.sum(trous, lab_, range(1, n + 1))
    ok = [i + 1 for i, s in enumerate(t) if s < maxi]
    if sauf is not None:
        touche = set(np.unique(lab_[sauf & trous]))
        ok = [i for i in ok if i not in touche]
    return m | np.isin(lab_, ok)

# ───────── la peau ─────────

def peau_couleur(pid):
    """Sans autre couleur de peau à comparer (fa6, ga4) : la peau à sa couleur, en partant de l'ancien masque.
    Leur peau foncée ne ressemble ni à leurs habits ni à leurs cheveux noirs : la couleur suffit."""
    im = image(pid)
    op = im[..., 3] > 128
    L = lab(im)
    anc = masque(pid)[..., 0] > 128
    coeur = ndimage.binary_erosion(anc & op, iterations=3)
    ech = L[coeur]
    # trois tons de peau (ombre, moyen, lumière) et l'écart toléré autour
    q = np.percentile(ech[:, 0], [15, 50, 85])
    tons = [ech[np.abs(ech[:, 0] - x) < 5].mean(0) for x in q]
    d = np.min([np.sqrt((((L - t) * np.array([0.45, 1, 1])) ** 2).sum(-1)) for t in tons], axis=0)
    a = im[..., 3:4] / 255.0
    guide = ((im[..., :3] * a + VERT * (1 - a)) / 255).astype(np.float32)
    g = cv2.ximgproc.guidedFilter(guide, np.clip(1.5 - d / 9, 0, 1).astype(np.float32), 3, 0.01)
    s = (g > 0.5) & op
    # seulement ce qui tient à la peau connue (pas un habit de la même couleur ailleurs)
    lab_, n = ndimage.label(s)
    s = np.isin(lab_, [i for i in np.unique(lab_[coeur & s]) if i])
    return s, g

def peau(pid):
    """La peau (booléen), et la carte dont elle vient (0 à 1)."""
    im = image(pid)
    op = im[..., 3] > 128
    m = pv.part_de_peau(pid)
    if m is None:
        s, g = peau_couleur(pid)
    else:
        a = im[..., 3:4] / 255.0
        guide = ((im[..., :3] * a + VERT * (1 - a)) / 255).astype(np.float32)
        g = cv2.ximgproc.guidedFilter(guide, np.clip(m, -0.3, 1.3).astype(np.float32), 3, 0.01)
        s = (g > 0.5) & op
    s = grands(s, 25)
    # les petits trous (le rose des joues, une narine, le coin de la bouche) sont de la peau ; pas ceux des yeux
    # et des sourcils, plus haut
    v = VISAGES[pid]
    ey, d = (v['e'][1] + v['e'][3]) / 2 * H, (v['e'][2] - v['e'][0]) * W
    feat = masque(pid)[..., 2] > 40
    s = bouche_trous(s, 150, sauf=ndimage.binary_dilation(feat, iterations=1) | ((yy < ey + 0.3 * d) & (yy > ey - 1.3 * d)))
    return s, g

# ───────── Segment Anything, avec des points choisis dans des zones sûres ─────────

def points(zone, n, ecart=6, deja=()):
    """Jusqu'à `n` points bien à l'intérieur de `zone`, loin les uns des autres."""
    if not zone.any():
        return []
    dt = ndimage.distance_transform_edt(zone)
    pts = []
    loin = np.full(zone.shape, 1e9)
    for (x, y) in deja:
        loin = np.minimum(loin, np.hypot(xx - x, yy - y))
    for _ in range(n):
        score = np.minimum(dt * 3, loin) if (pts or len(deja)) else dt
        score = np.where(dt >= min(2, dt.max()), score, -1)
        k = int(np.argmax(score))
        y, x = divmod(k, W)
        if score[y, x] < (ecart if (pts or len(deja)) else 1):
            break
        pts.append((x, y))
        loin = np.minimum(loin, np.hypot(xx - x, yy - y))
    return pts

def vote(vue, essais, journal=None):
    """Plusieurs jeux de points pour la même partie : on garde ce que la moyenne des réponses retient.
    Peu de points à chaque fois — trop de « ceci n'en est pas » et Segment Anything coupe la partie en deux."""
    cartes = []
    for oui, non in essais:
        if not oui:
            continue
        m, s, bas, carte = vue.masque(oui, non)
        cartes.append(np.clip(carte, -8, 8))
        if journal is not None:
            journal.append((oui, non, s))
    if not cartes:
        return np.zeros((H, W), bool), np.full((H, W), -8.0)
    moy = np.mean(cartes, 0)
    return moy > 0, moy

# ───────── les habits ─────────

def disque(x, y, r):
    return np.hypot(xx - x, yy - y) <= r

def ourlet(m, x, y0, large=3, trou=3):
    """Le bas d'un masque dans la colonne `x`, en descendant depuis `y0` sans sauter plus de `trou` pixels vides."""
    col = m[:, max(0, int(x) - large):int(x) + large + 1].any(1)
    y, vide, fin = int(y0), 0, int(y0)
    while y < H and vide <= trou:
        if col[y]:
            fin, vide = y, 0
        else:
            vide += 1
        y += 1
    return fin

SALOPETTES = {'fi2', 'fa2'}  # la bavette monte sur la poitrine : au-dessus des hanches, elle va avec le haut

def habits(pid, S=None, journal=None):
    """Le bas, les chaussures et le cœur du haut de la figurine (le haut complet se déduit ensuite : tout ce qui,
    sur le corps, n'est ni peau, ni cheveux, ni bas, ni chaussures). `genre` : 'deux' (un haut et un bas),
    'une' (grenouillère, combinaison : même tissu de haut en bas) ou 'robe' (rien d'autre sous le haut que les jambes)."""
    r = reperes(pid)
    im = image(pid)
    op = im[..., 3] > 128
    L = lab(im)
    if S is None:
        S, _ = peau(pid)
    _, vc = sam.vues(pid)
    Sl = ndimage.binary_dilation(S, iterations=1)
    libre = op & ~Sl
    ch, hy, yb, bx, bw = r['ch'], r['hy'], r['yb'], r['bx'], r['bw']
    ok = lambda x, y: 0 <= int(y) < H and 0 <= int(x) < W and bool(libre[int(y), int(x)])
    couleur = lambda x, y: np.median(L[max(0, int(y) - 2):int(y) + 3, max(0, int(x) - 2):int(x) + 3].reshape(-1, 3), axis=0)
    ecart = lambda a, b: float(np.sqrt((((a - b) * np.array([0.6, 1, 1])) ** 2).sum()))
    # les chaussures : une par pied
    chaussures = np.zeros((H, W), bool)
    for cx in (r['pl'], r['pr']):
        m, s, bas, _ = vc.masque([(cx, yb - 6)], [(cx, yb - 0.15 * H)])
        m &= op & (yy > yb - 0.2 * H) & ~S
        # un seul pied à la fois (sinon c'est autre chose : les deux jambes, tout le bas)
        if m.any() and np.ptp(np.where(m.any(0))[0]) < 0.34 * W:
            chaussures |= m
    ys = np.where(chaussures.any(1))[0]
    haut_ch = ys.min() if len(ys) else yb - 0.06 * H
    # le cœur du haut : le milieu du buste (et les bras s'ils ne sont pas nus)
    ym = ch + (hy - ch) * 0.45
    milieu = [(bx, ym)]
    trois = [q for q in [(bx, ym), (bx - 0.18 * bw, ym), (bx + 0.18 * bw, ym)] if ok(*q)]
    bras = [q for q in [(bx - 0.36 * bw, ym + 4), (bx + 0.36 * bw, ym + 4)] if ok(*q)]
    cb = couleur(bx, ym)
    bas = np.zeros((H, W), bool)
    trouve, meme = [], 0
    # le bas : on descend le long de chaque jambe depuis les hanches, jusqu'à trouver autre chose que le haut.
    # « Le même habit que le buste » (tunique, robe) : le masque parti de la jambe remonte jusqu'au buste, et le
    # tissu a la même couleur. (Segment Anything prend parfois toute la tenue d'un coup : la couleur tranche alors,
    # et on redemande en lui montrant que le buste n'en est pas.) Les bébés sont tous en grenouillère.
    bebe = PERSOS[pid]['g'] == 'bebe'
    for cx in (r['pl'], r['pr']):
        y = hy + 0.04 * H
        while y < haut_ch - 6 and not bebe:
            q = (cx, y)
            y += 0.035 * H
            if not ok(*q) or chaussures[int(q[1]), int(q[0])]:
                continue
            m, s, _, _ = vc.masque([q], [])
            m &= op
            if m[int(ym), int(bx)]:
                if ecart(couleur(*q), cb) < 13:
                    meme += 1
                    continue
                m, s, _, _ = vc.masque([q], milieu)
                m &= op
                if m[int(ym), int(bx)]:
                    continue
            if journal is not None:
                journal.append(([q], [], s))
            bas |= m
            trouve.append(q)
            break
    if len(trouve) == 2:
        bas |= vote(vc, [(trouve, milieu)], journal)[0]
    bas &= op & ~S & ~chaussures
    if trouve:
        bas = grands(bas & (yy > ch + 0.3 * (hy - ch)), 60)
    # le cœur du haut, vu par Segment Anything
    chevilles = [(cx, haut_ch - 9) for cx in (r['pl'], r['pr']) if ok(cx, haut_ch - 9)]
    non = [q for q in trouve] or chevilles
    coeur, _ = vote(vc, [(milieu, non), (trois, non), (milieu + bras, non)], journal)
    coeur &= op & ~S & ~chaussures
    if trouve:
        genre = 'deux'
        coeur &= ~bas
    else:
        # rien d'autre sous le haut : d'une seule pièce jusqu'aux chevilles (grenouillère), ou une robe
        zone = op & ~S & ~chaussures & (yy > hy + 0.5 * (yb - hy)) & (yy < haut_ch - 2) & (np.abs(xx - bx) < 0.4 * bw)
        genre = 'une' if zone.sum() > 300 else 'robe'
        coeur, _ = vote(vc, [(milieu, []), (trois, [])], journal)
        coeur &= op & ~S & ~chaussures
    return dict(coeur=coeur, bas=bas, chaussures=chaussures, genre=genre, haut_ch=float(haut_ch))

# ───────── les cheveux ─────────

LIMITE_BARBE = {'gm2': 0.05}  # jusqu'où descend la barbe sous le menton (fraction de la toile) : dessous, c'est le col blanc
GRAINES_CHEVEUX = {}  # des points en plus, là où l'ancien masque n'avait rien (une barbe oubliée…)

def cheveux(pid, S, hab=None, journal=None):
    """Les cheveux (la barbe, le voile) : Segment Anything part de ce que l'ancien masque donnait pour sûr."""
    im = image(pid)
    op = im[..., 3] > 40
    L = lab(im)
    mk = masque(pid)
    ancien, feat = mk[..., 1] > 128, mk[..., 2] > 40
    r = reperes(pid)
    vt, _ = sam.vues(pid)
    visage = [(r['ex'], r['ey'] + 0.3 * r['d'])]
    buste = [(r['bx'], r['ch'] + (r['hy'] - r['ch']) * 0.45)]
    res = np.zeros((H, W), bool)
    v, p = VISAGES[pid], PERSOS[pid]
    graines = list(GRAINES_CHEVEUX.get(pid, []))
    for q in graines:
        res |= vote(vt, [([q], visage), ([q], visage + buste)], journal)[0]
    if p['b']:
        # la barbe, que l'ancien masque n'avait pas toujours : sous la bouche et sur les joues, sous le nez seulement
        for q in [(r['ex'], v['mo'][1] * H + 0.3 * r['d']), (r['ex'] - 0.7 * r['d'], v['mo'][1] * H), (r['ex'] + 0.7 * r['d'], v['mo'][1] * H)]:
            if S[int(q[1]), int(q[0])]:
                continue
            m = vote(vt, [([q], [(r['ex'], r['ey'] - 0.2 * r['d'])]), ([q], [(r['ex'], r['ey'] - 0.2 * r['d'])] + buste)], journal)[0]
            res |= m & (yy > v['no'][1] * H)
    if ancien.sum() >= 40:
        Sl = ndimage.binary_dilation(S, iterations=1)
        sur = ancien & (im[..., 3] > 200) & ~Sl & ~feat
        if hab is not None:
            sur &= ~hab['bas'] & ~hab['chaussures']
        coeur = ndimage.binary_erosion(sur, iterations=2)
        lab_, n = ndimage.label(coeur)
        if n:
            t = ndimage.sum(coeur, lab_, range(1, n + 1))
            for i in np.argsort(-t):
                if t[i] < 30:
                    break
                c = lab_ == i + 1
                if (c & res).sum() > 0.7 * t[i]:
                    continue
                p3, p5 = points(c, 3), points(c, 6)
                res |= vote(vt, [(p3, visage), (p5, visage), (p5, visage + buste)], journal)[0]
    res &= op & ~S & ~feat
    if hab is not None:
        res &= ~hab['bas'] & ~hab['chaussures']
    # sous le menton, ce qui n'a pas la couleur des cheveux d'en haut n'en est pas (un col pris avec la barbe)
    haut_ = res & (yy < r['ch'] - 4) & (im[..., 3] > 200)
    bas_ = res & (yy >= r['ch'] - 4)
    if haut_.sum() > 150 and bas_.any():
        cc = L[ndimage.binary_erosion(haut_, iterations=1)]
        if len(cc) > 50:
            q = np.percentile(cc[:, 0], [8, 30, 50, 70, 92])
            tons = [cc[np.abs(cc[:, 0] - t) < 5].mean(0) for t in q]
            d = np.min([np.sqrt((((L - t) * np.array([0.5, 1, 1])) ** 2).sum(-1)) for t in tons], axis=0)
            faux = ndimage.binary_opening(bas_ & (d > 20), iterations=1)
            faux = grands(faux, 25)
            res &= ~ndimage.binary_dilation(faux, iterations=2, mask=bas_)
    # juste sous le menton, au milieu : sans barbe ni voile, ce ne sont pas des cheveux (un collier de perles)
    if not p['b'] and p['c'] != 'voile':
        res &= ~((np.abs(xx - r['ex']) < 0.5 * r['d']) & (yy > v['mo'][1] * H + 0.2 * r['d']) & (yy < r['ch'] + 0.3 * r['d']))
    if pid in LIMITE_BARBE:
        res &= ~((np.abs(xx - r['ex']) < 1.3 * r['d']) & (yy > r['ch'] + LIMITE_BARBE[pid] * H))
    # sous le menton, les cheveux tiennent à ceux de la tête
    if res.any():
        fin = ndimage.binary_opening(res, iterations=1)
        lab_, n = ndimage.label(fin)
        tete = set(np.unique(lab_[fin & (yy < r['ch'] - 2)])) - {0}
        garde = np.isin(lab_, list(tete))
        res &= ndimage.binary_dilation(garde, iterations=2, mask=res) | (yy < r['ch'] - 2)
    return res

# ───────── les sourcils ─────────

def sourcils(pid, S, C):
    """Les deux sourcils (ou aucun) : au-dessus de chaque œil, une petite barre qui tranche sur la peau autour.
    S'ils ne sont pas tous les deux trouvés proprement, on n'en garde aucun : mieux vaut des sourcils qui
    gardent leur couleur qu'un seul sourcil qui suit celle des cheveux."""
    v = VISAGES[pid]
    im = image(pid)
    op = im[..., 3] > 128
    L = lab(im)
    x1, y1, x2, y2, rr = v['e']
    d, rayon = (x2 - x1) * W, rr * W
    ex, ey = (x1 + x2) / 2 * W, (y1 + y2) / 2 * H
    visage = (np.abs(xx - ex) < 1.5 * d) & (yy > ey - 1.25 * d) & (yy < ey + 0.2 * d)
    # la peau autour : la couleur médiane de la peau sûre, dans une fenêtre
    sure = ndimage.binary_erosion(S, iterations=1)
    Lf = L.copy()
    poids = sure.astype(np.float32)
    k = (int(0.5 * d) | 1, int(0.5 * d) | 1)
    loc = np.stack([cv2.blur(Lf[..., c] * poids, k) / np.maximum(cv2.blur(poids, k), 1e-3) for c in range(3)], -1)
    dL = L[..., 0] - loc[..., 0]
    dC = np.hypot(L[..., 1] - loc[..., 1], L[..., 2] - loc[..., 2])
    tranche = ((dL < -5.5) | (dC > 9) | (np.abs(dL) > 9)) & (cv2.blur(poids, k) > 0.25)
    yeux = (np.hypot(xx - x1 * W, yy - y1 * H) < rayon * 1.16) | (np.hypot(xx - x2 * W, yy - y2 * H) < rayon * 1.16)
    # pas l'ombre que les cheveux font sur le front (une bande de quelques pixels le long de la chevelure) : un
    # sourcil qui la touche en serait prolongé tout autour du front. Le bout du sourcil coupé là est rendu ensuite.
    large = op & visage & ~C & ~yeux & tranche
    cand = large & ~ndimage.binary_dilation(C, iterations=5)
    cand = ndimage.binary_opening(cand, structure=np.ones((2, 2)))
    lab_, n = ndimage.label(cand, structure=np.ones((3, 3)))
    trouves = []
    for cx, cy in ((x1 * W, y1 * H), (x2 * W, y2 * H)):
        meilleur, score = None, 0
        for i in range(1, n + 1):
            c = lab_ == i
            ys, xs = np.where(c)
            larg, haut_ = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
            aire = int(c.sum())
            # au-dessus de cet œil, tout entier (une monture de lunettes, une mèche débordent de la zone)
            if not (abs(xs.mean() - cx) < 0.5 * d and ys.max() < cy - 0.55 * rayon and ys.min() > cy - rayon - 0.75 * d and xs.min() > cx - 0.7 * d and xs.max() < cx + 0.7 * d):
                continue
            # une barre : plus large que haute, pleine
            if aire < 12 or larg < 0.2 * d or larg < 1.4 * haut_ or haut_ > 0.42 * d or aire < 0.3 * larg * haut_:
                continue
            # posée sur la peau (pas une mèche qui descend sur le front)
            tour = ndimage.binary_dilation(c, iterations=2) & ~c
            if (tour & S).sum() < 0.6 * tour.sum():
                continue
            if aire > score:
                meilleur, score = c, aire
        if meilleur is not None:
            ys, xs = np.where(meilleur)
            couloir = large & (yy >= ys.min() - 1) & (yy <= ys.max() + 1) & (np.abs(xx - cx) < 0.75 * d)
            meilleur = ndimage.binary_dilation(meilleur, iterations=6, mask=couloir | meilleur)
        trouves.append(meilleur)
    if any(t is None for t in trouves):
        return np.zeros((H, W), bool), [t is not None for t in trouves]
    # derrière des lunettes, la monture se mêle trop souvent au sourcil : on n'y touche pas
    if PERSOS[pid]['l']:
        return np.zeros((H, W), bool), [False, False]
    # deux sourcils se ressemblent (taille, hauteur au-dessus de l'œil) : sinon l'un des deux est autre chose
    def mesure(c, cy):
        ys, xs = np.where(c)
        return c.sum(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1, cy - ys.mean()
    m0, m1 = mesure(trouves[0], y1 * H), mesure(trouves[1], y2 * H)
    proche = lambda a, b, f: min(a, b) >= f * max(a, b)
    if not (proche(m0[0], m1[0], 0.5) and proche(m0[1], m1[1], 0.6) and proche(m0[2], m1[2], 0.5) and abs(m0[3] - m1[3]) < 0.12 * d):
        return np.zeros((H, W), bool), [False, False]
    return trouves[0] | trouves[1], [True, True]

# ───────── l'ensemble ─────────

PARTIES = ['peau', 'cheveux', 'sourcils', 'iris', 'bouche', 'haut', 'bas', 'jambes', 'chaussures', 'autre']

def anatomie(pid, refaire=False):
    """Toutes les zones de la figurine (booléens, une seule zone par pixel), plus `genre` et `sourcils_ok`."""
    f = CACHE / f'{pid}.npz'
    if f.exists() and not refaire:
        z = np.load(f)
        return {k: (z[k] if z[k].ndim else z[k].item()) for k in z.files}
    im = image(pid)
    op = im[..., 3] > 40
    L = lab(im)
    v = VISAGES[pid]
    r = reperes(pid)
    mk = masque(pid)
    S, _ = peau(pid)
    hab = habits(pid, S)
    C = cheveux(pid, S, hab)
    iris, bouche = mk[..., 2] > 230, (mk[..., 2] > 130) & (mk[..., 2] < 210)
    S &= ~iris & ~bouche
    C &= ~S
    B, ok = sourcils(pid, S, C)
    C &= ~B
    coeur, bas, chaussures = hab['coeur'], hab['bas'], hab['chaussures']
    ch, hy, yb = r['ch'], r['hy'], r['yb']
    x1, y1, x2, y2, rr = v['e']
    yeux = (np.hypot(xx - x1 * W, yy - y1 * H) < rr * W * 1.3) | (np.hypot(xx - x2 * W, yy - y2 * H) < rr * W * 1.3)
    # ce que les cheveux et le cœur du haut réclament tous deux : des cheveux longs passent devant le haut ; un col,
    # une capuche de leur couleur ne sont pas des cheveux — on tranche à la couleur, puis à l'ancien masque
    litige = C & coeur
    if litige.sum() > 20:
        sur_c = ndimage.binary_erosion(C & ~coeur, iterations=2)
        sur_h = ndimage.binary_erosion(coeur & ~C, iterations=2)
        if sur_c.sum() > 50 and sur_h.sum() > 50:
            mc, mh = np.median(L[sur_c], axis=0), np.median(L[sur_h], axis=0)
            dc = np.sqrt((((L - mc) * np.array([0.6, 1, 1])) ** 2).sum(-1))
            dh = np.sqrt((((L - mh) * np.array([0.6, 1, 1])) ** 2).sum(-1))
            au_haut = litige & (dh + 6 < dc)
            if np.hypot(*(mc - mh)[1:]) < 8 and abs(mc[0] - mh[0]) < 10:
                au_haut = litige & ~(mk[..., 1] > 128)  # même couleur : l'ancien masque pour juge
            C &= ~au_haut
    # les mèches fines que Segment Anything laisse de côté : contre les cheveux, de leur couleur plutôt que de celle
    # de la peau, hors des yeux — autour de la tête seulement (pas un collier de perles sous des cheveux gris)
    pris = S | C | B | iris | bouche | bas | chaussures
    if C.sum() > 200 and S.sum() > 200:
        cc = L[ndimage.binary_erosion(C, iterations=1) & (im[..., 3] > 200)]
        q = np.percentile(cc[:, 0], [15, 50, 85])
        tons = [cc[np.abs(cc[:, 0] - t) < 6].mean(0) for t in q]
        ms = np.median(L[ndimage.binary_erosion(S, iterations=1)], axis=0)
        dc = np.min([np.sqrt((((L - t) * np.array([0.7, 1, 1])) ** 2).sum(-1)) for t in tons], axis=0)
        ds = np.sqrt((((L - ms) * np.array([0.7, 1, 1])) ** 2).sum(-1))
        cand = op & ~pris & ~coeur & ~yeux & (dc + 4 < ds) & (dc < 22) & (yy < ch - 2)
        meche = ndimage.binary_dilation(C, iterations=5, mask=cand | C) & cand
        C |= meche
        pris |= meche
        # le bord des cheveux (deux pixels, souvent à demi transparents contre le fond) reste aux cheveux, partout
        bord = op & ~pris & ~coeur & ~yeux & ((im[..., 3] < 230) | (dc < 18))
        bord = ndimage.binary_dilation(C, iterations=2, mask=bord | C) & bord
        C |= bord
        pris |= bord
    # ménage : les miettes de cheveux (un point de couture sombre sur un sweat, le tour d'un sourcil) n'en sont pas —
    # sous le menton, ils tiennent à ceux de la tête ; partout, un morceau isolé de moins de 40 pixels s'en va
    if C.any():
        fin = ndimage.binary_opening(C, iterations=1)
        lab_, n = ndimage.label(fin)
        tete = set(np.unique(lab_[fin & (yy < ch - 2)])) - {0}
        garde = np.isin(lab_, list(tete))
        C &= ndimage.binary_dilation(garde, iterations=2, mask=C) | (yy < ch - 2)
        lab_, n = ndimage.label(C, structure=np.ones((3, 3)))
        if n > 1:
            t = ndimage.sum(C, lab_, range(1, n + 1))
            for i, a in enumerate(t):
                if a >= 40:
                    continue
                c = lab_ == i + 1
                if B.any() and (ndimage.binary_dilation(c, iterations=2) & B).any():
                    B |= c          # le tour d'un sourcil va avec le sourcil
                C &= ~c
    pris = S | C | B | iris | bouche | bas | chaussures
    # le haut : tout ce qui, sur le corps, n'est ni peau, ni cheveux, ni bas, ni chaussures (la chemise sous le gilet,
    # un col, des boutons, les rayures d'une marinière en font partie) et tient au cœur du haut
    corps = op & ~pris & ~yeux & ((yy > ch - 2) | coeur)
    genre = hab['genre']
    if genre == 'deux':
        ys = np.where(bas.any(1))[0]
        bord = ndimage.binary_dilation(bas, iterations=3)
        # sous le haut du bas, ce qui reste entre ses bords (ceinture, revers) va avec lui ; les jambes couvertes à part
        dessous = corps & ~coeur & (yy > ys.min() + 0.45 * (ys.max() - ys.min()))
        haut = corps & ~dessous
    else:
        haut = corps
    lab_, n = ndimage.label(haut)
    if n:
        t = ndimage.sum(haut, lab_, range(1, n + 1))
        tient = set(np.unique(lab_[coeur & haut])) - {0}
        haut = np.isin(lab_, [i + 1 for i, a in enumerate(t) if (i + 1) in tient and a >= 60])
    if genre != 'deux':
        # d'une seule pièce : partagée aux hanches (le haut au-dessus, le bas dessous)
        bas = haut & (yy >= hy)
        haut = haut & (yy < hy)
    elif pid in SALOPETTES:
        haut |= bas & (yy < hy - 0.02 * H)
        bas &= ~haut
    # les jambes couvertes (collants, chaussettes, pantalon sous une jupe) : sous le bas, ce qui n'est rien d'autre
    reste = op & ~pris & ~haut & ~bas & ~yeux
    jambes = np.zeros((H, W), bool)
    if bas.any():
        ys, xs = np.where(bas | chaussures)
        yb0 = np.where(bas.any(1))[0]
        zone = (yy > yb0.min() + 0.4 * (yb0.max() - yb0.min())) & (xx >= xs.min() - 2) & (xx <= xs.max() + 2)
        jambes = grands(ndimage.binary_opening(reste & zone, iterations=1), 50)
    # le fin liseré entre deux zones, le bord adouci de la silhouette : à la zone la plus proche (2 pixels au plus)
    zones = dict(peau=S, cheveux=C, sourcils=B, iris=iris, bouche=bouche, haut=haut, bas=bas, jambes=jambes, chaussures=chaussures)
    noms = ['cheveux', 'haut', 'bas', 'jambes', 'chaussures']
    pris = S | C | B | iris | bouche | haut | bas | jambes | chaussures
    reste = op & ~pris & ~yeux
    if reste.any():
        dist = np.stack([ndimage.distance_transform_edt(~zones[n]) if zones[n].any() else np.full((H, W), 1e9) for n in noms])
        plus = dist.argmin(0)
        pres = dist.min(0) <= 2.2
        for i, n in enumerate(noms):
            zones[n] = zones[n] | (reste & pres & (plus == i))
    pris = np.zeros((H, W), bool)
    for n in ['iris', 'bouche', 'sourcils', 'peau', 'cheveux', 'chaussures', 'haut', 'bas', 'jambes']:
        zones[n] = zones[n] & ~pris
        pris |= zones[n]
    zones['autre'] = op & ~pris
    zones['genre'] = genre
    zones['sourcils_ok'] = bool(all(ok))
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(f, **zones)
    return zones

COULEURS = {'peau': (255, 60, 60), 'cheveux': (150, 0, 255), 'haut': (255, 160, 0), 'bas': (0, 110, 255), 'jambes': (0, 200, 130), 'chaussures': (255, 235, 0), 'sourcils': (0, 255, 255), 'autre': (255, 0, 255)}

def apercu(pid, parties, fond=(237, 233, 246), force=0.6):
    im = image(pid)
    a = im[..., 3:4] / 255
    o = (im[..., :3] * a + np.array(fond) * (1 - a)).astype(np.float32)
    for nom, m in parties.items():
        if nom in COULEURS and m is not None and m is not True and m is not False:
            o[m] = o[m] * (1 - force) + np.array(COULEURS[nom], np.float32) * force
    return o.astype(np.uint8)
