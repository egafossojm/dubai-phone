# 10 — Déploiement et observabilité

## 1. Déploiement MVP (simple)

| Élément | Choix recommandé |
| --- | --- |
| Application | 1 process Node (`next start`) ou image Docker `standalone` derrière reverse proxy TLS |
| Base | PostgreSQL managé ou conteneur |
| Fichiers (reçus PDF) | Générés à la demande (pas de stockage objet MVP) |
| Environnements | `development`, `staging` (si possible), `production` |

**Hors MVP :** Kubernetes, multi-région, service mesh, multi-instances sans Redis.

Runbooks détaillés : **`docs/ops/`**.

Variables : `.env.example` + validation `src/lib/env.ts`  
(`DATABASE_URL` **obligatoire** en production ; sessions sans JWT secret).

---

## 2. Pipeline de release

```text
lint → typecheck → unit/integration tests → build → backup → migrate deploy → deploy → smoke
```

```bash
source ~/.nvm/nvm.sh && nvm use
npm run lint
npm run typecheck
npm test
npm run build
```

CI (`.github/workflows/ci.yml`) : migrate + seed + typecheck + lint + test + **build** + **docker build**.

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
