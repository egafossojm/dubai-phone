# 01 — Vue d’ensemble de l’architecture

## 1. Style retenu

**Monolithe modulaire** (modular monolith) sur **Next.js**.

| Choix | Pourquoi |
| --- | --- |
| Un seul déploiement applicatif | Opération simple pour un magasin unique |
| Domaines séparés dans le code | Maintenabilité sans microservices |
| PostgreSQL unique | Source de vérité métier |
| Pas de Kubernetes / bus d’événements | Hors besoin MVP |

Aligné sur `.cursor/rules/architecture.md`.

---

## 2. Stack technique (déjà en place)

| Couche | Technologie |
| --- | --- |
| UI | Next.js App Router, React 19, TypeScript, Tailwind, shadcn/ui |
| Formulaires / validation | React Hook Form + Zod |
| Données | PostgreSQL + Prisma |
| Offline / PWA | `@ducanh2912/next-pwa` + stockage local (à définir — ADR-0003) |
| Qualité | ESLint, Prettier, Vitest |

---

## 3. Direction des dépendances

```text
Presentation (pages, composants)
        ↓
Application (use-cases / services applicatifs)
        ↓
Domain (règles pures, types, politiques)
        ↓
Infrastructure (Prisma, auth adapters, file system, clock)
```

- Les **pages UI** ne contiennent pas la logique financière / stock.
- Les **handlers API** restent fins : validation → authz → service.
- Le **domaine** ne dépend pas de React ni de Prisma.

---

## 4. Structure de dossiers cible

```text
src/
  app/                      # Routes Next.js (UI + route handlers API)
  components/               # UI (layout, shared, ui)
  modules/                  # Un dossier par domaine métier
    sales/
      domain/
      application/
      infrastructure/
      api/                  # (optionnel) schemas Zod partagés
    inventory/
    ...
  lib/                      # Socle transversal (env, errors, db, auth helpers)
  domain/                   # Types / invariants vraiment partagés (minimal)
  application/              # Orchestrations transverses si besoin
  infrastructure/           # Adapters globaux
```

Les dossiers `src/modules`, `src/domain`, `src/application`, `src/infrastructure` existent déjà en placeholders.

---

## 5. Principes non négociables

1. **Backend + PostgreSQL** = source de vérité (argent, stock, permissions).
2. **Offline POS** = cache / file d’attente, jamais vérité finale.
3. **Transactions DB** pour opérations multi-écritures critiques.
4. **Idempotence** pour retries (POS, sync, paiements, refunds).
5. **RBAC backend** obligatoire ; le masquage UI n’est pas une sécurité.
6. Messages UI en **français** ; identifiants code en **anglais**.

---

## 6. Contexte métier rappel

- 1 magasin, 1 stock logique (MVP)
- Devise FCFA (montants exacts, jamais float)
- Paiements : CASH, ORANGE_MONEY, MTN_MOBILE_MONEY + crédit INSTALLMENT
- Décisions métier : `docs/business/12-open-questions.md`

---

## 7. Ce que cette phase ne fait pas

- Pas d’implémentation de modules métier
- Pas de migrations SQL complètes (→ prompt_003)
- Pas d’écran POS final
