# 01 — QA pass complète (Prompt 015)

**Date :** 2026-09-05  
**Branche :** `main`  
**Résultat suite :** **203** tests Vitest verts · `tsc --noEmit` OK · ESLint OK

## Objectif

Couvrir AUTH/RBAC, catalogue/IMEI, stock, achats, clients/crédit, POS, retours, sync offline, reçus, dashboard et audit — en priorité les **invariants financiers et stock** — puis corriger plutôt que seulement signaler.

## Matrice de couverture

| Domaine | Couverture | Fichiers clés |
| --- | --- | --- |
| Auth / session / rate-limit | OK | `authorization.integration.test.ts`, `rate-limit.test.ts`, `origin.test.ts`, `password.test.ts` |
| RBAC | OK | permissions unit + API 401/403 par rôle |
| Produits / variantes / IMEI | OK | `products.*.test.ts`, contraintes DB IMEI/SKU |
| Stock / mouvements / ajustements | OK | `inventory.*.test.ts`, `constraints.integration.test.ts` |
| Fournisseurs / achats / réception | OK | `purchases.integration.test.ts` (+ audit `supplier.create`, 403 caisse) |
| Clients / crédit / échéances | OK | `customers` + `credit.*.test.ts` (solde = total − acompte − paiements) |
| POS / remises / paiements / sérialisé | OK | `sales.integration.test.ts`, policies |
| Retours / remboursements / garanties | OK | `returns.*.test.ts` (plafond refund, warranties) |
| Offline / sync / idempotence / conflits | OK | `sync.integration.test.ts`, `lib/offline/*` |
| Reçus | OK | `receipts.*.test.ts` |
| Dashboard | OK | `dashboard.*.test.ts` |
| Audit | OK | `GET /api/audit` RBAC + `write-audit.test.ts` |

## Invariants Prompt 015

| Invariant | Statut | Preuve |
| --- | --- | --- |
| Vente complète réduit le stock **exactement une fois** | Pass | vente + replay `clientTxnId` → qty −1, 1 mouvement `SALE` |
| Doublon de requête ≠ double vente | Pass | replay 200 + mismatch body → 409 |
| Device sérialisé non vendu deux fois | Pass | 422 + race 201/422, 1 mouvement SALE |
| Refund ≤ remboursable | Pass | unit policy + API 422 sur-remboursement |
| Solde crédit = total − acompte − paiements valides | Pass | assert explicite post-paiements |
| Stock = somme des mouvements | Pass | seed cable + post-ajustement / réception |
| Opérations restreintes bloquées | Pass | 403 caisse/stock sur refund, adjust, receive, audit, supplier |

## Écarts volontaires (hors scope MVP)

- E2E Playwright (prévu plus tard, `docs/architecture/09-testing.md`)
- Workflow garantie `CLAIMED` → `RESOLVED`
- Résolution `STORE_CREDIT`
- Export rapports détaillés (`/api/reports` stub)
- Persistance fichier `Receipt.pdfPath`

## Gaps comblés dans cette passe

1. Sur-remboursement API (422, zéro `Refund` créé)
2. Invariant solde crédit explicite
3. Mouvement SALE unique après replay POS
4. `writeAudit` persisté + audit création fournisseur
5. 403 caisse sur `POST /api/suppliers`

## Bugs découverts

Aucun défaut métier bloquant dans cette passe : la suite existante (199) était déjà verte ; les ajouts confirment les invariants sans régression.

## Commandes de validation

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

## Suite

Prompt 016 — production readiness (observabilité, déploiement, checklists go-live).
