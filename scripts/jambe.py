"""La jambe nue en feutrine (public/art/persos/jambe.webp), prise sur la figurine gi1 (le garçon en short).

Quand on change de bas (jupe, short, robe), le pantalon de la figurine est retiré sous l'ourlet et cette jambe
est redessinée à la place, étirée à la bonne taille et teintée de la couleur de peau de la figurine
(voir renderJambes dans src/lib/personnalise.ts). Affiche aussi la couleur moyenne de la jambe (Lab).
"""
from pathlib import Path

import numpy as np
from PIL import Image

D = Path(__file__).resolve().parent.parent / 'public/art/persos'
im = Image.open(D / 'gi1.webp').convert('RGBA')
c = im.crop((106, 364, 147, 393))  # sous l'ourlet du short, au-dessus de la chaussette
c.save(D / 'jambe.webp', quality=92, method=6)
a = np.asarray(c).astype(float) / 255
ok = a[..., 3] > 0.9


def lab(rgb):
    def f(u):
        return np.where(u > 0.04045, ((u + 0.055) / 1.055) ** 2.4, u / 12.92)
    r, g, b = f(rgb[..., 0]), f(rgb[..., 1]), f(rgb[..., 2])
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    t = lambda v: np.where(v > 0.008856, np.cbrt(v), 7.787 * v + 16 / 116)
    return np.stack([116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))], -1)


L = lab(a[..., :3])[ok]
print(c.size, 'Lab moyen', L.mean(0).round(1))
