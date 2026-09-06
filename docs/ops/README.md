# Production operations — Dubai Phone

Point d’entrée ops pour le déploiement MVP **mono-processus** :

**EC2 (AWS) + Docker Compose (app + PostgreSQL + Nginx + Certbot).**

| Document | Contenu |
| --- | --- |
| [01-deployment.md](./01-deployment.md) | Instance EC2, Compose, ordre de mise en service, smoke |
| [02-environment.md](./02-environment.md) | Variables d’environnement et secrets |
| [03-migrations.md](./03-migrations.md) | Migrations Prisma en production |
| [04-backup-restore.md](./04-backup-restore.md) | Sauvegardes `pg_dump` → S3 et restauration |
| [05-incident-recovery.md](./05-incident-recovery.md) | Incidents courants (app, Nginx, login, sync) |
| [06-go-live-checklist.md](./06-go-live-checklist.md) | Verdict PASS / WARNINGS / BLOCKERS |
| [07-user-provisioning.md](./07-user-provisioning.md) | Comptes sans API users (501) |
| [08-nginx.md](./08-nginx.md) | Nginx + Certbot **conteneurs**, Let’s Encrypt auto |

Architecture complémentaire : `docs/architecture/10-deployment-observability.md`.  
Sécurité MVP : `docs/security/01-mvp-security-decisions.md`.

## Hypothèses MVP

- **1** instance Node (rate-limit login en mémoire — ADR-0008).
- PostgreSQL **dans Compose** (volume Docker) sur la même EC2.
- TLS **terminé dans le conteneur Nginx** (uid 101) ; Certbot uid 101, renouvellement 12 h.
- L’app n’écoute pas sur l’hôte ; le security group n’ouvre que 22 / 80 / 443.
- Pas de Kubernetes, pas d’ALB, pas de RDS, pas de Nginx installé sur Ubuntu.

## Commandes de validation pré-release

```bash
source ~/.nvm/nvm.sh && nvm use
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Smoke après mise en service (depuis un poste qui voit le domaine) :

```bash
curl -sS "$NEXT_PUBLIC_APP_URL/api/health"   # liveness
curl -sS "$NEXT_PUBLIC_APP_URL/api/ready"    # readiness (DB + migrations)
```
