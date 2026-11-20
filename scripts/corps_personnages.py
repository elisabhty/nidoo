#!/usr/bin/env python3
"""Repères du corps de chaque figurine, pour poser les vêtements de la boutique.

Pour chaque figurine de base (public/art/persos/<id>.webp, toile 300x440), on mesure sur le détourage :
  - les pieds : centre et largeur du pied gauche et du pied droit, et le bas des semelles ;
  - le buste : la largeur du corps (bras compris) à hauteur de poitrine, son centre,
    et la hauteur des hanches (là où le corps se resserre sous les mains).
Le cou vient des repères de tête (m[0] + m[1] dans src/lib/persos.ts).

Écrit src/lib/corps.ts. Usage : python3 scripts/corps_personnages.py
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H = 300, 440


def runs(row):
    """Segments [debut, fin] des colonnes opaques d'une ligne."""
    out, start = [], None
    for i, v in enumerate(row):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(row) - 1))
    return out


def bas_des_mains(pid, a, neck, yb):
    """Le bas des deux mains d'après le masque (rouge = peau) : la peau de chaque côté, entre le cou et les pieds."""
    from scipy import ndimage
    mk = np.array(Image.open(ROOT / f'public/art/persos/{pid}-m.webp').convert('RGB').resize((W, H), Image.NEAREST))
    peau = (mk[:, :, 0] > 160) & a
    cols = np.where(a[neck:yb].any(0))[0]
    cx = (cols.min() + cols.max()) / 2
    y0, y1 = neck + int((yb - neck) * 0.22), yb - int((yb - neck) * 0.22)
    bas = []
    for side in (-1, 1):
        zone = np.zeros_like(peau)
        cote = (np.arange(W) - cx) * side > 0.09 * W
        zone[y0:y1] = peau[y0:y1] & cote[None, :]
        lab, n = ndimage.label(zone)
        if not n:
            return None
        tailles = ndimage.sum(zone, lab, range(1, n + 1))
        if tailles.max() < 40:
            return None
        ys = np.where(lab == int(np.argmax(tailles)) + 1)[0]
        bas.append(ys.max())
    return int(max(bas))


def measure(pid, t, h):
    a = np.array(Image.open(ROOT / f'public/art/persos/{pid}.webp').convert('RGBA'))[:, :, 3] > 128
    rows = np.where(a.any(1))[0]
    yb = rows.max()
    # Pieds : dans la bande du bas, les deux plus grands segments.
    band = a[yb - 14:yb - 2].any(0)
    segs = sorted(runs(band), key=lambda s: s[1] - s[0], reverse=True)[:2]
    if len(segs) < 2:  # pieds collés : on coupe le segment en deux
        s0, s1 = segs[0]
        mid = (s0 + s1) // 2
        segs = [(s0, mid), (mid + 1, s1)]
    segs.sort()
    (l0, l1), (r0, r1) = segs
    # Le bas des mains : là où le corps se resserre d'un coup (on passe des bras aux jambes).
    neck = int((t + h) * H)
    widths = {}
    for y in range(neck, yb):
        xs = np.where(a[y])[0]
        widths[y] = (xs.min(), xs.max()) if len(xs) else (0, 0)
    w = lambda y: widths[y][1] - widths[y][0]
    legs = next(y for y in range(neck + int((yb - neck) * 0.35), yb - 20)
                if w(y + 6) < 0.78 * max(w(y - 6), 1))
    # Sous une longue tunique ou une robe, le corps ne se resserre qu'à l'ourlet, bien plus bas que les mains :
    # on se fie alors aux mains elles-mêmes (la peau, en rouge sur le masque, de chaque côté du corps).
    mains = bas_des_mains(pid, a, neck, yb)
    if mains is not None and legs > mains + 0.07 * H:
        legs = mains + 2
    # Le buste : sa largeur bras compris juste au-dessus des mains (sous les cheveux longs).
    span = [widths[y] for y in range(legs - 30, legs - 12)]
    x0 = int(np.median([s[0] for s in span]))
    x1 = int(np.median([s[1] for s in span]))
    hips = legs + 6
    return dict(
        pl=round((l0 + l1) / 2 / W, 4), wl=round((l1 - l0 + 1) / W, 4),
        pr=round((r0 + r1) / 2 / W, 4), wr=round((r1 - r0 + 1) / W, 4),
        yb=round((yb + 1) / H, 4),
        bx=round((x0 + x1) / 2 / W, 4), bw=round((x1 - x0 + 1) / W, 4),
        hy=round(hips / H, 4),
    )


def main():
    src = (ROOT / 'src/lib/persos.ts').read_text()
    items = re.findall(r"id: '([a-z0-9]+)'.*?m: \[([0-9., -]+)\]", src)
    lines = []
    for pid, m in items:
        t, h = [float(v) for v in m.split(',')[:2]]
        d = measure(pid, t, h)
        lines.append(f"  {pid}: [{d['pl']}, {d['wl']}, {d['pr']}, {d['wr']}, {d['yb']}, {d['bx']}, {d['bw']}, {d['hy']}],")
    out = ROOT / 'src/lib/corps.ts'
    out.write_text(
        '// Repères du corps de chaque figurine (fractions de la toile 300x440), calculés par\n'
        '// scripts/corps_personnages.py : pied gauche (centre, largeur), pied droit (centre, largeur),\n'
        '// bas des semelles, puis le buste (centre, largeur bras compris) et la hauteur des hanches.\n'
        '// Ils servent à poser les manteaux et les chaussures de la boutique.\n\n'
        'export type Corps = [number, number, number, number, number, number, number, number]\n\n'
        'export const CORPS: Record<string, Corps> = {\n' + '\n'.join(lines) + '\n}\n'
    )
    print(f'{len(lines)} figurines -> {out.relative_to(ROOT)}', file=sys.stderr)


if __name__ == '__main__':
    main()
