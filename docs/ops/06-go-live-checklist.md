# 06 — Go-live checklist (Prompt 016 + remédiation 999 A+B+C)

**Date :** 2026-09-05  
**Cible :** MVP mono-magasin, **mono-processus** Node + PostgreSQL.  
**Ops :** EC2 + Docker Compose (app, db, Nginx, Certbot).

## Chemin de déploiement

| Chemin | Statut |
| --- | --- |
| **2 × EC2 + CD GitHub Environments `dev` / `prod`** | **Cible ops** — `09-cd-github-actions.md` |
| VM nue `next start` / Caddy | Non retenu |

Secrets Compose : `POSTGRES_PASSWORD`, `DATABASE_URL`. Nginx : `TRUSTED_PROXY=1` + `NEXT_PUBLIC_APP_URL=https://…`.

## Vérifications automatisées

| Check | Résultat |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — **214** exécutés (CI avec Postgres) |
| `npm run build` | PASS (`standalone` + instrumentation) |
| E2E Playwright | **absent** (warning) |

Compter les tests **exécutés** (passed), pas seulement collectés ; sans Postgres local beaucoup d’intégrations sont **skipped** (CI force la DB).

## PASS (code)

- Auth sessions + revoke-on-login + RBAC + audit métier
- Migrations Prisma + index hot-path
- `AppError` / `handleRoute` + logger JSON
- PWA + offline POS + reçus PDF on-demand
- QA invariants (Prompt 015+)
- `parseEnv` : `DATABASE_URL` obligatoire si `NODE_ENV=production` (+ instrumentation boot)
- `isTrustedProxyEnabled` branché sur `clientIp`
- Liveness `/api/health` ; readiness `/api/ready` = DB **et** migration terminée
- CI : migrate + typecheck + lint + test + build (+ docker build)
- Docker : Alpine openssl, `binaryTargets` musl, entrypoint `migrate deploy`, HEALTHCHECK `/api/ready`
- Compose : secrets via `.env` (`:?`) ; Nginx/Certbot **uid 101** ; app sans port public
- Seed bloqué en prod sans `ALLOW_PROD_SEED=1`
- Runbooks ops (EC2 + Nginx) + provisioning users SQL (`07-user-provisioning.md`)

## WARNINGS

- Pas d’E2E Playwright
- Rate-limit login mémoire → **une** instance Node (une EC2)
- Pas d’APM / Prometheus
- PDF non persistés (`pdfPath` réservé)
- Users API 501 — comptes via SQL / seed (runbook 07)
- Snapshot offline tronqué si catalogue très large
- Backup : cron `pg_dump` → **S3** à activer et **tester** (`04-backup-restore.md`)
- `TRUSTED_PROXY=1` avec Nginx Compose qui **écrase** `X-Forwarded-For` (`08-nginx.md`)

## BLOCKERS (ops — hors merge code)

Toujours bloquants **avant ouverture magasin** :

1. Backup PostgreSQL planifié hors EC2 + **un** restore testé
2. Aucun compte démo `*@dubai-phone.local` en prod
3. `NEXT_PUBLIC_APP_URL` HTTPS + certificat Let’s Encrypt (conteneur Certbot)
4. Security group : 22 restreint ; 3000/5432 fermés
5. Mono-instance (ou Redis rate-limit accepté / reporté)
6. Image **app** rebuild **avec** l’URL publique réelle

## Déclaration

**Production-ready MVP mono-processus : OUI conditionnel** — après validation locale/CI verte post-remédiation 999, et levée des blockers ops ci-dessus.  
Ne pas confondre « code prêt » et « magasin ouvert ».
