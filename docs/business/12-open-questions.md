# 12 — Décisions métier tranchées

Ce document archive les contradictions résolues et les décisions autrefois **UNDECIDED**.  
**Statut :** toutes les décisions de la liste B sont **actées** (acceptation des recommandations).

Référence pour `prompt_002` / `prompt_003` : ne plus traiter ces points comme ouverts.

---

## A. Contradictions résolues

### A1 — Statuts de crédit

| Document | Statuts |
| --- | --- |
| `project-context.md` | PAID, PARTIALLY_PAID, PENDING, OVERDUE |
| `prompt_001` | ACTIVE, PARTIALLY_PAID, OVERDUE, PAID, DEFAULTED, CANCELLED |

**Décidé :**

- **MVP** : `PAID` / `PARTIALLY_PAID` / `ACTIVE` ou `PENDING` / `OVERDUE` (statut dérivé unique)
- **`DEFAULTED` et `CANCELLED`** : **V1** uniquement

---

### A2 — Codes-barres

| Document | Position |
| --- | --- |
| `project-context` | Pas de scan barcode requis MVP |
| `prompt_001` module Products | Mention codes-barres |

**Décidé :** champ barcode optionnel + saisie manuelle en MVP ; scan hardware = V1 (si besoin).

---

### A3 — Texte tronqué dans `prompt_001`

Sections 8.10/8.11 et 27 (Offline) étaient incomplètes dans le fichier prompt.

**Traitement :** complétées dans les docs business à partir de `project-context`, `business-rules` et UX rules.

---

## B. Décisions actées (ex-UNDECIDED)

| ID | Sujet | Décision |
| --- | --- | --- |
| U-01 | Multi-rôles par utilisateur | **Plusieurs** rôles autorisés ; permissions = **union** |
| U-02 | Vente sans client | **Autorisée** si paiement immédiat complet ; **interdite** pour INSTALLMENT |
| U-03 | Acompte crédit = 0 | **Non** ; acompte minimum **configurable** et **> 0** |
| U-04 | Remise ligne + globale | **Cumul** autorisé, avec **plafond** sur le total remisé |
| U-05 | Store credit (avoir) | **V1** |
| U-06 | Délai max retour | **Configurable**, défaut **7 jours** |
| U-07 | Cancel PO après réception partielle | **Non** ; clôturer le reste non reçu |
| U-08 | Void d’un payment posted | **Non** ; utiliser un **refund compensatoire** |
| U-09 | Réservation stock panier | **V1** ; MVP = décrément à la **finalisation** uniquement |
| U-10 | Intégration API OM/MTN | **Plus tard** ; MVP = référence manuelle |
| U-11 | Manager peut éditer permissions | **Non** (réservé Super Admin) |
| U-12 | Pénalités / intérêts retard | **Non** tant que non demandés explicitement |
| U-13 | Garantie durée par défaut | **Par produit/variant**, défaut via Settings |
| U-14 | Échange : même prix ? | **Complément** ou **remboursement partiel** autorisé |
| U-15 | Inventaire complet guidé | **V1** |

---

## C. Hypothèses acceptées pour la suite

1. Un magasin unique, un stock logique unique (MVP).  
2. Prix TTC, pas de TVA détaillée.  
3. Mobile Money = encaissement déclaré (référence saisie), pas de webhook opérateur en MVP.  
4. Offline limité au POS vente (+ lecture cache), pas aux achats/refunds.  
5. Langue UI française ; codes techniques anglais.

---

## D. Architecture (`prompt_002`)

**Statut :** documentation produite dans `docs/architecture/`.

Points couverts :

- Modular monolith boundaries
- Stratégie auth/session (ADR-0002)
- Stratégie offline storage (ADR-0003)
- Mapping entités → groupes de tables (détail Prisma au prompt_003)
- Stratégie d’idempotence API
- Politique de transactions DB

**Statut :** schéma Prisma + migration initiale produits dans `prisma/` et `docs/database/`.  
PostgreSQL n’était pas disponible localement au moment de la génération : `migrate deploy` et `db seed` restent à lancer (voir `docs/database/README.md`).
