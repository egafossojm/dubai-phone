# 02 — Variables d’environnement

Référence : `.env.example` + validation Zod (`src/lib/env.ts`).

## Tableau

| Variable | Obligatoire | Notes |
| --- | --- | --- |
| `NODE_ENV` | oui (défaut `development`) | `production` sur EC2 |
| `DATABASE_URL` | **oui en production** | URL PostgreSQL ; optionnelle en dev/test pour le shell UI |
| `NEXT_PUBLIC_APP_NAME` | non (défaut Dubai Phone) | Affichage / PWA |
| `NEXT_PUBLIC_APP_URL` | **oui en prod** | Origine publique **HTTPS**. Build-arg Docker app : rebuild si l’URL change |
| `LOG_LEVEL` | non (`info`) | `debug` \| `info` \| `warn` \| `error` — logs JSON stdout |
| `TRUSTED_PROXY` | **oui derrière Nginx** | Défaut Compose `1` — Nginx fixe `X-Forwarded-For` / `X-Real-IP` |
| `SEED_USER_PASSWORD` | pour seed uniquement | Jamais commitée ; comptes démo |
| `ALLOW_PROD_SEED` | non | Doit être `1` pour autoriser le seed si `NODE_ENV=production` |

### Docker Compose (EC2)

| Variable | Obligatoire | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | non (`postgres`) | Utilisateur Postgres du service `db` |
| `POSTGRES_PASSWORD` | **oui** | Pas de défaut secret dans compose |
| `POSTGRES_DB` | non (`dubai_phone`) | Nom de la base |
| `POSTGRES_PORT` | non (`5432`) | Publié en **127.0.0.1** seulement (dump local) |
| `RUN_MIGRATE_ON_START` | non (`1`) | `0` pour skipper migrate dans l’entrypoint |
| `DATABASE_URL` | **oui** | Hôte = `db` dans Compose, **pas** `localhost` ni l’Elastic IP |
| `NGINX_HTTP_PORT` | non (`80`) | Port hôte → Nginx 8080 |
| `NGINX_HTTPS_PORT` | non (`443`) | Port hôte → Nginx 8443 |
| `CERTBOT_DOMAIN` | **oui en prod TLS** | FQDN (ex. `pos.exemple.cm`). Vide = pas d’émission |
| `CERTBOT_EMAIL` | **oui en prod TLS** | Compte Let’s Encrypt. Vide = Certbot attend |
| `CERTBOT_STAGING` | non (`0`) | `1` pour l’API staging (tests, rate-limit) |

## Secrets

- Pas de JWT secret : sessions = jeton aléatoire hashé (SHA-256) en base.
- Stocker `.env` hors git (déjà ignoré). Rotation : changer mots de passe utilisateurs + révoquer sessions (`revokedAt`) si compromission.
- Ne **jamais** réutiliser les e-mails `*@dubai-phone.local` du seed en magasin réel.

## Exemple production (EC2 + Compose)

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Dubai Phone
NEXT_PUBLIC_APP_URL=https://pos.exemple.cm
TRUSTED_PROXY=1
LOG_LEVEL=info

POSTGRES_USER=postgres
POSTGRES_PASSWORD=<fort>
POSTGRES_DB=dubai_phone
DATABASE_URL=postgresql://postgres:<fort>@db:5432/dubai_phone?schema=public
RUN_MIGRATE_ON_START=1

CERTBOT_DOMAIN=pos.exemple.cm
CERTBOT_EMAIL=ops@exemple.cm
```

## Exemple développement local (Compose)

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<fort>
POSTGRES_DB=dubai_phone
DATABASE_URL=postgresql://postgres:<fort>@db:5432/dubai_phone?schema=public
NEXT_PUBLIC_APP_URL=http://localhost
TRUSTED_PROXY=1
LOG_LEVEL=info
RUN_MIGRATE_ON_START=1
# CERTBOT_DOMAIN / CERTBOT_EMAIL vides → pas d’appel Let’s Encrypt
```

L’UI Compose se joint via **Nginx** (`http://localhost`, pas `:3000`).
