# 04 — Backup et restauration PostgreSQL

Les données offline IndexedDB **ne remplacent pas** un backup serveur.

Sur EC2, Postgres vit dans Compose (volume `dubai_phone_pg`). Un snapshot EBS **en plus** est utile, mais le runbook MVP est un **`pg_dump` quotidien hors machine** (S3).

## Objectifs MVP

| Métrique | Cible indicative |
| --- | --- |
| RPO | ≤ 24 h (backup quotidien) ; viser ≤ 1 h si possible |
| RTO | ≤ 4 h (restore + migrate + smoke) |
| Rétention | ≥ 7 jours quotidiens + 1 mensuel |

## Backup logique (`pg_dump`)

Depuis l’EC2, **sans** exposer 5432 :

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="dubai_phone_${stamp}.dump"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$file"
aws s3 cp "$file" "s3://<bucket-backups>/$file"
rm -f "$file"
```

Planifier en cron (quotidien minimum). Le dump ne doit **pas** rester uniquement sur le disque EC2 (perte instance = perte backup).

Vérifier périodiquement la taille de l’objet S3 et qu’un dump récent existe.

Le port `5432` Compose est bindé sur `127.0.0.1` pour un `pg_dump` hôte éventuel ; le security group AWS doit rester **fermé** sur 5432.

## Restauration

1. Mettre l’app en maintenance si possible (`docker compose stop app`) pour figer les écritures.
2. Restaurer dans une base vide (staging) ou remplacer la prod **après** backup de l’état courant :

```bash
docker compose exec -T db pg_restore \
  --dbname="$POSTGRES_DB" \
  --username="$POSTGRES_USER" \
  --clean --if-exists \
  < dubai_phone_YYYYMMDD.dump
```

Si `pg_restore` via stdin pose problème, copier le fichier dans le conteneur puis restaurer.

3. `docker compose start app` (l’entrypoint relance `migrate deploy`, no-op si déjà à jour).
4. Smoke : `GET /api/ready`, login, contrôle stocks / dernière vente.
5. Documenter l’heure du restore et l’éventuelle perte de données (RPO).

## Test de restore

Au minimum **une fois avant le go-live**, puis trimestriel : restore sur une instance/staging et smoke POS.

## Ce qui n’est pas sauvegardé

- Outbox IndexedDB des caisses (ventes non syncées) — former le personnel à flusher `/sync` avant fermeture.
- PDF générés à la demande (recalculables via `snapshotJson`).
- Certificats Let’s Encrypt (`/etc/letsencrypt`) — renouvelables ; pas des données métier.
