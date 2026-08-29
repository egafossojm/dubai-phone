# 11 — Transactions DB et idempotence

## 1. Opérations exigeant une **transaction** PostgreSQL

Toute opération qui écrit **plusieurs** agrégats dépendants doit être atomique (`prisma.$transaction`).

| Opération | Écritures typiques ensemble |
| --- | --- |
| Finaliser une vente | Sale, SaleItems, Payments, StockMovements, SerializedDevice, CreditAccount?, Installments?, Warranty?, Receipt, Audit, SyncTransaction? |
| Réceptionner un achat | GoodsReceipt(+items), StockMovements, SerializedDevices, MAJ PO status, Audit |
| Paiement d’échéance crédit | Payment, MAJ Installment(s), MAJ CreditAccount status, Audit |
| Ajustement stock | StockMovement, cache qty?, Device status?, Audit |
| Accepter retour + refund | Return status, ReturnItems, StockMovements / Device, Refund/Payment, Credit adjust?, Audit |
| Échange | Retour partiel + nouvelle vente / mouvement sortant (même TX si conçu ainsi) |
| Sync d’une vente offline | Idempotent complete sale + SyncTransaction |

Si une étape échoue → **rollback total**.

---

## 2. Opérations qui doivent être **idempotentes**

Retentatives réseau / double-clic / sync offline ne doivent pas dupliquer l’effet métier.

| Opération | Clé d’idempotence | Comportement |
| --- | --- | --- |
| Complete sale (POS) | `clientTxnId` (UUID) | 2ᵉ appel → même `saleId` |
| Sync offline batch item | `clientTxnId` | Comme ci-dessus |
| Enregistrer paiement | `idempotencyKey` header ou body | Pas de double encaissement |
| Refund | `idempotencyKey` | Pas de double remboursement |
| Post goods receipt | clé optionnelle + contraintes IMEI | Évite double posting |

Stockage serveur : contrainte unique sur `(scope, idempotencyKey)` ou table `IdempotencyRecord` / `SyncTransaction`.

---

## 3. Opérations sans idempotence stricte (mais validées)

Lectures, créations de brouillons clairement nouveaux, mises à jour de fiches avec `updatedAt` optimiste si besoin.

---

## 4. Concurrence

| Risque | Mitigation |
| --- | --- |
| Double vente même IMEI | Unique + statut device + TX |
| Sur-stock négatif | Check qty en TX / contrainte |
| Double sync | Unique `clientTxnId` |
| Course sur solde crédit | MAJ solde dans TX avec relecture |

---

## 5. Pseudo-flux CompleteSale

```text
BEGIN
  IF exists sale where clientTxnId = :key THEN return existing
  validate permissions, stock, devices, discounts, payments
  insert sale + items
  insert payments
  insert stock movements + update devices
  optional credit + installments
  optional warranties
  insert receipt + audit
  mark sync row SYNCED if any
COMMIT
```
