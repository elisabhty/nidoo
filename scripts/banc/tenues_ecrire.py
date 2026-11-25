"""Écrit src/lib/tenues.ts : pour chaque figurine, ce que la boutique a besoin de savoir de sa tenue d'origine
(d'après son anatomie, anatomie.py) : où finit son haut, où commencent ses chaussures, et la couleur de ses jambes
quand ce n'est pas celle de sa peau (un collant blanc).
  python3 scripts/banc/tenues_ecrire.py"""
import numpy as np
from commun import *
import anatomie as an

lignes = []
for pid in IDS:
    z = an.anatomie(pid)
    r = an.reperes(pid)
    mn = MAINS[pid]
    x0, x1 = int((mn[0] + mn[4] * 0.55) * W), int((mn[2] - mn[4] * 0.55) * W)
    # l'ourlet du haut : dans les colonnes du buste (entre les mains), le bas de son haut — presque le plus bas
    bas_du_haut = []
    for x in range(x0, x1 + 1):
        ys = np.where(z['haut'][:, x])[0]
        if len(ys):
            bas_du_haut.append(ys.max())
    oh = float(np.percentile(bas_du_haut, 85) + 1) / H if len(bas_du_haut) > 10 else CORPS[pid][7]
    # … et là où il remonte le plus (un gilet ouvert, un ourlet arrondi) : un bas de la boutique doit commencer plus haut
    om = float(np.percentile(bas_du_haut, 6)) / H if len(bas_du_haut) > 10 else oh
    # le haut des chaussures
    ys = np.where(z['chaussures'].any(1))[0]
    ct = float(ys.min()) / H if len(ys) > 4 else CORPS[pid][4] - 0.06
    # les jambes à nu sous les hanches : leur couleur, si elle n'est pas celle de la peau du visage (un collant)
    L = lab(image(pid))
    jambes = z['peau'] & (an.yy > r['hy'] + 0.03 * H) & (np.abs(an.xx - (r['pl'] + r['pr']) / 2) < 0.2 * W)
    jl = 'null'
    if jambes.sum() > 150:
        c = np.median(L[jambes], axis=0)
        sk = np.array(VISAGES[pid]['sk'])
        if np.sqrt((((c - sk) * np.array([0.6, 1, 1])) ** 2).sum()) > 14:
            jl = f'[{c[0]:.1f}, {c[1]:.1f}, {c[2]:.1f}]'
    genre = {'deux': 0, 'une': 1, 'robe': 2}[z['genre']]
    lignes.append(f"  {pid}: {{ oh: {oh:.4f}, om: {om:.4f}, ct: {ct:.4f}, g: {genre}, jl: {jl} }},")
    if jl != 'null' or genre:
        print(pid, lignes[-1])

(RACINE / 'src/lib/tenues.ts').write_text('''// Généré par scripts/banc/tenues_ecrire.py, d'après les masques des figurines (leur anatomie) :
// ce que la boutique a besoin de savoir de la tenue d'origine de chaque figurine.
// oh : où finit son haut (fraction de la toile, presque le point le plus bas de son ourlet entre les mains) ;
// om : là où cet ourlet remonte le plus (un gilet ouvert) ;
// ct : où commencent ses chaussures ; g : 0 un haut et un bas, 1 une seule pièce (grenouillère), 2 une robe ;
// jl : la couleur (Lab) de ses jambes quand ce n'est pas celle de sa peau (un collant blanc), sinon null.

export type Tenue = { oh: number; om: number; ct: number; g: number; jl: [number, number, number] | null }

export const TENUES: Record<string, Tenue> = {
''' + '\n'.join(lignes) + '\n}\n', encoding='utf-8')
print(len(lignes), 'tenues')
