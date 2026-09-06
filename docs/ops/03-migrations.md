# 03 — Migrations base de données

Toujours utiliser **`prisma migrate deploy`** en production.  
Ne pas utiliser `prisma db push` (perd les index partiels SQL — voir `docs/database/README.md`).

Sur EC2 + Compose, l’entrypoint du conteneur `app` exécute `migrate deploy` au démarrage (`RUN_MIGRATE_ON_START=1`). Un `docker compose up --build -d` suffit **après** un backup.

## Procédure

1. **Backup** (voir [04-backup-restore.md](./04-backup-restore.md)).
2. Vérifier que le commit déployé contient le dossier `prisma/migrations/`.
3. Déployer :

```bash
docker compose up --build -d
docker compose logs -f app   # ligne `[entrypoint] prisma migrate deploy`
```

Pour migrer **sans** redémarrer l’app (rare) :

```bash
docker compose exec app node ./node_modules/prisma/build/index.js migrate deploy
```

Ou depuis un host avec `DATABASE_URL` (réseau Docker / tunnel SSH, pas 5432 public) :

```bash
export DATABASE_URL=postgresql://...
npx prisma migrate deploy
# équivalent : npm run db:migrate:deploy
```

4. Smoke : `GET /api/ready` (`schema: migrated`), login, parcours critique.

Mettre `RUN_MIGRATE_ON_START=0` seulement si un opérateur lance `migrate deploy` **avant** de démarrer `app`.

## Rollback

Prisma ne « rollback » pas automatiquement une migration déjà appliquée.

Options :

- Restaurer le backup pris **avant** `migrate deploy`, puis redéployer l’ancienne version d’app.
- Ou écrire une migration corrective forward-only (préféré si la migration n’a pas détruit de données).

## CI

Le workflow CI exécute `prisma migrate deploy` + seed sur Postgres éphémère avant les tests.
