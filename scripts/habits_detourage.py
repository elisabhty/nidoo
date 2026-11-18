"""Détoure les nouveaux habits de la boutique (fourrure, robe, jupe, short, blazer, trench, et les hauts : col roulé, chemise, marinière, pull torsadé, sweat, gilet) à partir des
images générées sur fond blanc (planche ElevenLabs « Nidoo – habits en feutrine », puis un habit par image).

- le fond blanc relié au bord devient transparent, avec un bord adouci ;
- pour les vestes, on évide l'encolure (la doublure du dos, entre les revers) : portée, on y voit le haut
  et le cou du personnage ;
- l'image est recadrée au plus juste et enregistrée dans public/art/persos/acc-<nom>.webp ;
- l'icône de la boutique (l'habit entier) va dans public/art/mode-<nom>.webp.
Usage : python3 scripts/habits_detourage.py <dossier des jpg> [dossier de sortie] [noms…]
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SORTIE = Path(__file__).resolve().parent.parent / 'public/art/persos'
# l'encolure à évider (coordonnées dans l'image 512 x 512 d'origine)
ENCOLURE = {
    'fourrure': [(208, 90), (302, 90), (288, 150), (258, 218), (238, 170), (214, 128)],
    'blazer': [(214, 60), (300, 60), (298, 108), (271, 205), (262, 222), (241, 160), (218, 108)],
    'trench': [(214, 48), (300, 48), (305, 94), (266, 168), (255, 182), (244, 168), (205, 94)],
}
# les hauts : l'encolure (le dos du col) en ellipse (centre x, centre y, demi-largeur, demi-hauteur)
ENCOLURE_ROND = {
    'colroule': (256, 90, 52, 16),
    'chemise': (256, 100, 34, 26),
    'mariniere': (256, 106, 68, 13),
    'torsade': (256, 100, 50, 15),
    'sweat': (250, 100, 58, 15),
    'gilet': (250, 100, 54, 15),
}
HAUTS = list(ENCOLURE_ROND)


def detoure(nom: str, im: Image.Image, encolure: bool = True) -> Image.Image:
    a = np.asarray(im.convert('RGB')).astype(int)
    H, W = a.shape[:2]
    mn, mx = a.min(-1), a.max(-1)
    # la fourrure est crème : on n'enlève que le blanc presque pur
    # (les hauts sortent d'un détourage sur fond blanc pur : on ne retire que le blanc parfait, les rayures
    # blanches de la chemise touchent le bord)
    seuil = 251 if nom in ENCOLURE_ROND else 246 if nom == 'fourrure' else 236
    blanc = (mn > seuil) & (mx - mn < 14)
    fond = np.zeros((H, W), bool)
    q = deque((y, x) for y in range(H) for x in (0, W - 1) if blanc[y, x])
    q.extend((y, x) for x in range(W) for y in (0, H - 1) if blanc[y, x])
    for y, x in q:
        fond[y, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and blanc[yy, xx] and not fond[yy, xx]:
                fond[yy, xx] = True
                q.append((yy, xx))
    al = Image.fromarray(np.where(fond, 0, 255).astype(np.uint8))
    if encolure and nom in ENCOLURE:
        ImageDraw.Draw(al).polygon(ENCOLURE[nom], fill=0)
    if encolure and nom in ENCOLURE_ROND:
        cx, cy, rx, ry = ENCOLURE_ROND[nom]
        ImageDraw.Draw(al).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=0)
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    out = im.convert('RGBA')
    out.putalpha(al)
    return out.crop(al.point(lambda v: 255 if v > 12 else 0).getbbox())


if __name__ == '__main__':
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else SORTIE
    noms = sys.argv[3:] or ['fourrure', 'robe', 'jupe', 'short', 'blazer', 'trench'] + HAUTS
    for nom in noms:
        im = detoure(nom, Image.open(src / f'{nom}.jpg'))
        im.save(dst / f'acc-{nom}.webp', quality=90, method=6)
        print(nom, im.size, round(im.size[1] / im.size[0], 3))
        # l'icône de la boutique (public/art/mode-<nom>.webp) : l'habit entier, centré sur 320 x 320
        ic = detoure(nom, Image.open(src / f'{nom}.jpg'), encolure=False)
        ic.thumbnail((292, 292), Image.LANCZOS)
        toile = Image.new('RGBA', (320, 320), (0, 0, 0, 0))
        toile.alpha_composite(ic, ((320 - ic.size[0]) // 2, (320 - ic.size[1]) // 2))
        toile.save(dst.parent / f'mode-{nom}.webp', quality=88, method=6)
