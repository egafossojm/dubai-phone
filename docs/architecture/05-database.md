# 05 — Architecture base de données

## 1. Principes

| Principe | Application |
| --- | --- |
| PostgreSQL | Source de vérité |
| Prisma | ORM + migrations versionnées |
| UUID (ou cuid) | Clés techniques |
| Références métier | `V-2026-000124`, etc. (Settings) |
| Montants | Entiers FCFA **ou** `DECIMAL`/`NUMERIC` — **jamais** float (ADR-0004) |
| Soft delete | Produits, clients, users ; **pas** ventes / paiements / mouvements / audit |
| Contraintes DB | Unicité IMEI, FK, NOT NULL, checks statut |

Détail schéma : **prompt_003** (database). Ici : décisions architecturales.

---

## 2. Groupes de tables (logiques)

| Groupe | Tables conceptuelles |
| --- | --- |
| Identity | User, Role, Permission, UserRole, RolePermission, Session |
| Catalog | Brand, Category, Product, ProductVariant |
| Supply | Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem |
| Stock | StockMovement, SerializedDevice, (cache qty optionnel sur variant) |
| CRM | Customer |
| Commerce | Sale, SaleItem, Payment, CreditAccount, Installment, Receipt |
| After-sale | Return, ReturnItem, Refund, Warranty |
| Cross-cut | AuditLog, SyncTransaction, Setting / NumberSequence |

---

## 3. Stock

- **Vérité** = somme des `StockMovement` valides.
- Quantité cache sur variant **autorisée** si maintenue dans la **même transaction** que le mouvement.
- Le cache `quantityOnHand` est le **stock vendable** : un IMEI reçu `DAMAGED` est sorti du cache par un mouvement `DAMAGED` `-1` (ADR-0006).
- Devices : unicité `imei1`, `imei2?`, `serialNumber` selon règles produit.

---

## 4. Argent

- Toute écriture monétaire = ligne `Payment` (ou `Refund`) append-oriented.
- Pas de void in-place (U-08) : correctif compensatoire.
- Crédit : `CreditAccount` + `Installment` ; statut dérivé (A1).

---

## 5. Migrations

- Toute évolution via `prisma migrate`.
- Seeds de dev déterministes, **sans** vraies données clients.
- Pas de modification manuelle prod sans migration.

---

## 6. Accès

- Un client Prisma partagé (`src/lib/db/prisma.ts` déjà présent).
- Repositories par domaine ; éviter `prisma.*` dans les composants UI.
- Indexes : SKU, IMEI, téléphone client, refs documents, dates, status.
- Schéma détaillé : `docs/database/README.md` + `prisma/schema.prisma`.
