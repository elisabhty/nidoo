"""Recale chaque figurine « autre peau » (gen/tons/cut/t1..t5/<id>.webp) sur la figurine d'origine,
puis mesure : la peau obtenue (Lab), ce qui a changé ailleurs (habits, cheveux), et l'homogénéité de la peau.
Écrit gen/tons/reg/t<k>/<id>.webp (recalées) et gen/tons/eval.json.
usage: tons_eval.py [ids]"""
import sys, json, re, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
from skimage import color

ROOT = '/home/claude/gen/tons'
PUB = '/home/claude/nidoo/public/art/persos'
src = open('/home/claude/nidoo/src/lib/persos.ts').read()
ids = re.findall(r"id: '(\w+)'", src)
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
M = {}
for pid, m in re.findall(r"id: '(\w+)'.*?m: \[([^\]]+)\]", src):
    M[pid] = [float(x) for x in m.split(',')]


def lab(rgb):
    return color.rgb2lab(rgb.astype(np.float32) / 255.0)


def load(p):
    return np.array(Image.open(p).convert('RGBA'))


def register(base, var):
    """Recale var sur base (affine), d'après la silhouette puis les contours des habits et cheveux."""
    a0 = cv2.GaussianBlur(base[..., 3].astype(np.float32) / 255, (0, 0), 2)
    a1 = cv2.GaussianBlur(var[..., 3].astype(np.float32) / 255, (0, 0), 2)
    warp = np.eye(2, 3, dtype=np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    try:
        _, warp = cv2.findTransformECC(a0, a1, warp, cv2.MOTION_AFFINE, crit, None, 5)
    except cv2.error:
        pass
    H, W = base.shape[:2]
    out = cv2.warpAffine(var, warp, (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(0, 0, 0, 0))
    return out, warp


res = json.load(open(f'{ROOT}/eval.json')) if os.path.exists(f'{ROOT}/eval.json') and only else {}
for pid in ids:
    if only and pid not in only:
        continue
    base = load(f'{PUB}/{pid}.webp')
    mk = np.array(Image.open(f'{PUB}/{pid}-m.webp').convert('RGB'))
    H, W = base.shape[:2]
    A0 = base[..., 3] > 200
    skin = (mk[..., 0] > 128) & A0
    hair = (mk[..., 1] > 128) & A0
    feat = mk[..., 2] > 0  # iris, bouche, sourcils
    t, hh = M[pid][0] * H, M[pid][1] * H
    yy = np.arange(H)[:, None] * np.ones((1, W))
    face = skin & (yy < t + hh * 1.05)
    body = skin & (yy >= t + hh * 1.15)
    L0 = lab(base[..., :3])
    other = A0 & ~ndimage.binary_dilation(skin | feat, iterations=3)
    other = ndimage.binary_erosion(other, iterations=2)
    hair_in = ndimage.binary_erosion(hair, iterations=2)
    res[pid] = {'base': {'face': [round(float(x), 1) for x in np.median(L0[face], axis=0)] if face.any() else None}}
    for k in range(1, 7):
        p = f'{ROOT}/cut/t{k}/{pid}.webp'
        if not os.path.exists(p):
            continue
        var = load(p)
        reg, warp = register(base, var)
        os.makedirs(f'{ROOT}/reg/t{k}', exist_ok=True)
        Image.fromarray(reg).save(f'{ROOT}/reg/t{k}/{pid}.webp', lossless=True)
        A1 = reg[..., 3] > 200
        iou = float((A0 & A1).sum() / max(1, (A0 | A1).sum()))
        L1 = lab(cv2.GaussianBlur(reg[..., :3], (0, 0), 1.2))
        L0b = lab(cv2.GaussianBlur(base[..., :3], (0, 0), 1.2))
        dE = np.linalg.norm(L1 - L0b, axis=2)
        o = other & A1
        d_other = float(np.median(dE[o])) if o.any() else 99
        d_other90 = float(np.percentile(dE[o], 90)) if o.any() else 99
        big = o & (cv2.GaussianBlur(dE.astype(np.float32), (0, 0), 1.5) > 16)
        big = ndimage.binary_opening(big, iterations=1)
        chg = int(big.sum())
        chg_head = int((big & (yy < t + hh * 1.4)).sum())
        hm = hair_in & A1
        d_hair = float(np.median(dE[hm])) if hm.sum() > 30 else None
        fs = face & A1
        fl = np.median(L1[fs], axis=0) if fs.sum() > 30 else None
        bs = body & A1
        bl = np.median(L1[bs], axis=0) if bs.sum() > 30 else None
        # homogénéité : part de la peau du visage proche de la couleur médiane
        unif = float((np.linalg.norm(L1[fs] - fl, axis=1) < 12).mean()) if fl is not None else None
        res[pid][f't{k}'] = {
            'iou': round(iou, 3), 'other': round(d_other, 1), 'other90': round(d_other90, 1), 'chg': chg, 'chgh': chg_head,
            'hair': None if d_hair is None else round(d_hair, 1),
            'face': None if fl is None else [round(float(x), 1) for x in fl],
            'body': None if bl is None else [round(float(x), 1) for x in bl],
            'unif': None if unif is None else round(unif, 2),
            'warp': [round(float(x), 3) for x in warp.flatten()],
        }
    print(pid, {k: (v.get('face') or [0])[0] if isinstance(v, dict) else v for k, v in res[pid].items()})
json.dump(res, open(f'{ROOT}/eval.json', 'w'), indent=1)
