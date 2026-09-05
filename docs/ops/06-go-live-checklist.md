# 06 — Go-live checklist (Prompt 016 + remédiation 999 A+B+C)

**Date :** 2026-09-05  
**Cible :** MVP mono-magasin, **mono-processus** Node + PostgreSQL.

## Chemins de déploiement

| Chemin | Statut |
| --- | --- |
| **VM** (`migrate deploy` + `next start`) | Supporté — procédure `01-deployment.md` §A |
| **Docker Compose** (entrypoint migrate + `/api/ready` schéma) | Supporté — secrets via `.env` (`POSTGRES_PASSWORD`, `DATABASE_URL`) |

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
- Compose : plus de secrets hardcodés (`:?` requires `.env`)
- Seed bloqué en prod sans `ALLOW_PROD_SEED=1`
- Runbooks ops + provisioning users SQL (`07-user-provisioning.md`)

## WARNINGS

- Pas d’E2E Playwright
- Rate-limit login mémoire → **une** instance Node
- Pas d’APM / Prometheus
- PDF non persistés (`pdfPath` réservé)
- Users API 501 — comptes via SQL / seed (runbook 07)
- Snapshot offline tronqué si catalogue très large
- Backup planifié : **à activer** et **tester** chez l’hébergeur
- `TRUSTED_PROXY` correct derrière le reverse-proxy

## BLOCKERS (ops — hors merge code)

Toujours bloquants **avant ouverture magasin** :

1. Backup PostgreSQL planifié + **un** restore testé
2. Aucun compte démo `*@dubai-phone.local` en prod
3. `NEXT_PUBLIC_APP_URL` HTTPS + TLS
4. Mono-instance (ou Redis rate-limit accepté / reporté)

## Déclaration

**Production-ready MVP mono-processus : OUI conditionnel** — après validation locale/CI verte post-remédiation 999, et levée des blockers ops ci-dessus.  
Ne pas confondre « code prêt » et « magasin ouvert ».
