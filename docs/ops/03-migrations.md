# 03 — Migrations base de données

Toujours utiliser **`prisma migrate deploy`** en production.  
Ne pas utiliser `prisma db push` (perd les index partiels SQL — voir `docs/database/README.md`).

## Procédure

1. **Backup** (voir [04-backup-restore.md](./04-backup-restore.md)).
2. Vérifier que le commit déployé contient le dossier `prisma/migrations/`.
3. Depuis un host avec accès DB et le même code :

```bash
export DATABASE_URL=postgresql://...
npx prisma migrate deploy
```

Ou : `npm run db:migrate:deploy`.

4. Déployer / redémarrer l’application compatible.
5. Smoke : `GET /api/ready`, login, parcours critique.

## Rollback

Prisma ne « rollback » pas automatiquement une migration déjà appliquée.

Options :

- Restaurer le backup pris **avant** `migrate deploy`, puis redéployer l’ancienne version d’app.
- Ou écrire une migration corrective forward-only (préféré si la migration n’a pas détruit de données).

## CI

Le workflow CI exécute `prisma migrate deploy` + seed sur Postgres éphémère avant les tests.
