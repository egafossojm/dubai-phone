# 09 — CD GitHub Actions : environnements `dev` et `prod`

Deux instances EC2 identiques (Compose + Nginx + Certbot).  
Deux **GitHub Environments** du même nom, chacun avec ses secrets SSH.

| Branche cible | Environment GitHub | Instance |
| --- | --- | --- |
| `dev` | `dev` | EC2 dev |
| `prod` | `prod` | EC2 prod |

## Quand ça déploie

| Événement | Cible | Commit déployé |
| --- | --- | --- |
| **Merge** (push) sur `dev` | EC2 **dev** | commit mergé |
| **Merge** (push) sur `prod` | EC2 **prod** | commit mergé |
| **Run workflow** depuis `dev` | EC2 **dev** | HEAD de `dev` |
| **Run workflow** depuis `prod` | EC2 **prod** | HEAD de `prod` |

Une **pull request ouverte** ne déploie pas : elle lance seulement `quality`. Le deploy a lieu au **merge** dans `dev` ou `prod`.

Le déclenchement manuel (Actions → CI → Run workflow) doit être lancé **sur la branche** `dev` ou `prod` (pas une feature branch).

La CI `quality` doit être verte avant le SSH.

Sur l’environment GitHub **`prod`**, activer *Required reviewers* pour qu’un humain approuve avant le SSH (Settings → Environments → prod).

## Créer les environments GitHub

Settings → Environments → New :

1. Nom **`dev`**
2. Nom **`prod`** (protection : reviewers, éventuellement wait timer)

Secrets **par environment** (pas au niveau dépôt, sinon collision) :

| Secret | Dev | Prod |
| --- | --- | --- |
| `EC2_HOST` | Elastic IP / DNS **dev** | Elastic IP / DNS **prod** |
| `EC2_USER` | `ubuntu` | `ubuntu` |
| `EC2_SSH_KEY` | clé privée deploy **dev** | clé privée deploy **prod** |
| `EC2_SSH_PORT` | optionnel (`22`) | optionnel |
| `EC2_DEPLOY_PATH` | optionnel (`/opt/dubai-phone`) | optionnel |

Une clé SSH **par instance** (recommandé).

## Une fois par EC2

Même procédure sur les deux machines (hôtes et `.env` **différents**) :

```bash
sudo mkdir -p /opt/dubai-phone
sudo chown "$USER:$USER" /opt/dubai-phone
git clone -b prod https://github.com/egafossojm/dubai-phone.git /opt/dubai-phone
# EC2 recette : remplacer -b prod par -b dev
cd /opt/dubai-phone
cp .env.example .env
```

| Variable `.env` | Exemple dev | Exemple prod |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://pos-dev.exemple.cm` | `https://pos.exemple.cm` |
| `CERTBOT_DOMAIN` | `pos-dev.exemple.cm` | `pos.exemple.cm` |
| `POSTGRES_PASSWORD` | secret **distinct** | secret **distinct** |
| `DATABASE_URL` | hôte Compose `db` | hôte Compose `db` |

Rebuild après avoir fixé l’URL (`NEXT_PUBLIC_*` = build-arg).  
User SSH du CD ∈ groupe `docker`. Auth SSH par clé uniquement.

`.env` n’est pas dans git : `git reset --hard` ne l’efface pas.

## Security group

Port **22** joignable depuis les runners GitHub (pas d’IP fixe) : clé only, pas de mot de passe SSH.  
**80 / 443** publics. **3000 / 5432** fermés.

Deux security groups identiques, chacun attaché à son instance (ou le même SG).

## Déroulement

```text
PR ouverte     → quality seulement (pas de SSH)
merge → dev    → quality → environment "dev"  → SSH EC2 dev  → reset SHA → compose up
merge → prod   → quality → environment "prod" → SSH EC2 prod → reset SHA → compose up
Run workflow (branche dev|prod) → idem
```

Script serveur : `deploy/ec2-release.sh` (dump `backups/`, `compose up --build`, smoke `/api/ready`). Timeout 40 min.

Deux deploys **dev** et **prod** peuvent tourner en parallèle. Deux deploys sur le **même** env sont sérialisés.

## Rollback

Sur l’EC2 concernée : `git reset --hard <commit> && ./deploy/ec2-release.sh`.  
Migration cassante : restore `backups/pre-deploy_*.dump` ([04-backup-restore.md](./04-backup-restore.md)).

## Interdits

- Secrets EC2 au niveau **repository** (ils masqueraient / mélangeraient dev et prod).
- Même `POSTGRES_PASSWORD` / même domaine sur les deux instances.
- Lancer un *Run workflow* depuis une feature branch (aucun deploy).
- Commits locaux sur l’EC2 : le CD fait `reset --hard`.
