"""Les images du jeu « À deux, on porte ! », générées sur fond vert (ElevenLabs, Seedream 5.5) puis détourées ici :
  public/art/jeu-porte.webp     la tuile du jeu (carrée, comme les autres jeu-*.webp)
  public/art/porte-panda.webp   le panda roux debout, les pattes en avant (il porte un côté de la planche)

  python3 scripts/porte_images.py <panda.jpg> <tuile.jpg>"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ART = Path(__file__).resolve().parent.parent / 'public/art'


def detoure(src: str) -> Image.Image:
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vert = g - np.maximum(r, b)
    alpha = 1 - np.clip((vert - 18) / 46, 0, 1)
    # le reflet vert sur les bords : on ramène le vert au niveau des deux autres
    g2 = np.where(vert > 0, np.maximum(r, b) + vert * (1 - np.clip(vert / 40, 0, 1)) * 0.3, g)
    out = np.dstack([r, np.minimum(g, g2), b, alpha * 255]).astype(np.uint8)
    # on ne garde que le sujet (le plus gros morceau et ce qui le touche presque) : pas de poussières
    lab, k = ndimage.label(ndimage.binary_dilation(alpha > 0.5, iterations=6))
    if k > 1:
        tailles = ndimage.sum(alpha > 0.5, lab, range(1, k + 1))
        garde = np.isin(lab, [i + 1 for i, t in enumerate(tailles) if t > tailles.max() * 0.02])
        out[..., 3] = np.where(garde, out[..., 3], 0)
    im = Image.fromarray(out)
    return im.crop(im.getbbox())


panda = detoure(sys.argv[1])
panda.save(ART / 'porte-panda.webp', quality=90, method=6)
print('porte-panda', panda.size)

tuile = detoure(sys.argv[2])
cote = 320
tuile.thumbnail((cote - 16, cote - 16), Image.LANCZOS)
carre = Image.new('RGBA', (cote, cote), (0, 0, 0, 0))
carre.paste(tuile, ((cote - tuile.width) // 2, (cote - tuile.height) // 2), tuile)
carre.save(ART / 'jeu-porte.webp', quality=90, method=6)
print('jeu-porte', tuile.size)
