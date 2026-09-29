# 11 — Microservices Python (identity, catalog, reporting)

Voir [ADR-0010](../architecture/adr/0010-python-microservices.md).

## Processus Compose

| Service | Image | Port interne | API |
| --- | --- | --- | --- |
| `identity` | `services/Dockerfile` | 8000 | `/api/auth/*`, `/api/users` |
| `catalog` | idem | 8000 | `/api/products`, `/api/brands`, `/api/categories` |
| `reporting` | idem | 8000 | `/api/dashboard`, `/api/audit`, `/api/reports` |
| `app` | Next.js BFF | 3000 | UI + commerce + proxy |

Nginx ne parle qu’à `app:3000`. L’app proxifie si `IDENTITY_URL` / `CATALOG_URL` / `REPORTING_URL` sont définis.

## Local sans Compose Python

`npm run dev` : laisser les `*_URL` vides → handlers TypeScript in-process (Vitest aussi).

## Tests Python

```bash
source ~/.nvm/nvm.sh && nvm use
npx prisma migrate deploy
npx prisma db seed
cd services && python -m pip install -e ".[dev]" && python -m pytest
```

`DATABASE_URL` et `SEED_USER_PASSWORD` doivent être dans l’environnement.
