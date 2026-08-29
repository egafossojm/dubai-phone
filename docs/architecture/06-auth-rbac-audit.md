# 06 — Authentification, autorisation, RBAC, audit

## 1. Authentification (MVP)

| Décision | Choix |
| --- | --- |
| Mécanisme | Session serveur (cookie HTTP-only, Secure, SameSite) |
| Mot de passe | Hash fort (ex. Argon2id ou bcrypt) — jamais en clair |
| Stockage session | Table `Session` en PostgreSQL (révocable) |
| MFA | Hors MVP |
| OAuth / SSO | Hors MVP |

**Tradeoff :** Auth.js / Lucia / implémentation custom fine — voir **ADR-0002**.  
Recommandation : lib éprouvée (ex. Auth.js credentials + adapter Prisma, ou Lucia) plutôt que crypto maison.

Flux :

```text
Login → vérifier user ACTIVE → créer session → cookie
Request → lire session → charger user + rôles + permissions (union)
Logout → invalider session
```

---

## 2. Autorisation

Chaque opération protégée :

1. Utilisateur authentifié  
2. Permission explicite (ex. `sale.create`, `inventory.adjust`)  
3. Règles métier supplémentaires (plafond remise, etc.)

Le frontend peut cacher un bouton ; **le backend refuse** sinon.

---

## 3. RBAC

### Rôles MVP

- `SUPER_ADMINISTRATOR`
- `MANAGER`
- `SALES_PERSON`
- `INVENTORY_MANAGER`

### Multi-rôles (U-01)

Un user peut avoir **plusieurs** rôles.  
Permissions effectives = **union**.

### Qui édite les permissions (U-11)

**Super Admin uniquement.** Manager : consultation users au mieux, pas d’édition du catalogue de permissions.

### Modèle

```text
User ──< UserRole >── Role ──< RolePermission >── Permission
```

Permissions nommées de façon stable (`resource.action`), seedées en migration/seed.

---

## 4. Audit

Journal **append-only** `AuditLog` :

| Champ | Rôle |
| --- | --- |
| actorUserId | Qui |
| action | Quoi (code stable) |
| entityType / entityId | Cible |
| before / after | JSON optionnel |
| reason | Motif (ajustement, etc.) |
| requestId / idempotencyKey | Corrélation |
| createdAt | Quand |
| ip / userAgent | Contexte (si dispo) |

Événements obligatoires : voir `docs/business/08-permissions-and-sensitive-ops.md`.

Ne pas logger secrets.  
Pas d’update/delete métier des audits.

---

## 5. Rate limiting

MVP : limiter les **échecs** de login (par IP + e-mail), fenêtre 15 min / 5 échecs. Un succès **réinitialise** le compteur. L’implémentation actuelle est **en mémoire processus** (reset au redémarrage, pas partagée entre instances).

**Production :**

- backend Redis (ou équivalent) partagé ;
- IP client lue **uniquement** depuis le hop du reverse proxy de confiance — ne pas faire confiance à `X-Forwarded-For` brut sur Internet.

Autres limites (API métier) : selon besoin ops plus tard.
