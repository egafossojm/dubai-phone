# 10 — Périmètre MVP / V1 / FUTURE / OUT OF SCOPE

Objectif : MVP **livrable** et utilisable en magasin, pas un ERP exhaustif.

---

## MVP (indispensable)

| Domaine | Inclus |
| --- | --- |
| Auth / RBAC | Login, 4 rôles, permissions backend |
| Produits | CRUD, catégories, marques, variantes, SKU, sérialisé oui/non, actif/inactif |
| Stock | Mouvements, IMEI, ajustements motivés, alertes stock bas |
| Achats | Fournisseurs, PO, réception partielle/totale, coûts |
| Clients | Fiche + historique |
| POS | Recherche, panier, multi-paiements, remises plafonnées, reçu |
| Crédit | Compte + échéancier + paiements + statuts MVP (`PAID` / `PARTIALLY_PAID` / `ACTIVE`\|`PENDING` / `OVERDUE`) ; acompte min configurable > 0 |
| Retours | Demande → inspection → accept/reject → refund/échange (complément ou remboursement partiel) ; délai configurable (défaut 7 j) |
| Garanties | Création à la vente sérialisée, lookup IMEI, durée par produit/variant (défaut Settings) |
| Dashboard / rapports | Indicateurs listés dans `project-context` §15 (écrans) |
| Audit | Opérations sensibles |
| Offline POS | Ventes + file sync idempotente |
| Settings | Magasin, seuils remise, numérotation, stock bas |
| PWA | Base déjà en fondation technique |

---

## V1 (important, non bloquant lancement)

- Inventaire physique guidé (comptage) — U-15
- Réservation stock panier longue durée — U-09
- Export CSV des rapports
- Statuts crédit `DEFAULTED` et `CANCELLED` (+ workflow recouvrement) — A1
- Store credit (avoir) comme issue de retour — U-05
- Notifications push / SMS
- Scan code-barres matériel — A2
- Multi-rôles UI avancée / délégations (multi-rôles backend déjà MVP — U-01)
- Performance vendeur détaillée + objectifs
- Annulation contrôlée PO partiellement reçue — *hors décision U-07 MVP ; réévaluer en V1 si besoin métier*
---

## FUTURE

- Moteur promotions / coupons
- Intérêts / pénalités de retard
- Atelier réparation avancé
- Multi-magasins / transferts
- BI avancée
- Intégrations opérateurs Mobile Money (API) — MVP = saisie manuelle référence

---

## OUT OF SCOPE (maintenant)

Issu de `project-context.md` :

- Multi-tenant SaaS / multi-organisations
- Facturation d’abonnement
- Plateforme BI complexe
- Moteur promo avancé
- Multi-warehouses
- Transferts inter-magasins
- Analytics prédictives
- Paiements carte / Stripe / PayPal / Apple Pay / Google Pay

---

## Reporting — indicateurs essentiels (MVP)

### Ventes
CA, nb ventes, panier moyen, par période, par vendeur

### Stock
Valeur stock, stock bas, tops ventes, mouvements ; dormants = V1

### Finance
Paiements par méthode, remboursements, créances, retards, marge estimée

### Clients
Avec crédit, en retard ; « meilleurs clients » = V1

### Achats
Dépenses fournisseurs, achats période ; ranking fournisseurs = V1
