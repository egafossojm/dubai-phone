# Schéma de base de données

**Phase :** `prompt_003`  
**Implémentation :** `prisma/schema.prisma`  
**Pas d’écrans UI** dans cette phase.

---

## 1. Décisions

| Sujet | Choix |
| --- | --- |
| IDs techniques | UUID |
| Références métier | champs `reference` uniques (`V-2026-000124`) |
| Argent | `BigInt` = **FCFA entiers** (ADR-0004) |
| Stock | `stock_movements` = vérité ; `product_variants.quantityOnHand` = cache **vendable** (ADR-0006) |
| Soft delete | `deletedAt` sur users, brands, categories, products, variants, suppliers, customers |
| Finance / audit / mouvements | **pas** de soft delete ; corrections = nouvelles lignes |

---

## 2. Groupes de tables

| Groupe | Tables |
| --- | --- |
| Identité | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions` |
| Paramètres | `store_settings`, `number_sequences`, `idempotency_records` |
| Catalogue | `brands`, `categories`, `products`, `product_variants` |
| Appareils | `product_serials` (IMEI 1 / IMEI 2 / n° série) |
| Achats | `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` |
| Stock | `stock_movements` |
| Clients / crédit | `customers`, `customer_credits`, `installments` |
| Ventes | `sales`, `sale_items`, `sale_discounts`, `payments`, `receipts` |
| Après-vente | `returns`, `return_items`, `refunds`, `warranties` |
| Transversal | `audit_logs`, `sync_transactions` |

---

## 3. Contraintes importantes

- SKU unique (`product_variants.sku`)
- IMEI1, IMEI2, n° de série uniques (`product_serials`)
- Téléphone client unique **parmi les clients actifs** (index partiel `deletedAt IS NULL`)
- `sales.clientTxnId` unique (idempotence POS / offline)
- `payments.idempotencyKey` et `refunds.idempotencyKey` uniques
- `payment_allocations` : une ligne par échéance touchée par un paiement crédit
- Un mouvement `PURCHASE_RECEIPT` par ligne BR non sérialisée (`goodsReceiptItemId` + `productSerialId IS NULL`)
- Un mouvement `PURCHASE_RECEIPT` par couple (ligne BR, IMEI) pour le sérialisé
- **Index partiels SQL** (migrations `…_stock_movement_gr_uniques`, `…_customer_phone_payment_allocations`) — **pas** exprimables en `@@unique` Prisma ; `prisma db push` ne les recrée pas. Toujours utiliser les migrations.
- Clés étrangères `Restrict` sur l’historique financier (pas de cascade destructrice)
- CHECK SQL (migration) : montants > 0, quantité mouvement ≠ 0, IMEI1 ≠ IMEI2

---

## 4. Données de démo (seed)

Source : `prisma/seed.ts` (commande `npx prisma db seed`).

**Mot de passe :** variable `SEED_USER_PASSWORD` dans `.env` (fichier ignoré par git).

| E-mail | Rôle |
| --- | --- |
| `admin@dubai-phone.local` | Super administrateur |
| `manager@dubai-phone.local` | Manager |
| `caisse@dubai-phone.local` | Vendeur / Caissier |
| `stock@dubai-phone.local` | Responsable stock |

Jeux représentatifs :

- Réception `GR-2026-000001` (2 téléphones sérialisés + 10 câbles)
- Vente cash `V-2026-000001` (1 câble)
- Vente crédit `V-2026-000002` (1 Galaxy + échéancier)

---

## 5. Commandes (à lancer sur votre machine)

Node 24 via `.nvmrc`, PostgreSQL doit tourner, et `.env` doit contenir `DATABASE_URL`.

PostgreSQL n’était **pas démarré** sur cette machine au moment de l’écriture (pas d’écoute sur le port 5432).  
Les commandes ci-dessous sont donc **à lancer chez vous**.

### Option A — PostgreSQL déjà installé

```bash
createdb dubai_phone
```

### Option B — Docker (si PostgreSQL n’est pas installé)

```bash
docker run --name dubai-phone-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dubai_phone -p 5432:5432 -d postgres:16
```

```bash
cd /home/ega/encours/ai/Projets/dubai-phone
source ~/.nvm/nvm.sh && nvm use

# 2) Générer le client Prisma
npx prisma generate

# 3) Appliquer les migrations
npx prisma migrate deploy

# 4) Charger seed + données de démo
npx prisma db seed

# 5) Tests (les tests d'intégration DB s'exécutent si DATABASE_URL est défini)
npm test
```

Pour inspecter les tables visuellement :

```bash
npx prisma studio
```
