# ADR-0010 — Microservices Python + BFF Next.js

- **Statut :** Accepté (remplace [ADR-0001](./0001-modular-monolith-nextjs.md) pour le déploiement)  
- **Date :** 2026-09-28  
- **Contexte :** Découpler les domaines qui peuvent l’être, tout en gardant les invariants financiers et stock.

## Décision

| Processus | Stack | Responsabilité |
| --- | --- | --- |
| `web` (BFF + UI + POS offline) | Next.js | Pages, PWA, proxy `/api/*`, ventes / stock / achats / crédit / retours / sync |
| `identity` | FastAPI (Python) | Login, logout, session, users |
| `catalog` | FastAPI (Python) | Marques, catégories, produits, variantes |
| `reporting` | FastAPI (Python) | Tableau de bord, audit lecture, rapports stub |
| `db` | PostgreSQL | **Une** base partagée (schéma Prisma) |

Le **commerce transactionnel** (CompleteSale, réception, remboursement, crédit, sync) reste dans **un seul processus** (Next.js) et **une seule transaction PostgreSQL**. Le séparer en services Python imposerait des sagas / 2PC et casserait les invariants (ADR historique 0001, `docs/architecture/11-transactions-idempotency.md`).

Les services Python lisent/écrivent les **mêmes tables**. Auth = cookie `dp_session` hashé SHA-256 (pas de JWT).

Next.js proxifie vers Python **uniquement** si `IDENTITY_URL` / `CATALOG_URL` / `REPORTING_URL` sont définis (Compose). `NODE_ENV=test` (Vitest) reste in-process.

## Conséquences positives

- Identity / catalogue / reporting déployables et scalables séparément ;
- UI / offline POS inchangés (navigateur) ;
- Contrats HTTP `{ success, data | error }` conservés.

## Conséquences / limites

- Base unique = couplage de schéma (évolution Prisma centralisée) ;
- Rate-limit login toujours en mémoire **du process identity** (ADR-0008) ;
- Le BFF Next.js reste le point d’entrée public (Nginx → app:3000).

## Alternatives rejetées

| Alternative | Pourquoi non |
| --- | --- |
| Un service Python par table (sales, inventory, payments…) | Transactions distribuées, risque stock/argent |
| Base par service dès maintenant | Duplication, FK cassées, sync complexe |
| Réécrire le POS offline en Python | Le POS offline est **navigateur** (IndexedDB) |
