# ADR-0005 — Bon de réception (GR) comme facture fournisseur MVP

- **Statut :** Accepté  
- **Date :** 2026-08-22  

## Contexte

Le prompt 007 demande des « supplier invoices ». Le schéma Prisma n’a pas d’entité `Invoice` / `SupplierInvoice` dédiée. Les réceptions postées (`GoodsReceipt` status `POSTED`) portent déjà référence, fournisseur (via PO), lignes, coûts unitaires et IMEI.

## Décision

Pour le **MVP** :

- une **facture fournisseur** = un **bon de réception validé** (`GoodsReceipt` `POSTED`) ;
- l’UI `/achats/factures` et l’API `/api/purchases/invoices` exposent ces BR ;
- pas de modèle Invoice séparé tant que le magasin n’a pas besoin de factures AP découplées de la réception (avoirs, échéances fournisseur, multi-BR par facture).

## Conséquences positives

- Zéro duplication de montants / lignes ;
- traçabilité stock ↔ coût d’achat immédiate ;
- moins de surface à synchroniser / auditer.

## Conséquences négatives

- Une facture « papier » reçue sans réception stock n’a pas d’équivalent système ;
- un BR partiel = une « facture » partielle (plusieurs BR possibles pour une PO).

## Alternatives rejetées

| Alternative | Pourquoi non (MVP) |
| --- | --- |
| Modèle `SupplierInvoice` séparé | Sur-ingénierie avant besoin métier réel |
| Facture = PurchaseOrder | La PO n’est pas un document de coût reçu |

## Évolution V1

Introduire `SupplierInvoice` si besoin de lier plusieurs BR, paiements fournisseur, ou écart facture / réception.
