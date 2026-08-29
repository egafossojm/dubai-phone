# 02 — Acteurs et rôles

## 1. Distinction importante

| Concept | Signification |
| --- | --- |
| **Acteur** | Qui intervient dans le métier (personne ou organisation) |
| **Rôle applicatif** | Profil d’autorisation dans le système (RBAC) |
| **Entité métier** | Donnée gérée (Client, Fournisseur) sans login obligatoire |

---

## 2. Rôles applicatifs (MVP)

Alignés sur `project-context.md` :

| Code technique | Libellé UI | Description |
| --- | --- | --- |
| `SUPER_ADMINISTRATOR` | Super administrateur | Administration globale |
| `MANAGER` | Manager | Pilotage opérationnel et financier |
| `SALES_PERSON` | Vendeur / Caissier | Ventes et POS |
| `INVENTORY_MANAGER` | Responsable stock | Stock, réceptions, IMEI |

Un utilisateur a **au moins un rôle**.  
**Décidé (U-01) :** plusieurs rôles simultanés autorisés ; permissions = **union**.

---

## 3. Capacités par rôle

### 3.1 Super administrateur

- Utilisateurs, rôles, permissions
- Paramètres globaux du magasin
- Audit complet
- Accès à toutes les fonctions **selon matrice explicite** (voir `08`) — pas de « tout est permis » implicite sans documenter chaque opération critique

### 3.2 Manager

- Dashboard et rapports
- Supervision ventes / vendeurs
- Produits, stock, achats, fournisseurs, clients
- Remises dans les **seuils manager**
- Approbation d’opérations sensibles (remboursements, ajustements majeurs) selon règles
- Pas de modification des permissions système (**décidé U-11** : réservé Super Admin uniquement)

### 3.3 Vendeur / Caissier (`SALES_PERSON`)

- POS : recherche, panier, vente, paiements autorisés
- Création / sélection client
- Remises **≤ seuil vendeur** (configurable)
- Consultation historique **limité**
- Retours : **création de demande** seulement si permission ; validation / remboursement souvent Manager
- Interdit : admin users, ajustement stock libre, config financière sensible

### 3.4 Responsable stock (`INVENTORY_MANAGER`)

- Consultation stock et mouvements
- Réceptions d’achat + enregistrement IMEI / séries
- Ajustements **autorisés** (permission + motif + audit)
- Fournisseurs / achats selon permissions
- Modification fiche produit **sans** création catalogue ni prix / désactivation
- Interdit : créer produits / marques / catégories, remboursements, admin users, config financière sensible

---

## 4. Acteurs métier non connectés

### 4.1 Client (`Customer`)

Entité métier. Peut :

- être **anonyme / occasionnel** sur une vente cash (si autorisé) ;
- être **identifié** (téléphone, nom) ;
- avoir un **crédit actif**.

**Décidé (U-02) :** vente sans client identifié **autorisée** pour paiements immédiats complets ; **interdite** pour `INSTALLMENT` (client obligatoire).

### 4.2 Fournisseur (`Supplier`)

Entité métier (pas de login MVP).  
Utilisé pour commandes, réceptions, retours fournisseur.

---

## 5. Cas d’utilisation prioritaires (résumé)

| ID | Acteur | Cas d’utilisation |
| --- | --- | --- |
| UC-01 | Vendeur | Réaliser une vente POS (cash / Mobile Money) |
| UC-02 | Vendeur | Vente à crédit avec acompte + échéancier |
| UC-03 | Vendeur | Enregistrer un paiement d’échéance |
| UC-04 | Stock | Réceptionner une commande (partielle / totale) + IMEI |
| UC-05 | Stock | Ajuster le stock avec motif |
| UC-06 | Manager | Approuver un remboursement |
| UC-07 | Manager | Consulter dashboard / créances / stock bas |
| UC-08 | Tout autorisé | Rechercher garantie par IMEI |
| UC-09 | Vendeur (offline) | Vendre hors ligne puis synchroniser |
| UC-10 | Super Admin | Gérer utilisateurs et permissions |
