"""Écrit les masques des figurines (public/art/persos/<id>-m.webp) d'après leur anatomie (anatomie.py) :
- rouge 255 : la peau ;
- vert 255 : les cheveux, la barbe, le voile ;
- bleu : 255 l'iris, 170 la bouche, 85 les sourcils (les traits du visage, comme avant), et maintenant les habits
  de la figurine — 10 son haut, 20 son bas, 30 ses jambes couvertes (collants, chaussettes), 38 ses chaussures.
  (Toutes ces valeurs d'habits restent ≤ 40 : pour le code qui cherchait « un trait du visage » (> 40), rien ne change.)
Les masques sont enregistrés sans perte : les valeurs sont exactes.
  python3 scripts/banc/masques_ecrire.py            # dit ce qui changerait
  python3 scripts/banc/masques_ecrire.py --ecrire"""
import sys
import numpy as np
from scipy import ndimage
from PIL import Image
from commun import *
import anatomie as an

HABITS = {'haut': 10, 'bas': 20, 'jambes': 30, 'chaussures': 38}

def anciens_sourcils(pid):
    """Les sourcils de l'ancien masque, s'il en avait bien deux, de taille comparable."""
    b = np.array(Image.open(ANCIENS / f'{pid}-m.webp').convert('RGB'))[..., 2] if (ANCIENS / f'{pid}-m.webp').exists() else masque(pid)[..., 2]
    brow = (b > 60) & (b < 110)
    lab_, n = ndimage.label(brow)
    if n != 2:
        return None
    a = ndimage.sum(brow, lab_, [1, 2])
    return brow if min(a) >= 0.5 * max(a) and min(a) >= 20 else None

def masque_de(pid):
    z = an.anatomie(pid)
    m = np.zeros((H, W, 3), np.uint8)
    for nom, v in HABITS.items():
        m[..., 2][z[nom]] = v
    m[..., 0][z['peau']] = 255
    m[..., 1][z['cheveux']] = 255
    sourcils = z['sourcils'] if z['sourcils_ok'] else None
    if sourcils is None:
        vieux = anciens_sourcils(pid)
        if vieux is not None:
            sourcils = vieux & ~z['cheveux']
    if sourcils is not None:
        m[..., 2][sourcils] = 85
        m[..., 0][sourcils] = 0
        m[..., 1][sourcils] = 0
    m[..., 2][z['bouche']] = 170
    m[..., 2][z['iris']] = 255
    return m, sourcils is not None

if __name__ == '__main__':
    import subprocess, io
    ecrire = '--ecrire' in sys.argv
    # les anciens masques (ceux du dernier commit), pour y reprendre des sourcils
    ANCIENS = Path('/tmp/t/anciens-masques')
    ANCIENS.mkdir(parents=True, exist_ok=True)
    for pid in IDS:
        f = ANCIENS / f'{pid}-m.webp'
        if not f.exists():
            r = subprocess.run(['git', '-C', str(RACINE), 'show', f'HEAD:public/art/persos/{pid}-m.webp'], capture_output=True)
            if r.returncode == 0:
                f.write_bytes(r.stdout)
    avec = 0
    for pid in IDS:
        m, s = masque_de(pid)
        avec += s
        if ecrire:
            Image.fromarray(m).save(ART / f'{pid}-m.webp', lossless=True, quality=100, method=6, exact=True)
    print('masques :', len(IDS), '| avec sourcils :', avec)
    if ecrire:
        # relus : les valeurs sont-elles exactes ?
        for pid in IDS[:5]:
            m, _ = masque_de(pid)
            assert (np.array(Image.open(ART / f'{pid}-m.webp').convert('RGB')) == m).all(), pid
        print('relus sans perte')
else:
    ANCIENS = Path('/tmp/t/anciens-masques')
