# NIDOO 🏡

Le petit chez-nous qui tient dans un widget : une maison virtuelle par famille, qui vit au rythme des photos surprises, des humeurs et des attentions.

App React + Tailwind + Capacitor (iOS), backend Supabase. Interface aux codes iOS (police système, grands titres, barres en verre, listes groupées, feuilles modales, haptique) et illustrations 3D sans aucun emoji.

## Ce que contient cette version

Au premier lancement, un guide en 6 écrans explique chaque fonctionnalité (rejouable depuis Famille > Comment ça marche).


- **Maison** : la maison de la famille (maison, appartement ou chalet), une fenêtre par membre qui s'allume quand il donne de ses nouvelles, ciel qui suit l'heure, Nidoo le panda roux qui signale le proche à qui envoyer une attention.
- **Dossiers** : des espaces créés avec les proches de son choix. Chacun a une couverture, des membres, des sous-dossiers, des photos, des notes modifiables par tous ses membres et une discussion. On ne voit que les dossiers dont on fait partie ; le créateur gère les membres, les autres peuvent quitter. Le fil de la famille (photos surprises et petits mots envoyés à tous) est dans le même onglet.
- **On pense à toi** : un cœur, un câlin, du courage, un petit mot, reçu en animation sans ouvrir de conversation.
- **Météo des émotions** : son humeur du jour et un mot, visibles par la famille.
- **Jouer** : question du jour, défi photo, étoiles et 12 décorations à débloquer pour la maison.
- **Organiser** : agenda (anniversaires annuels, rendez-vous, événements), liste de courses, missions assignables.
- **Dessin en direct** : un widget moyen sur l'accueil. On dessine (crayon de couleur, feutre, gomme, 11 couleurs, 5 fonds) pour un proche ou pour toute la famille ; le dessin arrive tout de suite et se redessine trait par trait chez celui qui le reçoit, qui peut répondre par un dessin. Les dessins sont enregistrés en traits (vectoriels, quelques Ko), pas en images.
- **Notre famille** : membres, invitation par code ou lien, plusieurs maisons, aperçu des widgets, offre Famille+, profil.

## Illustrations

Les avatars, humeurs, attentions, pictos, décorations et maisons sont dans `public/art/` (WebP détourés). Ils viennent de planches générées en 3D dans le style de Nidoo, découpées par `scripts/decoupe_planche.py` :

```bash
python3 scripts/decoupe_planche.py planche.png 2 6 256 public/art avatar-panda,avatar-renard,...
```

## Lancer

```bash
npm install
npm run dev        # web
npm run ios        # build + synchro Capacitor + ouverture de Xcode
```

Sans clés Supabase, l'app démarre en **mode démo** : la maison vit sur l'appareil avec trois proches fictifs (code d'invitation de test : `DEMO42`).

## Brancher Supabase

1. Créer un projet Supabase et y exécuter, dans l'ordre, `supabase/migrations/0001_nidoo.sql`, `0002_dossiers.sql` puis `0003_dessins.sql`.
2. Dans Authentication > Sign In / Providers, activer **Allow anonymous sign-ins** (chaque téléphone reçoit un compte invisible, rattachable ensuite à un e-mail depuis « Notre famille »).
3. Copier `.env.example` en `.env.production` (et `.env.local` pour le dev) avec l'URL du projet et la clé publishable.

Toutes les tables sont protégées par RLS : on ne lit que les données des familles dont on est membre. Les étoiles sont attribuées par des triggers côté base, et les décorations achetées par la fonction `unlock_item`, pour que rien ne se triche depuis l'app. Les photos du fil vont dans un bucket privé `moments`, celles des dossiers dans un bucket privé `dossiers` dont chaque fichier est rangé sous l'identifiant du dossier racine : la base et le stockage vérifient tous deux l'appartenance au dossier.

## Offres

| | Gratuit | Famille+ (3,99 €/mois ou 29,99 €/an) |
|---|---|---|
| Membres par maison | 5 | 15 |
| Maisons créées | 1 | plusieurs |
| Widgets | 3 | tous |

La limite de membres et de maisons est appliquée côté base selon `families.plan`. L'achat intégré (RevenueCat) reste à brancher.

## Reste à faire

- Widgets iOS natifs (WidgetKit) alimentés par un App Group : l'app affiche pour l'instant leur aperçu en direct.
- Achats intégrés Famille+ et notifications push pour les attentions.
- Mini-jeux avancés, albums, décorations premium.
