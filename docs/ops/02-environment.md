# 02 — Variables d’environnement

Référence : `.env.example` + validation Zod (`src/lib/env.ts`).

## Tableau

| Variable | Obligatoire | Notes |
| --- | --- | --- |
| `NODE_ENV` | oui (défaut `development`) | `production` en go-live |
| `DATABASE_URL` | **oui en production** | URL PostgreSQL ; optionnelle en dev/test pour le shell UI |
| `NEXT_PUBLIC_APP_NAME` | non (défaut Dubai Phone) | Affichage / PWA |
| `NEXT_PUBLIC_APP_URL` | non (défaut localhost) | Origine publique HTTPS en prod |
| `LOG_LEVEL` | non (`info`) | `debug` \| `info` \| `warn` \| `error` — logs JSON stdout |
| `TRUSTED_PROXY` | non | `1` / `true` seulement derrière un proxy qui fixe les IP |
| `SEED_USER_PASSWORD` | pour seed uniquement | Jamais commitée ; comptes démo |
| `ALLOW_PROD_SEED` | non | Doit être `1` pour autoriser le seed si `NODE_ENV=production` |

### Docker Compose (si `docker compose up`)

| Variable | Obligatoire | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | non (`postgres`) | Utilisateur Postgres du service `db` |
| `POSTGRES_PASSWORD` | **oui** | Pas de défaut secret dans compose |
| `POSTGRES_DB` | non (`dubai_phone`) | Nom de la base |
| `POSTGRES_PORT` | non (`5432`) | Port publié sur l’hôte |
| `APP_PORT` | non (`3000`) | Port publié de l’app |
| `RUN_MIGRATE_ON_START` | non (`1`) | `0` pour skipper migrate dans l’entrypoint |
| `DATABASE_URL` | **oui** | Hôte = `db` dans Compose, pas `localhost` |

## Secrets

- Pas de JWT secret : sessions = jeton aléatoire hashé (SHA-256) en base.
- Stocker `.env` hors git (déjà ignoré). Rotation : changer mots de passe utilisateurs + révoquer sessions (`revokedAt`) si compromission.
- Ne **jamais** réutiliser les e-mails `*@dubai-phone.local` du seed en magasin réel.

## Exemple production (VM)

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Dubai Phone
NEXT_PUBLIC_APP_URL=https://pos.exemple.cm
DATABASE_URL=postgresql://dubai:***@db.interne:5432/dubai_phone?schema=public
LOG_LEVEL=info
TRUSTED_PROXY=1
```

## Exemple Docker Compose

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<fort>
POSTGRES_DB=dubai_phone
DATABASE_URL=postgresql://postgres:<fort>@db:5432/dubai_phone?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=info
RUN_MIGRATE_ON_START=1
```
