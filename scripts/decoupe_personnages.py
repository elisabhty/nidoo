"""Découpe une planche de personnages (2 lignes x 3 colonnes) : chaque personnage détouré, en pied
(toile 300x440, posé en bas) et en buste (256x256), avec les repères de la tête pour les accessoires.
usage: perso_slice.py planche dossier json nom1,...,nom6 [tete=0.42]"""
import sys, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, out, js, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',')
headk = float(sys.argv[5]) if len(sys.argv) > 5 else 0.42
im = Image.open(src).convert('RGB')
W, H = im.size
rgb = np.array(im).astype(int)
mn, mx = rgb.min(axis=2), rgb.max(axis=2)
cand = (mn >= 238) & (mx - mn < 14)
lab, _ = ndimage.label(cand)
edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); edge.discard(0)
bg = np.isin(lab, list(edge))
fig = ~bg
# les trous : on remplit les petits reflets, on garde les vrais vides (entre le bras et le corps)
holes = ndimage.binary_fill_holes(fig) & ~fig
hl, hn = ndimage.label(holes)
for i in range(1, hn + 1):
    m = hl == i
    if m.sum() < 60 or mn[m].mean() < 246:
        fig |= m
# poussières
fl, fn = ndimage.label(fig)
sizes = ndimage.sum(fig, fl, range(1, fn + 1))
fig = np.isin(fl, [i + 1 for i, s in enumerate(sizes) if s >= W * H * 0.0004])

def bands(profile, want):
    nz = np.where(profile > 0)[0]
    lo, hi = nz.min(), nz.max() + 1
    sm = np.convolve(profile, np.ones(5) / 5, mode='same')
    cuts = [lo]
    for k in range(1, want):
        e = lo + (hi - lo) * k / want
        w = (hi - lo) / want * 0.3
        a0, a1 = int(max(lo, e - w)), int(min(hi, e + w))
        cuts.append(a0 + int(np.argmin(sm[a0:a1])))
    cuts.append(hi)
    return [(cuts[i], cuts[i + 1]) for i in range(want)]

alpha_full = Image.fromarray((ndimage.binary_erosion(fig, iterations=1) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.9))
rgba = im.convert('RGBA'); rgba.putalpha(alpha_full)
meta = json.load(open(js)) if js != '-' and __import__('os').path.exists(js) else {}
idx = 0
CW, CH, PAD = 300, 440, 6
for r0, r1 in bands(fig.sum(axis=1), 2):
    band = fig[r0:r1]
    for c0, c1 in bands(band.sum(axis=0), 3):
        name = names[idx]; idx += 1
        cell = fig[r0:r1, c0:c1]
        ys, xs = np.where(cell)
        x0, y0, x1, y1 = c0 + xs.min(), r0 + ys.min(), c0 + xs.max() + 1, r0 + ys.max() + 1
        if name == '-':
            continue
        crop = rgba.crop((x0, y0, x1, y1))
        # on efface ce qui dépasse d'une case voisine
        cm = np.zeros((y1 - y0, x1 - x0), bool)
        cm[:, :] = fig[y0:y1, x0:x1]
        cl, cn = ndimage.label(cm)
        if cn > 1:
            sz = ndimage.sum(cm, cl, range(1, cn + 1)); big = sz.max()
            keep = np.isin(cl, [i + 1 for i, s in enumerate(sz) if s >= big * 0.004])
            a = np.array(crop); a[..., 3] = np.where(keep, a[..., 3], 0); crop = Image.fromarray(a)
        fw, fh = crop.size
        k = min((CH - PAD) / fh, (CW - 4) / fw)
        crop2 = crop.resize((max(1, round(fw * k)), max(1, round(fh * k))), Image.LANCZOS)
        canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        ox, oy = (CW - crop2.width) // 2, CH - PAD // 2 - crop2.height
        canvas.alpha_composite(crop2, (ox, oy))
        canvas.save(f'{out}/{name}.webp', quality=88, method=6)
        # la tête : en haut, environ headk de la hauteur
        m = np.array(canvas)[..., 3] > 80
        ys, xs = np.where(m)
        top, bot = ys.min(), ys.max()
        fhh = bot - top
        hh = fhh * headk
        upper = m[top: top + int(hh * 0.75)]
        uy, ux = np.where(upper)
        cx = ux.mean()
        rows_w = [(np.where(r)[0].max() - np.where(r)[0].min()) if r.any() else 0 for r in m[top: top + int(hh)]]
        hw = max(rows_w)
        side = max(hh * 1.32, hw * 1.06)
        meta[name] = {'top': round(top / CH, 4), 'hh': round(hh / CH, 4), 'cx': round(cx / CW, 4), 'hw': round(hw / CW, 4),
                      'bx': round((cx - side / 2) / CW, 4), 'by': round((top - side * 0.05) / CH, 4), 'bs': round(side / CW, 4)}
json.dump(meta, open(js, 'w'), indent=0) if js != '-' else None
print(src.split('/')[-1], '->', idx, 'cases')
