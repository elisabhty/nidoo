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
