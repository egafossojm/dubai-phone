# ADR-0002 — Authentification par sessions serveur

- **Statut :** Accepté  
- **Date :** 2026-08-17  

## Décision

Utiliser des **sessions serveur** stockées en base (cookie HTTP-only) pour les utilisateurs internes.

Lib recommandée à l’implémentation : solution mature (Auth.js credentials + Prisma adapter, ou Lucia) — **pas** de JWT longue durée en localStorage.

## Conséquences positives

- Révocation immédiate (logout / disable user) ;
- meilleure posture XSS vs token dans localStorage ;
- modèle simple pour app 1ère partie.

## Conséquences négatives

- Sticky session moins critique (session en DB) mais chaque requête valide la session ;
- sync offline devra rattacher les ventes à un user authentifié au moment du sync (session encore valide ou re-login).

## Alternatives rejetées

| Alternative | Pourquoi non (MVP) |
| --- | --- |
| JWT access token only dans localStorage | XSS, révocation difficile |
| OAuth Google/etc. | Pas le besoin magasin interne |
| Sans auth | Inacceptable (données financières) |
