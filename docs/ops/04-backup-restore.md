# 04 — Backup et restauration PostgreSQL

Les données offline IndexedDB **ne remplacent pas** un backup serveur.

## Objectifs MVP

| Métrique | Cible indicative |
| --- | --- |
| RPO | ≤ 24 h (backup quotidien) ; viser ≤ 1 h si possible |
| RTO | ≤ 4 h (restore + migrate + smoke) |
| Rétention | ≥ 7 jours quotidiens + 1 mensuel |

## Backup logique (`pg_dump`)

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="dubai_phone_${stamp}.dump"
```

Planifier via cron / outil managé (RDS snapshots, etc.). Stocker hors de la machine app.

Vérifier périodiquement la taille et qu’un dump récent existe.

## Restauration

1. Stopper l’écriture app (maintenance / scale to 0) si possible.
2. Créer une base vide (ou instance staging) :

```bash
createdb dubai_phone_restore
pg_restore \
  --dbname=postgresql://USER:PASS@HOST:5432/dubai_phone_restore \
  --clean --if-exists \
  dubai_phone_YYYYMMDD.dump
```

3. Pointer `DATABASE_URL` vers la base restaurée (ou promouvoir l’instance).
4. `npx prisma migrate deploy` (no-op si déjà à jour).
5. Démarrer l’app, `GET /api/ready`, login, contrôle stocks / dernière vente.
6. Documenter l’heure du restore et l’éventuelle perte de données (RPO).

## Test de restore

Au minimum **une fois avant le go-live**, puis trimestriel : restore sur staging et smoke POS.

## Ce qui n’est pas sauvegardé

- Outbox IndexedDB des caisses (ventes non syncées) — former le personnel à flusher `/sync` avant fermeture.
- PDF générés à la demande (recalculables via `snapshotJson`).
