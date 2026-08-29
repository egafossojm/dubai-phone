# 07 — Catalogue des règles métier

Les identifiants `BR-*` ci-dessous sont alignés sur `.cursor/rules/business-rules.md`.  
Ce document les **organise** pour la conception ; le fichier rules reste la source normative dans le dépôt.

---

## Produits

| ID | Règle |
| --- | --- |
| BR-PRODUCT-001 | SKU actif unique |
| BR-PRODUCT-002 | Produit sérialisé = devices individuels |
| BR-PRODUCT-003 | IMEI unique globalement |
| BR-PRODUCT-004 | N° de série unique quand requis |
| BR-PRODUCT-005 | Prix de vente stockés TTC ; pas de moteur fiscal complexe MVP |

---

## Stock

| ID | Règle |
| --- | --- |
| BR-INVENTORY-001 | Stock dérivé des mouvements valides |
| BR-INVENTORY-002 | Tout changement de stock = mouvement |
| BR-INVENTORY-003 | Vente completed diminue le stock **une seule fois** |
| BR-INVENTORY-004 | Retour client accepté peut augmenter le stock |
| BR-INVENTORY-005 | Retour fournisseur diminue le stock |
| BR-INVENTORY-006 | Ajustement = permission + qty + motif + user + timestamp + audit |
| BR-INVENTORY-007 | Device non disponible ne peut pas être vendu |

---

## Achats

| ID | Règle |
| --- | --- |
| BR-PURCHASE-001 | Cycle DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED (ou CANCELLED) |
| BR-PURCHASE-002 | Sur-réception interdite (MVP) |
| BR-PURCHASE-003 | Réception sérialisée : unicité IMEI/série + cohérence qty |

---

## Ventes

| ID | Règle |
| --- | --- |
| BR-SALE-001 | Validations permission / dispo / qty / device / remise / paiement |
| BR-SALE-002 | Finalisation atomique |
| BR-SALE-003 | Identifiant unique / idempotence anti-doublon |
| BR-SALE-004 | Vente sérialisée liée au device exact |

---

## Paiements

| ID | Règle |
| --- | --- |
| BR-PAYMENT-001 | Uniquement CASH, ORANGE_MONEY, MTN_MOBILE_MONEY, INSTALLMENT |
| BR-PAYMENT-002 | Montants positifs sauf refund valide |
| BR-PAYMENT-003 | Vente crédit : total, acompte, solde, échéancier |
| BR-PAYMENT-004 | Pas de surpaiement du solde (sauf politique future) |

---

## Crédit

| ID | Règle |
| --- | --- |
| BR-CREDIT-001 | Solde = ventes crédit − paiements valides |
| BR-CREDIT-002 | PAID si solde = 0 |
| BR-CREDIT-003 | PARTIALLY_PAID si payé > 0 et solde > 0 |
| BR-CREDIT-004 | OVERDUE si échéances dépassées non soldées |

---

## Remises

| ID | Règle |
| --- | --- |
| BR-DISCOUNT-001 | Permission requise |
| BR-DISCOUNT-002 | Plafonds configurables par rôle |
| BR-DISCOUNT-003 | Validation **backend** obligatoire |
| BR-DISCOUNT-004 | Remises sensibles auditables |

### Priorité de prix (MVP — décidé U-04)

1. Prix catalogue (variant)  
2. Remise ligne (si autorisée)  
3. Remise globale panier (si autorisée)  

Cumul ligne + globale autorisé, avec **plafond** sur le total remisé selon le rôle.

**Pas de moteur promo** en MVP ; Manager peut appliquer une remise dans son plafond.

Types de remise MVP : **% ou montant fixe**, au niveau **ligne et/ou global** (les deux).

---

## Retours / Garanties / Audit / Offline

Voir `business-rules.md` sections 8–12 (`BR-RETURN-*`, `BR-WARRANTY-*`, `BR-AUDIT-*`, `BR-OFFLINE-*`).

---

## Règles complémentaires documentées ici (pas encore dans rules file)

À reporter éventuellement dans `business-rules.md` en phase ultérieure :

| ID proposé | Règle |
| --- | --- |
| BR-SALE-005 | Client obligatoire si mode INSTALLMENT |
| BR-SALE-006 | Somme des paiements immédiats = total si vente non-crédit |
| BR-SALE-007 | Acompte crédit : minimum configurable **> 0** et acompte < total (décidé U-03) |
| BR-PAYMENT-005 | Une vente peut avoir N payment transactions |
| BR-RECEIPT-001 | Reçu obligatoire à la completion ; IMEI/série/garantie pour sérialisés |
