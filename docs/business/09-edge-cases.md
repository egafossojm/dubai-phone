# 09 — Cas limites

Comportement attendu : **rejeter avec message métier clair** (FR) sauf indication contraire.

---

## Vente / POS

| Cas | Comportement |
| --- | --- |
| Stock insuffisant (non sérialisé) | Rejet |
| Produit inactif | Rejet |
| Device déjà vendu / non disponible | Rejet |
| IMEI inexistant | Rejet |
| Paiement incomplet (vente non-crédit) | Rejet finalisation |
| Somme paiements > total | Rejet (pas de surpaiement) |
| Remise > plafond rôle | Rejet backend |
| Annulation après COMPLETED | Interdit → flux retour |
| Double submit / retry | Idempotence : une seule vente |
| Client manquant + INSTALLMENT | Rejet |

---

## Stock

| Cas | Comportement |
| --- | --- |
| Stock négatif | Interdit par contraintes + règles |
| Doublon IMEI à réception | Rejet |
| Ajustement sans motif | Rejet |
| Device inconnu | Rejet |
| Produit endommagé | Mouvement DAMAGED + statut device ; `quantityOnHand` = stock vendable (ADR-0006) |

---

## Crédit

| Cas | Comportement |
| --- | --- |
| Échéance dépassée | Statut OVERDUE ; pas de pénalité auto MVP |
| Paiement partiel d’échéance | Autorisé ; statut PARTIAL |
| Paiement > solde | Rejet |
| Client multi-crédits | Autorisé ; suivi par CreditAccount |
| Crédit entièrement payé | Statut PAID |
| Paiement « annulé » | Pas de delete ; **pas de void** (décidé U-08) — refund compensatoire |

---

## Retour

| Cas | Comportement |
| --- | --- |
| Hors délai | Rejet ou escalade Manager (**délai configurable**, défaut **7 jours** — décidé U-06) |
| Produit endommagé | Acceptation possible sans remise stock vendable |
| IMEI ≠ vente | Rejet |
| Déjà retourné | Rejet |
| Remboursement partiel | Autorisé si ≤ remboursable |
| Échange | Nouvelle ligne vente / device + mouvement |

---

## Achat

| Cas | Comportement |
| --- | --- |
| Réception partielle | OK → PARTIALLY_RECEIVED |
| Qty reçue > commandée | Rejet MVP |
| Produit manquant | Rester PARTIALLY_RECEIVED |
| IMEI dupliqué | Rejet |
| Annulation après réception partielle | **Interdite** (décidé U-07) ; clôturer le reste non reçu |

---

## Offline

| Cas | Comportement |
| --- | --- |
| Vente offline puis refresh navigateur | Restaurer file locale |
| Reconnect + sync | Envoi idempotent |
| Sync échouée | Statut visible ; retry |
| Conflit IMEI déjà vendu online | Échec sync + résolution Manager |
| Doublon request id | Ignorer second (succès idempotent) |
