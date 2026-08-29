# ADR-0003 — Offline POS : IndexedDB + outbox

- **Statut :** Accepté  
- **Date :** 2026-08-17  

## Décision

Pour le POS hors ligne :

1. **IndexedDB** pour le cache métier (produits, clients, devices) et l’**outbox** des ventes ;
2. **Service Worker** uniquement pour assets / shell PWA ;
3. Sync via API idempotente (`clientTxnId`).

## Conséquences positives

- Séparation claire cache vs file de transactions ;
- rejouable après refresh navigateur ;
- aligné PWA déjà en place.

## Conséquences négatives

- Complexité front POS ;
- conflits possibles (IMEI vendu ailleurs) → UX d’échec obligatoire ;
- pas de sync multi-onglets triviale (à gérer avec lock simple / BroadcastChannel plus tard).

## Alternatives rejetées

| Alternative | Pourquoi non |
| --- | --- |
| localStorage pour les ventes | Trop petit, fragile, synchrone |
| SQLite WASM | Plus lourd, moins standard pour l’équipe |
| Offline « tout le back-office » | Hors décisions métier (C.4) |
