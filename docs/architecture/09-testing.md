# 09 — Stratégie de tests

Alignée sur `.cursor/rules/testing.md`.

## 1. Pyramide

| Niveau | Contenu | Outils |
| --- | --- | --- |
| Unit | Calculs, plafonds remise, soldes crédit, transitions statut, permissions | Vitest |
| Integration | Repositories, services + Prisma (DB test), transactions, API | Vitest + PostgreSQL test |
| E2E | Parcours critiques magasin | Playwright (à ajouter en phase features) |

Vitest est déjà configuré pour les tests unitaires/composants.

---

## 2. Priorités métier à tester

1. Finalisation vente atomique  
2. Vente sérialisée (IMEI)  
3. Remise autorisée / refusée  
4. Crédit + paiement échéance + OVERDUE  
5. Réception + unicité IMEI  
6. Retour / refund ≤ remboursable  
7. Sync offline idempotente + anti-doublon  
8. Ajustement stock + audit  

---

## 3. Invariants

- Stock ≈ somme mouvements (pour qty trackées)  
- Device non vendable deux fois  
- Solde crédit = total − paiements valides  
- Permissions : cas autorisé **et** refusé  

---

## 4. Données de test

- Fakes déterministes  
- Jamais de vrais clients / IMEI réels de production  

---

## 5. Definition of Done (rappel)

Feature = implémentation + validation + authz + tests + erreurs + loading/empty + doc si besoin.
