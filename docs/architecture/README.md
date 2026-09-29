# Architecture technique — Index

**Projet :** Dubai Phone  
**Décision actuelle :** BFF Next.js + microservices Python ([ADR-0010](./adr/0010-python-microservices.md))

---

## Pour qui ?

| Audience | Commencer par |
| --- | --- |
| Non développeur / Product | `01-overview.md`, ADR |
| Frontend | `02-frontend.md`, `07-pos-offline-sync.md` |
| Backend | `03-backend.md`, `04-domain-modules.md`, `11-transactions-idempotency.md` |
| Database | `05-database.md` |
| Sécurité | `06-auth-rbac-audit.md` |
| QA | `08-errors-validation.md`, `09-testing.md` |
| Ops | `10-deployment-observability.md` |

---

## Documents

| Fichier | Contenu |
| --- | --- |
| [01-overview.md](./01-overview.md) | Style d’archi, stack, principes, structure cible |
| [02-frontend.md](./02-frontend.md) | Architecture frontend |
| [03-backend.md](./03-backend.md) | Architecture backend / API |
| [04-domain-modules.md](./04-domain-modules.md) | Frontières de domaines et dépendances |
| [05-database.md](./05-database.md) | Architecture base de données |
| [06-auth-rbac-audit.md](./06-auth-rbac-audit.md) | Auth, autorisation, RBAC, audit |
| [07-pos-offline-sync.md](./07-pos-offline-sync.md) | POS, stockage offline, synchronisation |
| [08-errors-validation.md](./08-errors-validation.md) | Erreurs et validation |
| [09-testing.md](./09-testing.md) | Stratégie de tests |
| [10-deployment-observability.md](./10-deployment-observability.md) | Déploiement et observabilité |
| [11-transactions-idempotency.md](./11-transactions-idempotency.md) | Transactions DB et idempotence |
| [adr/](./adr/) | Architecture Decision Records |

---

## État actuel du code

| Élément | État |
| --- | --- |
| Next.js 15 BFF + UI + POS offline | Présent |
| Prisma + PostgreSQL (schéma métier) | Présent |
| Cœur commerce (ventes, stock, crédit, retours, sync) | Présent (Next.js, une TX) |
| Microservices Python identity / catalog / reporting | Présents (`services/`) |
| Auth sessions `dp_session` | Présente (identity Python en Compose) |
