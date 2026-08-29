# ADR-0006 — Appareil endommagé et `quantityOnHand`

- **Statut :** Accepté  
- **Date :** 2026-08-22  

## Contexte

À la réception, un IMEI peut arriver `NEW` ou `DAMAGED`. Le cache `product_variants.quantityOnHand` est la somme des `StockMovement` et sert de stock **vendable** (alertes, POS non sérialisé, affichage catalogue).

Un appareil `DAMAGED` n’est pas vendable (`assertDeviceSellable`).

## Décision

`quantityOnHand` = **stock vendable**, pas le stock physique total.

À la réception d’un appareil endommagé, dans la **même transaction** :

1. `PURCHASE_RECEIPT` `+1` (entrée physique, traçabilité IMEI / BR) ;
2. `DAMAGED` `-1` (sortie du stock vendable).

Le device reste `DAMAGED`. La somme des mouvements reste égale au cache.

## Conséquences

- Un téléphone reçu cassé n’apparaît pas comme disponible.
- L’historique montre quand même la réception (coût d’achat / facture BR).
- Un ajustement ultérieur peut remettre l’appareil en stock vendable si le magasin le décide.

## Alternatives rejetées

| Alternative | Pourquoi non |
| --- | --- |
| Compter le DAMAGED dans `quantityOnHand` | Faux stock vendable |
| Réception sans mouvement `+1` | Perte de traçabilité BR → stock |
| Cache « physique » séparé | Sur-ingénierie MVP |
