# NIDOO 🏡

Le petit chez-nous qui tient dans un widget : une maison virtuelle par famille, qui vit au rythme des photos surprises, des humeurs et des attentions.

App React + Tailwind + Capacitor (iOS), backend Supabase.

## Ce que contient cette version

- **Maison** : la maison de la famille (maison, appartement ou chalet), une fenêtre par membre qui s'allume quand il donne de ses nouvelles, ciel qui suit l'heure, Nidoo le panda roux qui signale le proche à qui envoyer une attention.
- **Moments** : photos surprises et petits mots, réactions.
- **On pense à toi** : un cœur, un câlin, du courage, un petit mot, reçu en animation sans ouvrir de conversation.
- **Météo des émotions** : son humeur du jour et un mot, visibles par la famille.
- **Jouer** : question du jour, défi photo, étoiles et 12 décorations à débloquer pour la maison.
- **Organiser** : agenda (anniversaires annuels, rendez-vous, événements), liste de courses, missions assignables.
- **Notre famille** : membres, invitation par code ou lien, plusieurs maisons, aperçu des 6 widgets, offre Famille+, profil.

## Lancer

```bash
npm install
npm run dev        # web
npm run ios        # build + synchro Capacitor + ouverture de Xcode
```

Sans clés Supabase, l'app démarre en **mode démo** : la maison vit sur l'appareil avec trois proches fictifs (code d'invitation de test : `DEMO42`).

## Brancher Supabase

1. Créer un projet Supabase et y exécuter `supabase/migrations/0001_nidoo.sql`.
2. Dans Authentication > Sign In / Providers, activer **Allow anonymous sign-ins** (chaque téléphone reçoit un compte invisible, rattachable ensuite à un e-mail depuis « Notre famille »).
3. Copier `.env.example` en `.env.production` (et `.env.local` pour le dev) avec l'URL du projet et la clé publishable.

Toutes les tables sont protégées par RLS : on ne lit que les données des familles dont on est membre. Les étoiles sont attribuées par des triggers côté base, et les décorations achetées par la fonction `unlock_item`, pour que rien ne se triche depuis l'app. Les photos vont dans un bucket privé `moments`.

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
