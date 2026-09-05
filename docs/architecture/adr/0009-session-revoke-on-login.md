# ADR-0009 — Révocation des sessions au login + confiance proxy

- **Statut :** Accepté  
- **Date :** 2026-09-05  

## Contexte

Prompt 014 (audit sécurité) : un jeton `dp_session` volé restait valide après un nouveau login, et le rate-limit pouvait être contourné en tournant `X-Forwarded-For`.

## Décision

1. **Login = une session active** : `createUserSession` révoque toutes les sessions ouvertes de l’utilisateur avant d’en créer une nouvelle.
2. **IP client** : `X-Forwarded-For` / `X-Real-IP` ne sont lus que si `TRUSTED_PROXY=1` (ou `true`). Sinon l’IP vaut `unknown`.
3. **Rate-limit** : bucket **e-mail** (5 / 15 min) + bucket **IP** (30 / 15 min). L’e-mail est la protection primaire contre le spoof d’IP. Si l’IP vaut `unknown` (pas de `TRUSTED_PROXY`), le bucket IP n’est **pas** appliqué (évite un lockout nœud entier).

## Conséquences

- Un nouvel appareil / navigateur invalide les anciens cookies (volontaire pour magasin mono-utilisateur).
- Derrière nginx/Caddy : activer `TRUSTED_PROXY=1`.
- Toujours ADR-0008 pour le store mémoire → Redis en multi-instances.
