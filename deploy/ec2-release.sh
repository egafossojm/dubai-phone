#!/bin/sh
# Release sur l’EC2 (après `git reset --hard <sha>` par GitHub Actions).
# Ne touche pas à .env (gitignored). Ne pas lancer en root.
# Doc : docs/ops/09-cd-github-actions.md
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

KEEP_DUMPS="${KEEP_DUMPS:-7}"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT/backups}"

if [ ! -f .env ]; then
  echo "[release] fichier .env absent dans $ROOT — copier .env.example et renseigner les secrets." >&2
  exit 1
fi

# Charge POSTGRES_* pour pg_dump sans les réafficher.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "[release] $(date -u +%Y-%m-%dT%H:%M:%SZ) dir=$ROOT"

# Backup logique avant migrate (entrypoint app). Ignoré si Postgres n’est pas encore up (1er boot).
if docker compose ps -q db >/dev/null 2>&1 && [ -n "$(docker compose ps -q db 2>/dev/null || true)" ]; then
  mkdir -p "$BACKUPS_DIR"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  dump="$BACKUPS_DIR/pre-deploy_${stamp}.dump"
  echo "[release] pg_dump → $dump"
  docker compose exec -T db pg_dump \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-dubai_phone}" \
    --format=custom >"$dump"
  # Garde les N dumps les plus récents (le reste est à pousser vers S3, docs/ops/04).
  ls -1t "$BACKUPS_DIR"/pre-deploy_*.dump 2>/dev/null | tail -n "+$((KEEP_DUMPS + 1))" | xargs -r rm -f
else
  echo "[release] pas de conteneur db — skip backup"
fi

echo "[release] docker compose up --build"
docker compose up --build -d --remove-orphans

# Smoke via Nginx dans Compose (indépendant du port hôte 80).
echo "[release] attente /api/ready"
i=0
while [ "$i" -lt 60 ]; do
  if docker compose exec -T nginx wget -qO- http://127.0.0.1:8080/api/ready 2>/dev/null | grep -q 'migrated'; then
    echo "[release] OK"
    docker compose exec -T nginx wget -qO- http://127.0.0.1:8080/api/health || true
    echo
    docker compose exec -T nginx wget -qO- http://127.0.0.1:8080/nginx-health || true
    echo
    exit 0
  fi
  i=$((i + 1))
  sleep 5
done

echo "[release] timeout readiness" >&2
docker compose ps >&2 || true
docker compose logs --tail=80 app nginx >&2 || true
exit 1
