# ADR-0004 — Représentation monétaire FCFA

- **Statut :** Accepté  
- **Date :** 2026-08-17  

## Décision

- Devise unique MVP : **XAF / FCFA**.
- Stocker les montants en **entier** (unités FCFA) **ou** `DECIMAL(18,0)` / équivalent — **jamais** `float` / `double`.
- Affichage UI : formatage français (espaces, suffixe FCFA).
- Prix catalogue = **TTC** (pas de moteur TVA complexe).

Choix d’implémentation Prisma : **`BigInt` = FCFA entiers** (`prompt_003`, `src/lib/money.ts`).

## Conséquences positives

- Pas d’erreurs d’arrondi binaires ;
- comparaisons de soldes fiables ;
- cohérent avec règles database du projet.

## Conséquences négatives

- Discipline développeur (pas de `number` JS négligent pour l’argent — préférer calculs entiers).

## Alternatives rejetées

| Alternative | Pourquoi non |
| --- | --- |
| Float | Interdit par les règles projet |
| Multi-devises | Hors scope magasin Cameroun MVP |
