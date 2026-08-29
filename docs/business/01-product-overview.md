# 01 — Vue produit et vision métier

## 1. Identité produit

**Dubai Phone** est une application **interne** de gestion d’un magasin de détail d’électronique, opérant principalement au **Cameroun**.

Ce n’est **pas** :

- une boutique e-commerce publique ;
- une marketplace ;
- un SaaS multi-entreprises (hors scope MVP).

Devise métier : **FCFA / XAF**.  
Langue interface : **français**.  
Identifiants techniques (code) : **anglais**.

---

## 2. Problèmes métier résolus

| Problème | Solution attendue |
| --- | --- |
| Stock opaque (« combien reste-t-il et pourquoi ? ») | Stock basé sur **mouvements traçables** |
| Téléphones non suivis individuellement | **Appareils sérialisés** (IMEI / n° de série) |
| Ventes mixtes cash + Mobile Money | **Paiements multiples** par vente |
| Crédit client sans suivi | **Compte crédit + échéancier** |
| Retours / garanties sans historique | Événements liés à la vente et à l’appareil |
| Risques de fraude / erreurs | **RBAC + audit** des opérations sensibles |
| Coupures réseau en caisse | **POS hors ligne** avec synchro idempotente |

---

## 3. Cycle de vie opérationnel

```text
ACHAT → RÉCEPTION → STOCK → VENTE → PAIEMENT → CLIENT
                                              ↓
                                    GARANTIE / RETOUR
                                              ↓
                                    REPORTING / AUDIT
```

---

## 4. Catalogue commercial couvert

Smartphones, téléphones, tablettes, ordinateurs, accessoires, chargeurs, câbles, écouteurs, casques, montres connectées, gadgets et équipements électroniques associés.

Deux natures de produit :

| Nature | Exemples | Gestion stock |
| --- | --- | --- |
| **Sérialisé** | Smartphones, certains PC / tablettes | Unité physique (IMEI / série) |
| **Non sérialisé** | Coques, câbles, chargeurs | Quantité |

---

## 5. Principes fondamentaux

### 5.1 Traçabilité

Toute opération importante doit pouvoir répondre à : **qui / quoi / quand / sur quelle entité / pourquoi**.

### 5.2 Intégrité financière

- Une vente **ne disparaît pas**.
- Corrections via **opérations compensatoires** ou audit explicite — jamais suppression silencieuse.

### 5.3 Intégrité du stock

- Le stock s’explique par la **somme des mouvements valides**.
- Mutation silencieuse interdite (`BR-INVENTORY-001`).

### 5.4 Séparation produit commercial / appareil physique

```text
PRODUCT (offre commerciale)
   └── SERIALIZED DEVICE (unité physique : IMEI, série)
```

### 5.5 Backend = source de vérité

Pour inventaire, argent, permissions, remises, remboursements et soldes clients, le **backend + PostgreSQL** font autorité. Le POS offline est un **cache / file d’attente** temporaire.

---

## 6. Méthodes de paiement (MVP)

| Code | Libellé UI | Nature |
| --- | --- | --- |
| `CASH` | Espèces | Paiement immédiat |
| `ORANGE_MONEY` | Orange Money | Paiement immédiat |
| `MTN_MOBILE_MONEY` | MTN Mobile Money | Paiement immédiat |
| `INSTALLMENT` | Paiement en plusieurs fois | **Mécanisme de crédit**, pas un canal physique |

**Hors scope MVP :** Stripe, PayPal, cartes bancaires, Apple Pay, Google Pay.

---

## 7. Utilisateurs cibles (humains)

Personnel interne du magasin :

- Super administrateur
- Manager
- Vendeur / caissier
- Responsable stock

Le **client** et le **fournisseur** sont des **entités métier**, pas forcément des comptes applicatifs.
