# Le banc d'essai des personnages

Tout ce qui sert à vérifier — et à fabriquer — ce dont les figurines ont besoin pour changer de cheveux et
d'habits sans défaut. Rien de tout ça n'est dans l'appli : ce sont des outils de travail (Python 3, `pip install
numpy scipy pillow opencv-contrib-python-headless rembg onnxruntime playwright`).

## Voir les 78 figurines avec le vrai code de l'appli

`banc.html` (à la racine) et `src/banc.tsx` affichent une grille de `<Character>` décrite dans l'adresse de la page.
`banc.py` la construit (`vite build -c vite.banc.config.ts`), la sert et la photographie :

```python
import banc
banc.construire()
b = banc.Banc()
b.rendre([{'a': banc.avatar(pid, porte=('torsade', 'jean'), x=10), 'n': pid} for pid in banc.IDS], '/tmp/planche.png')
```

C'est le premier réflexe avant de toucher à `personnalise.ts`, `teinture.ts`, `persos.ts` ou `Character.tsx` : une
planche de toutes les figurines, dans la tenue ou la couleur qu'on change.

## L'anatomie d'une figurine

Le masque de chaque figurine (`public/art/persos/<id>-m.webp`) dit, pixel par pixel : sa peau (rouge), ses cheveux
(vert), les traits de son visage et ses habits d'origine (bleu : 255 iris, 170 bouche, 85 sourcils, 10 haut, 20 bas,
30 jambes couvertes, 38 chaussures). Il est fabriqué par :

- `peau_variantes.py` — la peau, lue dans les autres couleurs de peau de la figurine : ce qui change de couleur
  comme la peau d'une image à l'autre EST de la peau (rien à deviner) ;
- `sam.py` — Segment Anything (Meta), pour découper les cheveux et les habits à partir de quelques points sûrs ;
- `anatomie.py` — assemble le tout (cache dans /tmp/t/anat) ;
- `masques_ecrire.py --ecrire` — écrit les masques ; `tenues_ecrire.py` — écrit `src/lib/tenues.ts` (où finit le
  haut d'origine, où commencent les chaussures, la couleur d'un collant).

Après avoir ajouté ou redessiné une figurine : `python3 sam.py <id>` puis `masques_ecrire.py --ecrire` et
`tenues_ecrire.py`, et une planche pour vérifier.

## Les défauts de détourage

`decoupe_reparer.py` — ce que le détourage a mangé là où du blanc touchait le fond blanc d'origine : la jambe de
fi6, les baskets blanches dans les autres couleurs de peau (reprises sur la figurine de départ).
Reste à faire à la main : la manche droite de h14, le bord droit de la manche de fa2 et de la tunique de f16.

## Les compagnons (les animaux)

Même principe pour les huit compagnons (`public/art/pet-<espèce>.webp`) et ce qu'ils portent :

- `animaux.py --ecrire` — mesure chaque animal sur son image (ses yeux, son crâne sans les oreilles, la largeur de sa
  tête, son corps sans sa queue, ses pattes) et écrit `src/lib/animaux.ts` et `public/art/pet-<espèce>-corps.webp`
  (le masque à la forme duquel le pull est découpé). `src/lib/habitsAnimaux.ts` pose chaque habit d'après ces
  repères ; `components/pet.tsx` redessine la tête par-dessus ce qui se porte au cou.
- `habits_animaux.py --ecrire` — retire l'ombre portée et le liseré blanc dessinés dans les images de l'animalerie
  (habits, paniers, jouets, gamelle). Une image déjà nettoyée est laissée telle quelle.
- `animaux_decoupe.py --ecrire` — comble ce que le détourage avait mordu (la tête du lapin et du panda), d'après la
  planche d'origine (`sources/compagnons.jpg`).

Le banc sait aussi montrer un compagnon : une case `{'pet': 'renard', 'habit': 'habit:pull'}`.

Après avoir changé une image de compagnon : `animaux.py --ecrire`, une planche pour vérifier, et — au prochain
changement natif seulement, car toucher à `ios/` demande de refaire l'appli — `python3 scripts/widgets_images.py`
pour que les widgets reprennent la nouvelle image.

