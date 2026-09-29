# 03 — Architecture backend

## 1. Forme

Le « backend » est **splitté** :

- **Route Handlers** Next.js sous `src/app/api/**` : BFF (proxy) + **cœur commerce** (ventes, stock, achats, crédit, retours, sync, reçus) ;
- **Microservices FastAPI** : `identity`, `catalog`, `reporting` (`services/`, [ADR-0010](./adr/0010-python-microservices.md)).

Si `IDENTITY_URL` / `CATALOG_URL` / `REPORTING_URL` sont absents (Vitest, `npm run dev` local), les handlers Next.js restent in-process.

---

## 2. Cycle de vie d’une requête

```text
HTTP Request
  → Parse / Validation (Zod)
  → Authentication (session)
  → Authorization (permission)
  → Application Service (use-case)
  → Domain rules / policies
  → Repository (Prisma)
  → PostgreSQL
  → Response { success, data } | { success: false, error }
```

Handlers **fins** : pas de règles métier longues dans le fichier de route.

---

## 3. Couches par module

Exemple `sales` :

| Couche | Responsabilité |
| --- | --- |
| `application/complete-sale.ts` | Orchestration, transaction, appels inventory/payments |
| `domain/sale-policies.ts` | Invariants purs (totaux, client requis si crédit…) |
| `infrastructure/sale-repository.ts` | Accès Prisma |
| `api/complete-sale.schema.ts` | Zod input/output |

Les modules se parlent via **services applicatifs** (interfaces claires), pas via accès Prisma croisé sauvage.

---

## 4. Réponses API

Format déjà amorcé dans `src/lib/api/response.ts` :

```ts
{ success: true, data: T }
{ success: false, error: { code, message, details? } }
```

- `message` : français, compréhensible ;
- `code` : machine (`BUSINESS_RULE_ERROR`, `VALIDATION_ERROR`, …) ;
- pas de stack trace au client.

---

## 5. Erreurs domaine

S’appuyer sur `AppError` (`src/lib/errors/app-error.ts`) et étendre les codes :

| Code | HTTP typique |
| --- | --- |
| VALIDATION_ERROR | 400 |
| AUTHENTICATION_ERROR | 401 |
| AUTHORIZATION_ERROR | 403 |
| NOT_FOUND | 404 |
| CONFLICT | 409 |
| BUSINESS_RULE_ERROR | 422 |
| NOT_IMPLEMENTED | 501 |
| INFRASTRUCTURE_ERROR | 503 |
| INTERNAL_ERROR | 500 |

---

## 6. Intégrations externes

MVP Mobile Money = **saisie manuelle** de référence (U-10).

Toute future API opérateur passera par un **adapter** (`infrastructure/payments/orange-money.ts`) derrière une interface, sans coupler le domaine Sales.

---

## 7. Logging

- Logs structurés côté serveur (request id, user id, action).
- **Jamais** : mots de passe, tokens, secrets.
- Corréler avec `AuditLog` pour les actions sensibles (détail dans `06`).
