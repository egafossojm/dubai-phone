# 08 — Permissions, opérations sensibles et audit

## 1. Légende matrice

| Symbole | Signification |
| --- | --- |
| C | Consulter |
| W | Créer / Modifier |
| A | Approuver |
| X | Interdit |
| — | Non applicable |
| \* | Avec permission fine / plafond |

Rôles : **SA** Super Admin · **MG** Manager · **SP** Sales · **IM** Inventory

---

## 2. Matrice fonctionnelle (MVP)

| Fonction | SA | MG | SP | IM |
| --- | --- | --- | --- | --- |
| Dashboard opérationnel | C | C | C\* | C\* |
| Produits (CRUD / désactiver) | W | W | C | C/W\* |
| Prix de vente | W | W | C | C |
| Stock / mouvements | C | C/W | C | C/W |
| Ajustement stock | A/W | A/W | X | W\* |
| Fournisseurs | W | W | C | W |
| Commandes / réceptions | W | W | X | W |
| Clients | W | W | W | C |
| POS / créer vente | W | W | W | X |
| Remise ≤ seuil rôle | W | W | W\* | X |
| Remise > seuil vendeur | W | W\* | X | X |
| Paiement échéance crédit | W | W | W | X |
| Demande retour | W | W | W\* | X |
| Approuver retour / refund | W | A | X | X |
| Garantie (consult / claim) | W | W | C/W\* | C |
| Rapports financiers | C | C | X/C\* | C\* stock |
| Utilisateurs / rôles | W | C | X | X |
| Permissions | W | X | X | X |
| Paramètres magasin | W | W\* | X | X |
| Audit log | C | C\* | X | X |
| Synchro offline (ops) | W | W | W | — |

\* = restreint par permission granulaire (ex. vendeur voit **son** CA sur le
tableau de bord via `dashboard.read`, pas la marge / créances / CA magasin —
réservés à `reports.read`).

---

## 3. Opérations sensibles

| Opération | Rôles | Approbation | Audit | Réversible ? |
| --- | --- | --- | --- | --- |
| Désactiver produit | SA, MG | Non | Oui | Soft — réactivable |
| Modifier prix | SA, MG | Non (MVP) | Oui | Oui (nouvelle valeur audité) |
| Remise > seuil SP | MG, SA | Implicite rôle | Oui | Non (vente déjà faite) |
| Remboursement | MG, SA | Oui (self-approve MG OK MVP) | Oui | Compensatoire seulement |
| Annuler vente completed | — | — | — | **Interdit** ; utiliser retour |
| Ajustement stock | IM\*, MG, SA | Motif obligatoire | Oui | Compensatoire |
| Désactiver utilisateur | SA | Non | Oui | Réactivable |
| Modifier permissions | SA | Non | Oui | Oui mais audité |
| Clôturer / cancel crédit | SA, MG | Oui | Oui | Exceptionnel — **statuts DEFAULTED/CANCELLED = V1 (A1)** |
| Modifier payment posted | X | — | — | Interdit (décidé U-08) ; refund / correctif |

---

## 4. Audit — événements obligatoires

Chaque événement : `actor`, `action`, `entityType`, `entityId`, `timestamp`, `before?`, `after?`, `reason?`, `requestId?`.

Obligatoire pour :

- login échec répété / changement mot de passe (phase auth)
- CRUD users / roles / permissions
- changements de prix
- remises (surtout > 0)
- completion / sync vente
- paiements et refunds
- ajustements stock
- réceptions
- retours (chaque transition)
- modifications paramètres sensibles
- échecs de synchronisation offline (visibilité opérationnelle)

**Ne pas** auditer en clair : mots de passe, secrets, tokens.

---

## 5. Notifications métier (canal technique plus tard)

| Événement | Destinataires typiques |
| --- | --- |
| Échéance proche / en retard | Manager, vendeur concerné |
| Stock bas | Manager, Inventory |
| Réception terminée | Inventory, Manager |
| Garantie bientôt expirée | Manager (V1) |
| Retour à traiter | Manager |
| Échec sync POS | Utilisateur + Manager |
