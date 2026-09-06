# 07 — Provisioning utilisateurs (MVP)

L’API `POST /api/users` et `PATCH /api/users/[id]` renvoient **501** (hors scope MVP).
Les comptes se créent via seed (dev/CI) ou SQL contrôlé en production.

## Interdits

- Ne pas lancer `prisma db seed` en production avec les e-mails `*@dubai-phone.local`.
- Ne pas définir `ALLOW_PROD_SEED=1` sauf bootstrap jetable (staging).

## Créer un utilisateur (SQL)

Prérequis : rôles déjà présents (`SUPER_ADMINISTRATOR`, `MANAGER`, `SALES_PERSON`, `INVENTORY_MANAGER`).

Sur EC2, ouvrir `psql` dans Compose :

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

1. Hasher le mot de passe (bcrypt cost 12), depuis une machine avec les deps (`npm ci`) :

```bash
node -e "require('bcryptjs').hash('MotDePasseFort!', 12).then(console.log)"
```

2. Insérer l’utilisateur et le rôle :

```sql
INSERT INTO users (id, email, "passwordHash", "fullName", status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'manager@magasin.cm',
  '<bcrypt-hash>',
  'Manager Magasin',
  'ACTIVE',
  NOW(),
  NOW()
);

INSERT INTO user_roles ("userId", "roleId")
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'manager@magasin.cm'
  AND r.code = 'MANAGER';
```

3. Vérifier login sur `/login`, puis `GET /api/ready`.

## Désactiver un compte

```sql
UPDATE users SET status = 'DISABLED', "updatedAt" = NOW()
WHERE email = 'manager@magasin.cm';

UPDATE sessions SET "revokedAt" = NOW()
WHERE "userId" = (SELECT id FROM users WHERE email = 'manager@magasin.cm')
  AND "revokedAt" IS NULL;
```

Voir aussi `docs/ops/05-incident-recovery.md`.
