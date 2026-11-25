"""La peau d'une figurine, lue dans ses autres couleurs de peau : ces images (refaites à partir de la figurine) ne
changent que la peau — un pixel dont la couleur bouge comme la peau, d'une image à l'autre, EST de la peau ; un pixel
qui ne bouge pas (cheveux, barbe, habits, lunettes) n'en est pas. Bien plus sûr que de deviner à la couleur."""
import re
import numpy as np
from commun import *

_pe = (RACINE / 'src/lib/peaux.ts').read_text(encoding='utf-8')
PEAUX_LAB = {}
for m in re.finditer(r"^\s+(\w+): \[(.*)\],$", _pe, re.M):
    PEAUX_LAB[m.group(1)] = {int(t): [float(x) for x in l.split(',')] for t, l in re.findall(r"t: (\d), lab: \[([^\]]+)\]", m.group(2))}

def part_de_peau(pid, detail=False):
    """Pour chaque pixel, sa part de peau (0 = rien de la peau, 1 = peau), ou None si la figurine n'a pas d'autre peau.
    Avec `detail`, renvoie aussi les cartes de chaque image."""
    im = image(pid)
    L0 = lab(im)
    sk0 = np.array(VISAGES[pid]['sk'])
    cartes, poids = [], []
    for t, sk in PEAUX_LAB.get(pid, {}).items():
        o = image(pid, t)
        D = np.array(sk) - sk0
        n2 = float((D ** 2).sum())
        if n2 < 12 ** 2:
            continue
        s = ((lab(o) - L0) * D).sum(-1) / n2
        s[(im[..., 3] < 128) | (o[..., 3] < 128)] = 0
        cartes.append(s)
        poids.append(n2)
    if not cartes:
        return (None, [], []) if detail else None
    C = np.stack(cartes)
    Pw = np.array(poids)[:, None, None]
    moy = (C * Pw).sum(0) / Pw.sum()
    return (moy, cartes, poids) if detail else moy
