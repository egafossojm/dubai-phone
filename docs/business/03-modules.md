# 03 — Modules fonctionnels

Chaque module a **un objectif métier**. Les écrans Stitch (dossier `design/`) illustrent l’intention UX ; ce document fixe le périmètre fonctionnel.

---

## 8.1 Dashboard

**Objectif :** vue opérationnelle du jour / période.

Indicateurs MVP :

- CA du jour / du mois
- Nombre de ventes
- Panier moyen
- Marge brute estimée
- Top produits
- Stock bas
- Répartition des modes de paiement
- Créances clients / échéances
- Ventes récentes
- Performance vendeurs (si permission)

---

## 8.2 Catalogue / Produits

- Produits, catégories, marques
- Variantes (ex. capacité / couleur)
- SKU, prix de vente TTC, coût d’achat
- Flag sérialisé / non sérialisé
- Statut actif / inactif
- Caractéristiques libres (MVP : champs simples)

**Barcode :** mentionné dans le prompt produit ; `project-context` dit que le scan n’est **pas** requis en MVP.  
→ **Décidé (A2) :** champ barcode optionnel en saisie manuelle (MVP). **Scan matériel :** V1.

---

## 8.3 Inventory (Stock)

- Quantités disponibles (dérivées / cache cohérent avec mouvements)
- Appareils individuels (IMEI, IMEI2, série)
- Mouvements : réception, vente, retour client/fournisseur, ajustement, dommage, perte, réservation
- Inventaire physique / écarts (MVP : ajustement motivé ; inventaire complet guidé = V1)
- Historique

---

## 8.4 Fournisseurs & Achats

- Fournisseurs
- Commandes d’achat + lignes
- Réception (partielle / complète)
- Coûts d’achat
- Association IMEI à la réception pour produits sérialisés
- Historique

---

## 8.5 Clients

- Fiche client (identité, téléphone, contacts)
- Historique ventes / paiements / retours / garanties
- Soldes crédit / échéances

---

## 8.6 POS / Ventes

- Recherche (SKU, nom, IMEI, série)
- Panier multi-lignes
- Remises (ligne et/ou globale — voir règles)
- Client (optionnel sauf crédit)
- Paiements (un ou plusieurs)
- Finalisation atomique
- Reçu (impression / PDF)
- Historique ventes

---

## 8.7 Paiements

- Enregistrement des transactions de paiement
- Méthodes : CASH, ORANGE_MONEY, MTN_MOBILE_MONEY
- Lien vers vente ou vers échéance / compte crédit
- Remboursements (événements distincts)
- Historique

**INSTALLMENT** n’est pas un « tiroir-caisse » : il ouvre un **compte crédit**.

---

## 8.8 Crédit / Échéances

- Compte crédit lié à une vente
- Acompte initial, solde, plan d’échéances
- Statuts (voir `06`)
- Paiements d’échéances
- Retards (**décidé U-12** : pas de pénalités / intérêts tant que non demandés)

---

## 8.9 Retours

- Demande liée à une vente d’origine
- Inspection → acceptation / refus
- Issues : remboursement, échange ; avoir magasin (**décidé U-05** : V1)
- Effets stock / appareil / crédit / garantie

---

## 8.10 Garanties

- Association vente + client + produit/appareil + période
- Recherche par IMEI / série
- Statuts : ACTIVE → CLAIMED → INSPECTING → RESOLVED ; ou ACTIVE → EXPIRED
- Pas de réparation atelier complexe en MVP (suivi de dossier simple)

---

## 8.11 Rapports

- Ventes, stock, finance, clients, achats (détail dans section reporting de `10`)
- Export : **MVP** écrans + impression ; export CSV = V1

---

## 8.12 Users / RBAC / Audit

- Utilisateurs, rôles, permissions
- Sessions / authentification (détail technique en phase architecture)
- Journal d’audit des actions sensibles

---

## 8.13 Paramètres (Settings)

- Infos magasin
- Devise FCFA
- Taxes : **MVP = prix TTC, pas de moteur fiscal complexe** (`BR-PRODUCT-005`)
- Formats / numérotation documents
- Modèle de reçu
- Seuils de remise par rôle
- Paramètres stock bas
- Notifications (événements métier ; canal technique plus tard)

---

## 8.14 Synchronisation Offline (transversal)

Module transversal (pas seulement UI) :

- File d’attente locale des ventes POS
- Clés d’idempotence
- Statuts de synchro visibles (En ligne / Hors ligne / Sync / Échec)
