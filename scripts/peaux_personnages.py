"""Construit les figurines « autre peau » pour l'appli à partir des versions recalées (gen/tons/reg/t1..t6) :
- écarte celles qui ont perdu un détail (barbe, couleur de cheveux) ou dont les mains n'ont pas suivi,
- réchauffe la peau « dorée » (t3), sortie un peu verdâtre,
- enlève les doublons (une peau trop proche de l'originale ou d'une autre),
- écrit public/art/persos/<id>-t<k>.webp, le morceau de visage <id>-t<k>-v.webp (pour changer nez et bouche)
  et src/lib/peaux.ts (les peaux disponibles pour chaque figurine, leur couleur, leur teinte de galerie).
usage: tons_build.py [--apercu dossier]"""
import sys, json, re, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
from skimage import color

ROOT = '/home/claude/gen/tons'
PUB = '/home/claude/nidoo/public/art/persos'
SRC = '/home/claude/nidoo/src/lib'
apercu = sys.argv[sys.argv.index('--apercu') + 1] if '--apercu' in sys.argv else None
persos = open(f'{SRC}/persos.ts').read()
ids = re.findall(r"id: '(\w+)'", persos)
T = {p: int(t) for p, t in re.findall(r"id: '(\w+)'.*?\bt: (\d)", persos)}
M = {p: [float(x) for x in m.split(',')] for p, m in re.findall(r"id: '(\w+)'.*?m: \[([^\]]+)\]", persos)}
vis = open(f'{SRC}/visages.ts').read()
VP = {p: (int(x), int(y)) for p, x, y in re.findall(r"  (\w+): \{.*?p: \[(\d+), (\d+)\]", vis)}
BOUCHE = {p: b == 'true' for p, b in re.findall(r"  (\w+): \{.*?bouche: (true|false)", vis)}
ev = json.load(open(f'{ROOT}/eval.json'))

# vérifiées à l'œil : un détail a changé
REJET = {('h05', 1): 'barbe perdue', ('gm3', 1): 'lunettes ajoutées', ('b1', 5): 'cheveux foncés', ('b2', 5): 'cheveux foncés'}
ORDRE = [5, 6, 1, 4, 2, 3]  # en cas de doublon, on garde d'abord les peaux les plus marquées


def lab(rgb):
    return color.rgb2lab(rgb.astype(np.float32) / 255.0)


def to_rgb(L):
    return (color.lab2rgb(L).clip(0, 1) * 255 + 0.5).astype(np.uint8)


def zones(pid, H, W):
    mk = np.array(Image.open(f'{PUB}/{pid}-m.webp').convert('RGB'))
    base = np.array(Image.open(f'{PUB}/{pid}.webp').convert('RGBA'))
    A0 = base[..., 3] > 200
    skin = (mk[..., 0] > 128) & A0
    t, hh = M[pid][0] * H, M[pid][1] * H
    yy = np.arange(H)[:, None] * np.ones((1, W))
    return base, skin & (yy < t + hh * 1.05), skin & (yy >= t + hh * 1.15)


def med(Lab, m):
    return np.median(Lab[m], axis=0) if m.sum() > 30 else None


def rechauffe(var, base, face_lab):
    """La peau t3 tire sur le vert : on la réchauffe, seulement là où la peau a changé (le reste est intact)."""
    Lv = lab(var[..., :3])
    Lb = lab(base[..., :3])
    dE = np.linalg.norm(lab(cv2.GaussianBlur(var[..., :3], (0, 0), 1)) - lab(cv2.GaussianBlur(base[..., :3], (0, 0), 1)), axis=2)
    wc = np.clip((dE - 6) / 8, 0, 1) * (var[..., 3] > 60)
    dk = np.hypot(Lv[..., 1] - face_lab[1], Lv[..., 2] - face_lab[2])
    wk = np.clip((30 - dk) / 10, 0, 1) * (np.abs(Lv[..., 0] - face_lab[0]) < 32)
    w = cv2.GaussianBlur((wc * wk).astype(np.float32), (0, 0), 1.0)
    da, db = 15 - face_lab[1], 34 - face_lab[2]
    Lv[..., 1] += w * da
    Lv[..., 2] += w * db
    out = var.copy()
    out[..., :3] = to_rgb(Lv)
    return out


# les teintes de la galerie : la clarté moyenne des figurines de chaque teinte
cent = {}
for pid in ids:
    f = ev[pid]['base']['face']
    if f:
        cent.setdefault(T[pid], []).append(f[0])
C = {t: float(np.mean(v)) for t, v in cent.items()}
print('teintes de galerie (L):', {t: round(c, 1) for t, c in sorted(C.items())})
bucket = lambda L: min(C, key=lambda t: abs(C[t] - L))

