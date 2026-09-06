# 10 — Déploiement et observabilité

## 1. Déploiement MVP (simple)

| Élément | Choix recommandé |
| --- | --- |
| Application | EC2 + Docker Compose (`app` + **Nginx/Certbot** uid 101) |
| Base | PostgreSQL dans Compose (même instance) |
| Fichiers (reçus PDF) | Générés à la demande (pas de stockage objet MVP) |
| Environnements | `development`, `staging` (si possible), `production` |

**Hors MVP :** Kubernetes, multi-région, service mesh, ALB/RDS, multi-instances sans Redis.

Runbooks : **`docs/ops/`** (EC2 + Compose + CD Actions — `01-deployment.md`, `08-nginx.md`, `09-cd-github-actions.md`).

Variables : `.env.example` + validation `src/lib/env.ts`  
(`DATABASE_URL` **obligatoire** en production ; sessions sans JWT secret).

---

## 2. Pipeline de release

```text
lint → typecheck → unit/integration tests → build → **CD EC2** (backup → compose up → smoke)
```

CD : merge ou *Run workflow* sur `dev` / `prod` → environment GitHub du même nom (`vars.EC2_*` + `secrets.EC2_SSH_KEY`) → EC2 — `docs/ops/09-cd-github-actions.md`.

```bash
source ~/.nvm/nvm.sh && nvm use
npm run lint
npm run typecheck
npm test
npm run build
```

CI (`.github/workflows/ci.yml`) : quality ; **deploy** vers l’environment GitHub `dev` ou `prod`.

---

## 3. Migrations en prod

1. Backup DB  
2. `npm run db:migrate:deploy` (`prisma migrate deploy`)  
3. Déployer l’app compatible  
4. Smoke : `/api/health`, `/api/ready`, login  

Détail : `docs/ops/03-migrations.md`.

---

## 4. Observabilité

| Signal | MVP |
| --- | --- |
| Liveness | `GET /api/health` |
| Readiness | `GET /api/ready` (Postgres + au moins une migration Prisma terminée → sinon 503) |
| Logs app | stdout JSON via `src/lib/logger.ts` (`LOG_LEVEL`) ; erreurs client en JSON structuré |
| Boot | `src/instrumentation.ts` charge `env` (fail-fast prod sans `DATABASE_URL`) |
| Erreurs API | `unhandled_api_error` + message générique client |
| Métriques / APM | FUTURE |
| Audit métier | table `AuditLog` (pas un substitut de logs ops) |

Alertes utiles MVP : app down, DB down (`/api/ready`), taux d’échec sync POS élevé (manuel / logs).

---

## 5. Backups

Procédure concrète : `docs/ops/04-backup-restore.md`.

- Sauvegardes PostgreSQL planifiées (quotidien minimum).  
- Tester une restauration avant go-live puis périodiquement.  
- Les données offline locales **ne remplacent pas** le backup serveur.
