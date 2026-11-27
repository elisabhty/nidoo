# La sauvegarde de nuit

Chaque nuit vers 3 h, GitHub lance `.github/workflows/sauvegarde.yml`, qui fait trois choses :

1. **Vider la corbeille** : ce qui est dans « Supprimés récemment » depuis plus de 30 jours est effacé pour de bon.
2. **Copier les photos, vidéos et dessins** de Supabase dans Cloudflare R2. Seuls les nouveaux fichiers sont copiés, et
   rien n'est jamais effacé de la copie.
3. **Copier la base** (les familles, les comptes, le fil, les albums…), **chiffrée** avec ta phrase secrète. Les 30
   dernières nuits sont gardées dans R2.

Tant que les réglages ci-dessous ne sont pas faits, la sauvegarde ne fait rien et ne signale pas d'erreur.

## 1. Cloudflare R2 (gratuit jusqu'à 10 Go)

1. Crée un compte sur [dash.cloudflare.com](https://dash.cloudflare.com), puis ouvre **R2 Object Storage**.
2. **Create bucket** : nom `nidoo-sauvegarde`. Pour l'emplacement, choisis l'Union européenne (*EU jurisdiction*) si
   c'est proposé, sinon *Western Europe*.
3. **Manage API tokens** › **Create API token** : permission *Object Read & Write*, limitée au bucket
   `nidoo-sauvegarde`. Garde ces trois valeurs : l'*Access Key ID*, le *Secret Access Key* et l'*Account ID* (il est
   dans l'adresse du tableau de bord, ou en haut à droite de la page R2).

## 2. Supabase

1. **Project Settings › API Keys** : copie la clé **service_role**. Elle ouvre tout : ne la colle nulle part
   ailleurs que dans GitHub.
2. **Connect** (en haut) › **Session pooler** : copie l'adresse `postgresql://…`, et remplace `[YOUR-PASSWORD]` par le
   mot de passe de la base. Si tu ne l'as plus : *Project Settings › Database › Reset database password*.

## 3. Une phrase secrète

Invente une longue phrase (par exemple quatre mots au hasard et un chiffre) et **garde-la dans ton gestionnaire de
mots de passe**. Sans elle, la copie de la base ne peut pas être relue, ni par toi ni par personne.

## 4. Les secrets dans GitHub

Sur GitHub, va dans le dépôt `nidoo` › **Settings › Secrets and variables › Actions › New repository secret**, et
ajoute-les un par un :

| Nom | Valeur |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé service_role |
| `SUPABASE_DB_URL` | l'adresse `postgresql://…` du Session pooler, avec le mot de passe |
| `R2_ACCOUNT_ID` | l'Account ID Cloudflare |
| `R2_ACCESS_KEY_ID` | l'Access Key ID |
| `R2_SECRET_ACCESS_KEY` | le Secret Access Key |
| `R2_BUCKET` | `nidoo-sauvegarde` |
| `BACKUP_PASSPHRASE` | ta phrase secrète |

Pour essayer tout de suite : onglet **Actions › Sauvegarde de nuit › Run workflow**. Le journal ne montre que des
nombres (le dépôt est public) : « 42 copié(s) », « copie du 2026-11-28 gardée »…

## Remettre en état après un incident

- **Une photo ou une publication supprimée par erreur** : dans l'appli, *Albums › Supprimés récemment* (30 jours).
- **Des fichiers perdus** : ils sont dans R2, sous `fichiers/<espace>/<chemin>`, au même chemin que dans Supabase. On
  les renvoie dans Supabase Storage au même endroit.
- **La base** : récupère `base/AAAA-MM-JJ.dump.enc` dans R2, puis :

  ```sh
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in AAAA-MM-JJ.dump.enc -out base.dump   # demande la phrase secrète
  pg_restore --no-owner --no-privileges --dbname "<adresse de la base>" base.dump
  ```

  Avec le plan Pro de Supabase, il y a en plus 7 jours de sauvegardes de la base, à remettre en un clic depuis le
  tableau de bord (*Database › Backups*).
