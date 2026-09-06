#!/bin/sh
set -eu

# Apply pending Prisma migrations before serving traffic (Docker / compose).
# Set RUN_MIGRATE_ON_START=0 to skip (e.g. migrate job already ran).
if [ "${RUN_MIGRATE_ON_START:-1}" = "1" ]; then
  echo "[entrypoint] prisma migrate deploy"
  node ./node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