PEAUX = {}
keep_files = set()
stats = {'gardées': 0, 'doublons': 0, 'rejet': 0, 'mains': 0}
for pid in ids:
    H, W = 440, 300
    base, face, body = zones(pid, H, W)
    Lb = lab(base[..., :3])
    bf, bb = med(Lb, face), med(Lb, body)
    dfb0 = (bf[0] - bb[0]) if bf is not None and bb is not None else 0
    cands = {}
    for k in range(1, 7):
        p = f'{ROOT}/reg/t{k}/{pid}.webp'
        if not os.path.exists(p):
            continue
        if (pid, k) in REJET:
            stats['rejet'] += 1
            continue
        var = np.array(Image.open(p).convert('RGBA'))
        Lv = lab(var[..., :3])
        vf, vb = med(Lv, face & (var[..., 3] > 200)), med(Lv, body & (var[..., 3] > 200))
        if vf is None:
            continue
        if k == 3:
            var = rechauffe(var, base, vf)
            Lv = lab(var[..., :3])
            vf, vb = med(Lv, face & (var[..., 3] > 200)), med(Lv, body & (var[..., 3] > 200))
        # les mains (et le cou) doivent avoir suivi le visage
        if vb is not None and bb is not None and abs(vf[0] - bf[0]) >= 12:
            if (vb[0] - bb[0]) / (vf[0] - bf[0]) < 0.45:
                stats['mains'] += 1
                continue
        cands[k] = (var, vf)
    kept = [(0, bf)]
    for k in ORDRE:
        if k not in cands:
            continue
        vf = cands[k][1]
        if any(np.linalg.norm(vf - o) < 9 for _, o in kept if o is not None):
            stats['doublons'] += 1
            continue
        kept.append((k, vf))
    out = []
    for k, vf in sorted(kept[1:], key=lambda x: -x[1][0]):
        var = cands[k][0]
        stats['gardées'] += 1
        name = f'{pid}-t{k}'
        dest = apercu or PUB
        Image.fromarray(var).save(f'{dest}/{name}.webp', quality=88, method=6)
        keep_files.add(f'{name}.webp')
        # le morceau de visage sans nez ni bouche, pris sur cette peau
        if BOUCHE.get(pid) and pid in VP and os.path.exists(f'{PUB}/{pid}-v.webp'):
            pv = np.array(Image.open(f'{PUB}/{pid}-v.webp').convert('RGBA'))
            px, py = VP[pid]
            ph, pw = pv.shape[:2]
            erase = np.zeros((H, W), np.uint8)
            erase[py:py + ph, px:px + pw] = (pv[..., 3] > 8) * 255
            erase = cv2.dilate(erase, np.ones((3, 3), np.uint8), iterations=1)
            bgr = cv2.cvtColor(np.ascontiguousarray(var[..., :3]), cv2.COLOR_RGB2BGR)
            clean = cv2.cvtColor(cv2.inpaint(bgr, erase, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
            patch = np.dstack([clean[py:py + ph, px:px + pw], pv[..., 3]])
            Image.fromarray(patch).save(f'{dest}/{name}-v.webp', lossless=True)
            keep_files.add(f'{name}-v.webp')
        out.append({'t': k, 'lab': [round(float(x), 1) for x in vf], 'b': bucket(vf[0])})
    PEAUX[pid] = out

print(stats)
if not apercu:
    # les anciennes versions qui ne servent plus
    for f in os.listdir(PUB):
        if re.match(r'\w+-t\d(-v)?\.webp$', f) and f not in keep_files:
            os.remove(f'{PUB}/{f}')
    lines = ['// Généré par tools/tons_build.py : les autres couleurs de peau de chaque figurine.',
             '// Ce sont de vraies images (public/art/persos/<id>-t<k>.webp), refaites par l\'IA à partir de la figurine,',
             '// pas un recoloriage : le visage, les lunettes, la barbe et les habits restent ceux de la figurine.',
             '// t : le numéro de l\'image, lab : la couleur de la peau du visage, b : la teinte de la galerie (TONES).',
             '',
             'export type Peau = { t: number; lab: [number, number, number]; b: number }',
             '',
             'export const PEAUX: Record<string, Peau[]> = {']
    for pid in ids:
        items = ', '.join(f"{{ t: {o['t']}, lab: [{o['lab'][0]}, {o['lab'][1]}, {o['lab'][2]}], b: {o['b']} }}" for o in PEAUX[pid])
        lines.append(f'  {pid}: [{items}],')
    lines.append('}')
    open(f'{SRC}/peaux.ts', 'w').write('\n'.join(lines) + '\n')
    print('peaux.ts écrit,', sum(len(v) for v in PEAUX.values()), 'peaux')
json.dump(PEAUX, open(f'{ROOT}/peaux.json', 'w'))
