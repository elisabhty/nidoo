"""Segment Anything (Meta, poids publiés par le projet rembg) pour découper les figurines en parties : on lui
montre des points (« ceci est le haut », « ceci n'en est pas ») et il rend le contour exact de la partie.
Sert seulement à fabriquer les masques, sur l'ordinateur de travail : rien de tout ça n'est dans l'appli."""
import os
from pathlib import Path
import numpy as np
import cv2
import onnxruntime as ort
from commun import *

DOSSIER = Path(os.environ.get('SAM_DOSSIER', '/home/claude/modeles/sam'))
CACHE = Path(os.environ.get('SAM_CACHE', '/tmp/t/sam'))
MODELE = os.environ.get('SAM_MODELE', 'sam_vit_b_01ec64')
FOND = np.array([60, 200, 90], np.float32)  # un vert qu'aucune figurine ne porte : les bords se voient bien
_enc = _dec = None

def _options():
    so = ort.SessionOptions()
    so.intra_op_num_threads = 2
    # sans réserve de mémoire : l'encodeur en demande déjà beaucoup (la machine de travail n'a que 8 Go)
    so.enable_cpu_mem_arena = False
    so.enable_mem_pattern = False
    return so

def _chemins():
    os.environ['U2NET_HOME'] = str(DOSSIER)
    from rembg.sessions.sam import SamSession
    return SamSession.download_models(sam_model=MODELE)

def _encodeur():
    global _enc
    if _enc is None:
        _enc = ort.InferenceSession(str(_chemins()[0]), _options())
    return _enc

def _decodeur():
    global _dec
    if _dec is None:
        _dec = ort.InferenceSession(str(_chemins()[1]), _options())
    return _dec

class Vue:
    """Une figurine (ou un morceau : `boite` = x0, y0, x1, y1 en pixels) vue par SAM. Le modèle publié attend une image
    posée en haut à gauche d'une toile de 1024 de large sur 684 de haut : on agrandit le morceau pour la remplir."""
    TH, TW = 684, 1024
    def __init__(self, pid, boite=None, t=0):
        self.pid = pid
        im = image(pid, t).astype(np.float32)
        a = im[..., 3:4] / 255
        rgb = im[..., :3] * a + FOND * (1 - a)
        self.x0, self.y0, self.x1, self.y1 = [int(v) for v in (boite or (0, 0, W, H))]
        rgb = rgb[self.y0:self.y1, self.x0:self.x1]
        h, w = rgb.shape[:2]
        self.h, self.w = h, w
        self.k = min(self.TW / w, self.TH / h)
        self.th, self.tw = min(self.TH, int(h * self.k + 0.5)), min(self.TW, int(w * self.k + 0.5))
        cle = CACHE / f"{MODELE}-{pid}-{t}-{self.x0}.{self.y0}.{self.x1}.{self.y1}.npy"
        if cle.exists():
            self.emb = np.load(cle)
        else:
            CACHE.mkdir(parents=True, exist_ok=True)
            toile = np.empty((self.TH, self.TW, 3), np.float32)
            toile[:] = FOND
            toile[:self.th, :self.tw] = np.clip(cv2.resize(rgb, (self.tw, self.th), interpolation=cv2.INTER_CUBIC), 0, 255)
            enc = _encodeur()
            self.emb = enc.run(None, {enc.get_inputs()[0].name: toile})[0]
            np.save(cle, self.emb)

    def masque(self, oui=(), non=(), boite=None, avant=None):
        """Le masque (toile entière de la figurine) pour ces points (en pixels de la figurine). `avant` : les logits
        d'un essai précédent, pour affiner. Renvoie (masque booléen, score, logits bas, carte des logits)."""
        dec = _decodeur()
        pts = [(x, y) for x, y in oui] + [(x, y) for x, y in non]
        lab = [1] * len(oui) + [0] * len(non)
        if boite:
            pts += [(boite[0], boite[1]), (boite[2], boite[3])]
            lab += [2, 3]
        else:
            pts.append((self.x0, self.y0))
            lab.append(-1)
        c = (np.array(pts, np.float32) - np.array([self.x0, self.y0], np.float32) + 0.5) * self.k
        if not boite:
            c[-1] = 0
        m, s, bas = dec.run(None, {
            'image_embeddings': self.emb,
            'point_coords': c[None],
            'point_labels': np.array(lab, np.float32)[None],
            'mask_input': avant if avant is not None else np.zeros((1, 1, 256, 256), np.float32),
            'has_mask_input': np.array([1 if avant is not None else 0], np.float32),
            'orig_im_size': np.array([self.TH, self.TW], np.float32),
        })
        petit = cv2.resize(m[0, 0][:self.th, :self.tw], (self.w, self.h), interpolation=cv2.INTER_AREA)
        tout = np.full((H, W), -30, np.float32)
        tout[self.y0:self.y1, self.x0:self.x1] = petit
        return tout > 0, float(s[0, 0]), bas, tout

def boites(pid):
    """Les deux vues d'une figurine : la tête avec toute sa chevelure, et le corps (du cou aux semelles)."""
    ch = menton(pid) * H
    g = masque(pid)[..., 1] > 128
    ys = np.where(g.any(1))[0]
    bas_cheveux = int(ys.max()) if len(ys) else 0
    fin = max(ch + 0.12 * H, bas_cheveux + 10)
    fin = int(min(H, np.ceil(fin / 20) * 20))
    return (0, 0, W, fin), (0, int(max(0, np.floor((ch - 0.05 * H) / 10) * 10)), W, H)

def vues(pid, t=0):
    bt, bc = boites(pid)
    return Vue(pid, bt, t), Vue(pid, bc, t)

if __name__ == '__main__':
    import sys, time
    ids = sys.argv[1:] or IDS
    for i, pid in enumerate(ids):
        t0 = time.time()
        vues(pid)
        print(pid, f'{i + 1}/{len(ids)}', round(time.time() - t0, 1), 's', flush=True)
