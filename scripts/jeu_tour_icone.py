"""La vignette du jeu de la tour (public/art/jeu-tour.webp) : des formes en feutrine empilées sur un socle,
dessinées ici (grain, bord plus sombre, couture en pointillés, ombre douce), sans génération d'image."""
import math
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

S = 4  # sur-échantillonnage
W = 320 * S
img = Image.new('RGBA', (W, W), (0, 0, 0, 0))


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def piece(pts, col, fonce):
    global img
    # tout un peu plus grand, pour remplir la vignette comme les autres jeux
    pts = [(((x - 160) * 1.2 + 160) * S, ((y - 172) * 1.2 + 166) * S) for x, y in pts]
    # ombre portée
    sh = Image.new('L', (W, W), 0)
    ImageDraw.Draw(sh).polygon([(x + 3 * S, y + 7 * S) for x, y in pts], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(7 * S))
    img = Image.alpha_composite(img, Image.merge('RGBA', (Image.new('L', (W, W), 40), Image.new('L', (W, W), 25), Image.new('L', (W, W), 90), sh)))
    mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    # dégradé vertical et grain de feutrine
    ys = [y for _, y in pts]
    y0, y1 = min(ys), max(ys)
    c1, c2 = hexc(col), hexc(fonce)
    grad = Image.new('RGB', (W, W))
    gd = ImageDraw.Draw(grad)
    for y in range(int(y0), int(y1) + 2):
        t = max(0.0, min(1.0, (y - y0) / max(1, y1 - y0))) ** 1.3 * 0.55
        gd.line([(0, y), (W, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)))
    bruit = Image.effect_noise((W, W), 40).convert('L').filter(ImageFilter.GaussianBlur(0.8 * S))
    grain = Image.merge('RGB', (bruit, bruit, bruit)).point(lambda v: 200 + v // 4)
    grad = ImageChops.blend(grad, ImageChops.multiply(grad, grain), 0.5)
    # bord un peu plus sombre (le relief de la feutrine)
    inner = mask.filter(ImageFilter.GaussianBlur(9 * S))
    edge = ImageChops.subtract(mask, inner).point(lambda v: min(255, int(v * 1.25)))
    grad = Image.composite(Image.new('RGB', (W, W), c2), grad, edge)
    # un reflet doux sur le dessus : la feutrine paraît bombée
    reflet = ImageChops.offset(inner, 0, 6 * S).point(lambda v: max(0, v - 150) // 2)
    reflet = ImageChops.multiply(reflet, mask)
    grad = Image.composite(Image.new('RGB', (W, W), (255, 255, 255)), grad, reflet)
    img = Image.alpha_composite(img, Image.merge('RGBA', (*grad.split(), mask.filter(ImageFilter.GaussianBlur(0.6 * S)))))
    # la couture
    cx = sum(x for x, _ in pts) / len(pts)
    cy = sum(y for _, y in pts) / len(pts)
    r = max(math.hypot(x - cx, y - cy) for x, y in pts)
    k = 1 - (11 * S) / r
    q = [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]
    q.append(q[0])
    st = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    for (xa, ya), (xb, yb) in zip(q, q[1:]):
        n = max(1, int(math.hypot(xb - xa, yb - ya) / (9 * S)))
        for i in range(n):
            t0, t1 = i / n, (i + 0.55) / n
            sd.line([(xa + (xb - xa) * t0, ya + (yb - ya) * t0), (xa + (xb - xa) * t1, ya + (yb - ya) * t1)], fill=(255, 255, 255, 215), width=int(3 * S))
    img = Image.alpha_composite(img, st)


def rect(cx, cy, w, h, a=0.0):
    c, s = math.cos(a), math.sin(a)
    return [(cx + c * x - s * y, cy + s * x + c * y) for x, y in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]]


def poly(cx, cy, r, n, a0=-math.pi / 2):
    return [(cx + r * math.cos(a0 + i * 2 * math.pi / n), cy + r * math.sin(a0 + i * 2 * math.pi / n)) for i in range(n)]


piece(rect(160, 270, 214, 30), '#E2B68A', '#B98C63')  # le socle
piece(rect(150, 234, 98, 40), '#F9B490', '#E58A5E')  # une brique
piece(rect(176, 193, 58, 42, 0.05), '#B9A6F2', '#8C74D9')  # un carré
piece(rect(160, 161, 134, 22, -0.06), '#F7D27A', '#D9A93E')  # une planche
piece([(120, 150), (160, 150), (160, 120), (140, 100), (120, 120)], '#F5A3BD', '#DB6F92')  # une maisonnette
piece(poly(199, 127, 25, 3), '#9FDCC0', '#5FB893')  # un triangle
piece(poly(150, 74, 23, 6, 0.35), '#9CC8F2', '#5F9CD9')  # un hexagone qui arrive, de travers
img.resize((320, 320), Image.LANCZOS).save(sys.argv[1] if len(sys.argv) > 1 else 'public/art/jeu-tour.webp', 'WEBP', quality=90)
