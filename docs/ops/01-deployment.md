# 01 — Déploiement production

## Cible MVP

| Élément | Choix |
| --- | --- |
| Hôte | **AWS EC2** (Ubuntu), 1 instance — **Docker seulement** |
| Région | `af-south-1` (Cape Town) si possible, sinon `eu-west-1` |
| Taille | **t3.small** minimum ; **t3.medium** recommandé (app + Postgres + Nginx) |
| Disque | 30 Go gp3 |
| Réseau | Elastic IP + enregistrement DNS **A** |
| Runtime | Image Docker `standalone` (`Dockerfile`) |
| Process | 1 × `node server.js` (Compose `app`) |
| Base | PostgreSQL 16 (Compose `db`, volume `dubai_phone_pg`) |
| Reverse-proxy | **Nginx dans Compose** (uid 101), ports 80/443 — [08-nginx.md](./08-nginx.md) |
| Certificats | **Certbot dans Compose** (uid 101), Let’s Encrypt, renouvellement 12 h |
| Fichiers PDF | Générés à la demande (pas de stockage objet) |

```text
Caisse  --HTTPS:443-->  nginx (conteneur)  --HTTP-->  app:3000  -->  Postgres
```

Hors cible MVP : Nginx/Certbot installés sur l’hôte, ECS, ALB, RDS, Caddy, Kubernetes, multi-instances.

## A. Instance EC2

1. Ubuntu LTS, clé SSH, **Elastic IP**.
2. Security group :
   - **22** : ton IP uniquement
   - **80** et **443** : magasin (ou `0.0.0.0/0` si les caisses n’ont pas d’IP fixe)
   - **3000** et **5432** : **fermé** (5432 n’est publié que sur `127.0.0.1`)
3. DNS : `pos.exemple.cm` → Elastic IP (enregistrement **A**). Attendre la propagation avant le premier certificat.
4. Installer Docker Engine + le plugin Compose (pas Nginx, pas Certbot).
5. Cloner le dépôt (ou copier une release).

## B. Docker Compose

1. Copier `.env.example` → `.env` et **changer** les secrets (voir [02-environment.md](./02-environment.md)).
2. Production :

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://pos.exemple.cm
TRUSTED_PROXY=1
POSTGRES_PASSWORD=<fort>
DATABASE_URL=postgresql://postgres:<fort>@db:5432/dubai_phone?schema=public
CERTBOT_DOMAIN=pos.exemple.cm
CERTBOT_EMAIL=ops@exemple.cm
```

`NEXT_PUBLIC_APP_URL` est un **build-arg** (`Dockerfile` app) : reconstruire **après** avoir fixé l’URL HTTPS. Un rebuild avec `localhost` casse Origin, cookies `Secure` et PWA.

3. L’app n’expose **pas** 3000 sur l’hôte. Seul Nginx publie 80/443.

4. Démarrer :

```bash
docker compose up --build -d
```

Entrypoint `app` : `prisma migrate deploy` puis `node server.js`.  
Certbot : émission HTTP-01 puis `renew` toutes les 12 h. Nginx reload tout seul quand le certificat apparaît ([08-nginx.md](./08-nginx.md)).

5. Smoke (une fois le certificat émis, ou en HTTP tant qu’il n’y en a pas) :

```bash
curl -sS http://127.0.0.1/api/health
curl -sS http://127.0.0.1/nginx-health
docker compose exec nginx id   # uid=101, pas root
```

**Ne pas** lancer le seed démo en production (`ALLOW_PROD_SEED`). Comptes magasin : [07-user-provisioning.md](./07-user-provisioning.md).

Backup **avant** le premier migrate qui touche une base déjà en service : [03-migrations.md](./03-migrations.md), [04-backup-restore.md](./04-backup-restore.md).

Premier certificat : préférer `CERTBOT_STAGING=1`, vérifier les logs `certbot`, puis volume `letsencrypt` neuf + staging retiré pour la prod.

## C. Pipeline release

```text
lint → typecheck → test → build → backup DB → docker compose up --build → smoke Nginx
```

Sur l’EC2 : `git pull` + `docker compose up --build -d`.  
L’entrypoint `app` réapplique `migrate deploy` (no-op si déjà à jour). Les certificats **ne sont pas** régénérés à chaque deploy (volume `letsencrypt`).

CI : typecheck, lint, test, build app, **build Compose** (app + nginx + certbot) — ne déploie pas.

## D. Smoke checklist

| Check | Attendu |
| --- | --- |
| `GET /nginx-health` | 200 `ok` |
| `GET https://…/api/health` | 200, `probe: live` |
| `GET https://…/api/ready` | 200, `database: up`, `schema: migrated` (sinon 503) |
| `docker compose exec nginx id` | `uid=101` |
| Login compte réel | cookie `dp_session` **Secure** |
| POS vente cash | stock −1, reçu |
| Sync center | flush outbox OK |
| PDF reçu | `GET /api/receipts/:id/pdf` |
| PWA | page installable (HTTPS Let’s Encrypt) |

## E. Alternative non retenue

Nginx/Certbot sur l’hôte, VM nue `next start`, Caddy : possibles techniquement, **pas** le chemin ops.
