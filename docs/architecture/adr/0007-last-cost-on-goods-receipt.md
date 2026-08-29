# ADR-0007 — Coût catalogue mis à jour à la réception

- **Statut :** Accepté  
- **Date :** 2026-08-22  

## Contexte

À chaque réception, `product_variants.costPriceXaf` est aligné sur le `unitCostXaf` de la ligne reçue (« dernier coût d’achat »). Le responsable stock a `purchases.receive` mais **pas** le droit de modifier les prix de vente (`products.delete`).

## Décision

La mise à jour du **coût d’achat catalogue** à la réception est **autorisée** pour tout utilisateur qui réceptionne.

Ce n’est pas une modification de prix de vente. C’est une donnée d’approvisionnement liée au BR / facture fournisseur MVP (ADR-0005).

Le **prix de vente** reste réservé au manager / administrateur.

## Conséquences

- Le stock peut recevoir sans escalade manager pour le coût.
- Le coût affiché reflète le dernier achat reçu.
- Une politique « coût moyen pondéré » pourra remplacer ce modèle plus tard sans changer le RBAC prix de vente.

## Alternatives rejetées

| Alternative | Pourquoi non (MVP) |
| --- | --- |
| Exiger `products.delete` pour écrire le coût | Bloque les réceptions opérationnelles |
| Ne jamais toucher `costPriceXaf` | Coût catalogue stale vs facture BR |
