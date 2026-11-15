# NIDOO 🏡

Le petit chez-nous qui tient dans un widget : une maison virtuelle par famille, qui vit au rythme des photos surprises, des humeurs et des attentions.

App React + Tailwind + Capacitor (iOS), backend Supabase. Interface aux codes iOS (police système, grands titres, barres en verre, listes groupées, feuilles modales, haptique) et illustrations 3D sans aucun emoji.

## Ce que contient cette version

Au premier lancement, un guide en 6 écrans explique chaque fonctionnalité (rejouable depuis Famille > Comment ça marche).


- **Maison** : « Notre petit monde » (la maison animée, son niveau et les étoiles qui manquent avant la prochaine surprise), trois gestes rapides (un câlin, une photo, un dessin), « Aujourd'hui en famille » (le proche qui a une petite mine, son humeur, les rendez-vous du jour et du lendemain, les missions, la question du jour), le défi de la semaine, les humeurs et le dessin en direct. La maison suit l'heure et les saisons (feuilles d'automne, neige, pétales, papillons). En haut, un cordon noir traverse le décor : les dernières photos partagées y sont accrochées avec des pinces à linge en bois. La famille vit dans le jardin : chacun son personnage, qui respire, cligne des yeux, se promène et bouge selon son humeur (il sautille quand il est au top, se balance quand il est fatigué…), avec une bulle qui dit son humeur du jour. Les proches restent toujours en couleur ; son propre personnage est grisé tant qu'on n'a pas partagé son humeur du jour. Toucher un proche ouvre le câlin, se toucher soi-même ouvre « Mon humeur du jour ».
- **Les gestes, pour de vrai** : quand on envoie un câlin, un bisou, du courage ou un cœur, son personnage traverse le jardin jusqu'à l'autre et le fait (bras ouverts pour le câlin, penché avec les joues qui rosissent pour le bisou…), puis revient. La scène se joue chez celui qui envoie et chez celui qui reçoit, et le téléphone vibre selon le geste (une longue étreinte, deux petits « smack », un battement de cœur).
- **Les humeurs en smileys** : dans la maison, la bulle au-dessus de chacun est un smiley dessiné (pas un emoji) qui se lit d'un coup d'œil.
- **Petits et grands** : chacun choisit sa taille (adulte, ado, enfant, bébé) et le jardin montre bien qui est petit. Les bébés et les enfants sans téléphone sont ajoutés par un proche (Famille > Ajouter un enfant ou un bébé) : ils ont leur personnage (tétine possible), vivent dans le jardin, reçoivent des câlins, et la famille donne leur humeur. Ils ne comptent pas dans la limite de membres. Le jardin accueille sept personnes, au-delà un « +N ».
- **Personnages** : à l'inscription, chacun crée son personnage, à la manière des Mii : un même visage pour tous et ce qui rend chacun unique (teint, 12 coupes, 10 couleurs de cheveux, couleur des yeux, lunettes, barbe, grain de beauté, taches de rousseur, rouge à lèvres, boucles d'oreilles, couleur du haut). Son visage prend son humeur du jour partout dans l'app (sourire, yeux fermés, sourcils froncés, larme, goutte de stress, chapeau de fête dans la maison). Modifiable dans Famille > Mon personnage.
- **Souvenirs** : des dossiers créés avec les proches de son choix. Chacun a une couverture, des membres, des sous-dossiers, des photos, des notes modifiables par tous ses membres et une discussion. On ne voit que les dossiers dont on fait partie ; le créateur gère les membres, les autres peuvent quitter. Le fil de la famille (photos surprises et petits mots envoyés à tous) est dans le même onglet.
- **On pense à toi** : un cœur, un câlin, du courage, un petit mot, reçu en animation sans ouvrir de conversation.
- **Humeur du jour** : son humeur et un mot, visibles par la famille.
- **Moments** : question du jour (on répond par un mot, une photo, ou les deux), défi photo, défi de la semaine, étoiles (expliquées dans une fiche dédiée) et la maison. « Décorer la maison » ouvre une page à part, qui glisse par-dessus l'écran : la maison en grand, puis les 11 décorations rangées en Animaux et plantes, Le jardin, La maison et le ciel.
- **Animaux et plantes, en famille** : le chat et les oiseaux se nourrissent (+3 étoiles), les fleurs et le potager s'arrosent (+1), une fois par jour pour toute la famille. Quand ils ont faim ou soif, une petite bulle (gamelle, graines, arrosoir) apparaît au-dessus d'eux dans le jardin et une ligne s'ajoute à « Aujourd'hui en famille ». On les touche pour s'en occuper : l'arrosoir verse, la gamelle arrive, et le « +3 » monte au-dessus, en direct chez tout le monde, même quand c'est un proche qui l'a fait. Avant d'adopter le chat, d'accueillir les oiseaux ou de planter, une fiche prévient qu'il faudra s'en occuper chaque jour, ensemble.
- **Croquettes** : le chat et les oiseaux mangent les croquettes de la maison, un stock commun. Chaque repas en consomme un ; un sac de 10 repas s'achète 15 étoiles dans « Décorer la maison ». Quand il en reste 2 ou moins, « Aujourd'hui en famille » le rappelle ; sans croquettes, on ne peut plus nourrir et l'appli ouvre la boutique.
- **Animaux oubliés** : un animal qui n'a pas mangé la veille devient triste (couleurs ternes, bulle cerclée de rouge), au bout de deux jours il déprime (gris, immobile, un petit nuage de pluie au-dessus), et au 4e jour sans repas il s'en va : il est retiré du jardin, les étoiles dépensées ne sont pas rendues, et la famille l'apprend par une fiche « Le chat est parti ». La règle est appliquée par la base. Les plantes oubliées fanent mais restent.
- **Caresses** : une fois nourri, toucher le chat le fait caresser (une main passe et repasse, il ronronne, des cœurs s'envolent) ; les oiseaux, eux, chantent. La première caresse du jour rapporte 1 étoile à chacun ; une petite main invite à le faire tant qu'on ne l'a pas fait.
- **Défi de la semaine** : un objectif commun qui change chaque lundi (par exemple 6 câlins, 10 humeurs et 2 photos). Relevé ensemble, il offre une décoration à toute la famille. La progression est comptée par la base et la récompense ne peut être reçue qu'une fois.
- **Organiser** : agenda (anniversaires annuels, rendez-vous, événements) en liste « À venir » ou en vue « Semaine » (les 7 jours avec un point par événement, puis la semaine jour par jour, d'une semaine à l'autre ; le « + » d'un jour ajoute un événement ce jour-là). Chaque événement dit qui est concerné (toute la famille, ou les proches choisis : leurs têtes apparaissent sur la ligne, et en touchant l'événement on voit chacun avec son prénom) et a une description (l'adresse, qui apporte quoi…). Toute la famille peut compléter les deux. Liste de courses, missions assignables.
- **Créer une attention, en direct** : un seul widget moyen et un seul bouton « Créer une attention ». On prend une photo (ou on la choisit), on la cadre et on dessine dessus avec ses crayons (crayon de couleur, feutre, gomme qui efface pour de vrai, 11 couleurs), ou on dessine sur une feuille vierge (5 fonds). Le widget montre seulement la dernière reçue, avec la tête de celui qui l'a envoyée : dès qu'une nouvelle arrive, elle remplace l'ancienne. On l'envoie à un proche ou à toute la famille : elle arrive tout de suite, et le dessin se refait trait par trait sur la photo. On peut répondre de la même façon. Ce qui est envoyé à toute la famille apparaît aussi dans le fil et sur le fil à photos de la maison. Les dessins sont enregistrés en traits (vectoriels, quelques Ko) ; les photos vont dans un espace privé, visible seulement par ceux qui voient l'instant.
- **Notre famille** : membres, invitation par code ou lien, plusieurs maisons, aperçu des widgets, offre Famille+, profil. Le widget « Notre maison » montre la maison avec toute la famille et l'humeur de chacun, en moyen ou en grand (le grand ajoute le nom de la famille, combien ont partagé leur humeur et ce que le jardin attend).
- **Entrée sur acceptation** : le code d'invitation ne fait pas entrer, il envoie une demande. Un responsable de la famille (le créateur, et ceux qu'il nomme) accepte ou refuse ; tant que ce n'est pas fait, la personne ne voit rien. Le code expire au bout de 7 jours, un responsable peut le changer à tout moment et retirer quelqu'un de la famille. Les essais de code sont limités à 15 par heure pour qu'on ne puisse pas les deviner.

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

1. Créer un projet Supabase et y exécuter, dans l'ordre, `supabase/migrations/0001_nidoo.sql`, `0002_dossiers.sql`, `0003_dessins.sql`, `0004_invitations.sql`, `0005_defis.sql`, `0006_personnages.sql`, `0007_sans_guirlande.sql`, `0008_enfants.sql`, `0009_instants.sql`, `0010_soins.sql` puis `0011_animaux.sql`.
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
