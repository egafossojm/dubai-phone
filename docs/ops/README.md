# Production operations — Dubai Phone

Point d’entrée ops pour un déploiement MVP **mono-processus** (`next start` ou Docker)
derrière un reverse-proxy TLS, avec PostgreSQL managé ou conteneurisé.

| Document | Contenu |
| --- | --- |
| [01-deployment.md](./01-deployment.md) | Déploiement VM / Docker, reverse-proxy, smoke tests |
| [02-environment.md](./02-environment.md) | Variables d’environnement et secrets |
| [03-migrations.md](./03-migrations.md) | Migrations Prisma en production |
| [04-backup-restore.md](./04-backup-restore.md) | Sauvegardes et restauration PostgreSQL |
| [05-incident-recovery.md](./05-incident-recovery.md) | Incidents courants et recovery |
| [06-go-live-checklist.md](./06-go-live-checklist.md) | Verdict PASS / WARNINGS / BLOCKERS |
| [07-user-provisioning.md](./07-user-provisioning.md) | Comptes sans API users (501) |

Architecture complémentaire : `docs/architecture/10-deployment-observability.md`.  
Sécurité MVP : `docs/security/01-mvp-security-decisions.md`.

## Hypothèses MVP

- **1** instance Node (rate-limit login en mémoire — ADR-0008).
- PostgreSQL 14+ avec backups planifiés.
- TLS terminé sur nginx / Caddy / load balancer.
- Pas de Kubernetes requis.

## Commandes de validation pré-release

```bash
source ~/.nvm/nvm.sh && nvm use
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Smoke après démarrage :

```bash
curl -sS "$NEXT_PUBLIC_APP_URL/api/health"   # liveness
curl -sS "$NEXT_PUBLIC_APP_URL/api/ready"    # readiness (DB)
```
