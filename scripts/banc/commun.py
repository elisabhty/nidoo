"""Ce que partagent les scripts du banc d'essai des personnages : les figurines, leurs repères, leurs images."""
import re
from pathlib import Path
import numpy as np
from PIL import Image
import cv2

RACINE = Path(__file__).resolve().parents[2]
ART = RACINE / 'public/art/persos'
W, H = 300, 440

_p = (RACINE / 'src/lib/persos.ts').read_text(encoding='utf-8')
PERSOS = {}
for m in re.finditer(r"\{ id: '(\w+)', g: '(\w+)', a: (\d), t: (\d), c: '(\w+)'(.*?)label: '([^']*)', m: \[([^\]]+)\]", _p):
    PERSOS[m.group(1)] = dict(g=m.group(2), a=int(m.group(3)), t=int(m.group(4)), c=m.group(5), l='l: true' in m.group(6), b='b: true' in m.group(6), s='s: true' in m.group(6), nom=m.group(7), m=[float(x) for x in m.group(8).split(',')])
IDS = list(PERSOS)

_v = (RACINE / 'src/lib/visages.ts').read_text(encoding='utf-8')
VISAGES = {}
for m in re.finditer(r"(\w+): \{ e: \[([^\]]+)\], mo: \[([^\]]+)\], no: \[([^\]]+)\], p: \[([^\]]+)\], sk: \[([^\]]+)\], ha: (null|\[[^\]]+\]), ir: \[([^\]]+)\], bouche: (\w+)", _v):
    f = lambda s: [float(x) for x in s.split(',')]
    VISAGES[m.group(1)] = dict(e=f(m.group(2)), mo=f(m.group(3)), no=f(m.group(4)), p=f(m.group(5)), sk=f(m.group(6)), ha=None if m.group(7) == 'null' else f(m.group(7)[1:-1]), ir=f(m.group(8)), bouche=m.group(9) == 'true')

def _table(nom):
    t = (RACINE / f'src/lib/{nom}.ts').read_text(encoding='utf-8')
    return {m.group(1): [float(x) for x in m.group(2).split(',')] for m in re.finditer(r"^\s+(\w+): \[([^\]]+)\],", t, re.M)}
CORPS = _table('corps')   # pied g (centre, largeur), pied d (centre, largeur), bas des semelles, buste (centre, largeur), hanches
MAINS = _table('mains')   # poignet g (x, y), poignet d (x, y), largeur d'une main

_pe = (RACINE / 'src/lib/peaux.ts').read_text(encoding='utf-8')
PEAUX = {m.group(1): [int(t) for t in re.findall(r"t: (\d)", m.group(2))] for m in re.finditer(r"^\s+(\w+): \[(.*)\],$", _pe, re.M)}

def image(pid, t=0):
    return np.array(Image.open(ART / f"{pid}{f'-t{t}' if t else ''}.webp").convert('RGBA'))
def masque(pid):
    return np.array(Image.open(ART / f'{pid}-m.webp').convert('RGB'))
def lab(rgb):
    """RGB (…, 3) uint8 → Lab (L 0–100)."""
    return cv2.cvtColor(np.ascontiguousarray(rgb[..., :3]).astype(np.float32) / 255, cv2.COLOR_RGB2LAB)
def menton(pid):
    v = VISAGES[pid]
    return v['mo'][1] + ((v['e'][2] - v['e'][0]) / (H / W)) * 0.42
def ecrire_masque(pid, mk):
    Image.fromarray(mk).save(ART / f'{pid}-m.webp', lossless=True)
