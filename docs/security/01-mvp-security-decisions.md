# Sécurité — décisions MVP (Prompt 014)

Document de synthèse après revue + correctifs. Les détails structurants sont aussi en ADR-0002, 0008, 0009.

## Authentification & session

| Contrôle | Décision |
| --- | --- |
| Session | Cookie `dp_session` httpOnly, SameSite=Lax, Secure en prod ; jeton aléatoire hashé SHA-256 en base |
| Mot de passe | bcrypt 12 rounds |
| Login | Rate-limit e-mail (5) + IP (30) / 15 min ; IP proxy seulement si `TRUSTED_PROXY=1` ; bucket IP **ignoré** si IP=`unknown` |
| Multi-sessions | **Révoquées au nouveau login** (une session active par compte) |
| Logout | Révoque le jeton + audit `auth.logout` avec `actorId` |
| CSRF | SameSite=Lax + contrôle Origin sur mutations quand l’en-tête est présent |

## Autorisation

- Toutes les routes métier API passent par `requirePermission` / `requirePagePermission`.
- Les restrictions prix / remises / refund / ajustement stock sont **serveur** (Zod + policies) — le front ne peut pas les contourner.
- Coût d’achat masqué sans `products.create|update` ou `purchases.read`.

## Intégrité & idempotence

| Flux | Clé |
| --- | --- |
| Vente / sync offline | `clientTxnId` + fingerprint **figé** dès la 1ʳᵉ tentative |
| Paiement / crédit / refund / exchange | `idempotencyKey` |
| Réception achat | `idempotencyKey` |
| Ajustement stock | `idempotencyKey` scopée `userId:key` + replay P2002 ; UI garde la clé jusqu’au succès |

## Audit

Actions sensibles journalisées : login/logout/échec, vente, remises, retours, remboursements, échanges, paiements crédit, ajustements stock (**dans la même TX**), changements de prix, impression reçu, **échec sync offline** (`sync.sale_failed`).

Création / mutation utilisateurs & rôles : API encore stub (501) — audits à brancher avant activation.

## XSS / CSRF / erreurs

- Reçus HTML : `escapeHtml` avant injection.
- Pas de mutation via GET.
- Réponses d’erreur sans stack trace client.

## Hors scope volontaire (prod ultérieure)

- Store rate-limit Redis (ADR-0008).
- Persistance PDF reçu sur disque / object storage.
- Gestion fine multi-appareils (sessions concurrentes volontairement refusées).
