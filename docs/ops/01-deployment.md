# 01 — Déploiement production

## Cible MVP

| Élément | Choix |
| --- | --- |
| Runtime | Node 20.19+ (recommandé 24, `.nvmrc`) |
| Process | 1 × `next start` ou image Docker `standalone` |
| Reverse-proxy | nginx / Caddy avec TLS |
| Base | PostgreSQL 14+ |
| Fichiers PDF | Générés à la demande (pas de stockage objet requis) |

## A. Déploiement VM (sans Docker)

1. Installer Node (nvm) + PostgreSQL.
2. Cloner le dépôt, `npm ci`.
3. Créer `.env` production (voir [02-environment.md](./02-environment.md)).
4. Backup DB → `npm run db:migrate:deploy` (voir [03-migrations.md](./03-migrations.md)).
5. `npm run build && npm run start` (ou process manager : systemd / pm2).
6. Reverse-proxy → `127.0.0.1:3000`, headers `X-Forwarded-For` / `X-Forwarded-Proto`.
7. Si le proxy est de confiance : `TRUSTED_PROXY=1`.
8. Smoke : `/api/health`, `/api/ready` (`schema: migrated`), login manager.

## B. Docker Compose

1. Copier `.env.example` → `.env` et **changer** `POSTGRES_PASSWORD` / `DATABASE_URL`.
2. Pour le service app, l’hôte Postgres est `db` :

```bash
DATABASE_URL=postgresql://USER:PASS@db:5432/dubai_phone?schema=public
POSTGRES_PASSWORD=PASS
```

3. Démarrer :

```bash
docker compose up --build -d
```

L’entrypoint exécute `prisma migrate deploy` puis `node server.js` (`RUN_MIGRATE_ON_START=1` par défaut).  
HEALTHCHECK appelle `/api/ready` (DB + migrations).

**Ne pas** lancer le seed démo en production (`ALLOW_PROD_SEED`).

## C. Pipeline release

```text
lint → typecheck → test → build → backup DB → migrate deploy → deploy app → smoke
```

CI : typecheck, lint, test, build, et build image Docker.

## D. Smoke checklist

| Check | Attendu |
| --- | --- |
| `GET /api/health` | 200, `probe: live` |
| `GET /api/ready` | 200, `database: up`, `schema: migrated` (sinon 503) |
| Login compte réel | cookie `dp_session` Secure |
| POS vente cash | stock −1, reçu |
| Sync center | flush outbox OK |
| PDF reçu | `GET /api/receipts/:id/pdf` |
