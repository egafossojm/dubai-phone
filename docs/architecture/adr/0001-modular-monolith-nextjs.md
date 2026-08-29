# ADR-0001 — Monolithe modulaire Next.js

- **Statut :** Accepté  
- **Date :** 2026-08-17  
- **Contexte :** Application interne pour un magasin unique au Cameroun.

## Décision

Construire un **monolithe modulaire** :

- UI + API dans **Next.js** ;
- domaines séparés dans `src/modules/*` ;
- **une** base PostgreSQL ;
- pas de microservices en MVP.

## Conséquences positives

- Un seul déploiement, ops simples ;
- transactions locales faciles entre ventes / stock / paiements ;
- productivité pour une petite équipe / agents IA.

## Conséquences négatives / risques

- Le dépôt grossit avec le temps ;
- discipline requise pour ne pas coupler les modules ;
- scale horizontal plus tard = découpage éventuel (pas maintenant).

## Alternatives rejetées

| Alternative | Pourquoi non (MVP) |
| --- | --- |
| Microservices | Complexité ops, transactions distribuées |
| Frontend SPA + API Nest séparée | Double repo/deploy sans gain immédiat |
| Backend-only + autre UI | Hors stack déjà choisie (prompt_000) |
