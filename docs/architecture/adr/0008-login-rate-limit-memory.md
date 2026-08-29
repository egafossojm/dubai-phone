# ADR-0008 — Rate-limit login en mémoire (MVP)

- **Statut :** Accepté (MVP)  
- **Date :** 2026-08-22  

## Contexte

Le login est limité (5 échecs / 15 min par couple IP + e-mail) via `src/lib/auth/rate-limit.ts`.

## Décision

Pour le **MVP mono-instance** : compteur **en mémoire processus**.

Documenté explicitement : redémarrage = reset ; plusieurs instances Next.js = buckets non partagés.

## Production

Avant multi-instances / haute dispo :

1. Remplacer le store par **Redis** (ou équivalent partagé) ;
2. Prendre l’IP client depuis le hop reverse-proxy de confiance ;
3. Ne jamais faire confiance à un `X-Forwarded-For` brut venant d’Internet.

## Conséquences

- Simple et suffisant en local / single node.
- Non fiable pour une flotte de replicas sans store partagé.
