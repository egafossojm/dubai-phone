# Architecture technique — Index

**Projet :** Dubai Phone  
**Phase :** Architecture (`prompt_002`)  
**Statut :** Documentation uniquement — **aucune logique métier implémentée**  
**Prérequis :** `docs/business/` (prompt_001) + fondation technique (prompt_000)  
**Étape suivante :** `prompt_003_database.txt`

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

## État actuel du code (inspection)

| Élément | État |
| --- | --- |
| Next.js 15 App Router + TypeScript + Tailwind | Présent |
| Prisma + PostgreSQL (schéma fondation) | Présent |
| Zod, React Hook Form, PWA, Vitest | Présents |
| Modules métier (ventes, stock, etc.) | **Absents** |
| Auth réelle | **Absente** |
| Routes API métier | Health check seulement |

---

## Commandes

**Aucune commande Node/npm à lancer** pour cette phase (documentation seule).
