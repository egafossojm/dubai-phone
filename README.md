# Dubai Phone

Application professionnelle de gestion retail pour un magasin d'électronique au Cameroun.

## Objectif

Gérer le cycle opérationnel d'un magasin physique :

- produits et variantes
- stock / IMEI
- ventes et POS
- crédits clients
- achats et fournisseurs
- retours et garanties

Cette phase inclut la fondation technique, l'authentification, le catalogue,
le stock, les achats, les clients / crédits, le **POS online**, le **POS offline**,
les **retours / remboursements / garanties**, le **tableau de bord** (Prompt 012),
les **reçus / impressions / PDF** (Prompt 013), le **durcissement sécurité**
(Prompt 014), la **passe QA** (Prompt 015 — `docs/qa/01-complete-qa-pass.md`),
et la **préparation production** (Prompt 016 — `docs/ops/`, Docker, health/ready,
logs JSON, CI build).

Hors scope volontaire :
- résolution `STORE_CREDIT` — MVP = `REFUND` | `EXCHANGE` ;
- workflow réclamation garantie (`CLAIMED` → `RESOLVED`) ;
- coût d'achat historisé à la ligne de vente (marge = estimation au coût actuel) ;
- rapports détaillés exportables (stub `/api/reports`) ;
- persistance fichier `Receipt.pdfPath` (PDF/HTML générés à la demande ; instantané
  `snapshotJson` figé à la finalisation de vente) ;
- E2E Playwright / APM / multi-instances Redis.

Go-live MVP mono-processus : voir `docs/ops/06-go-live-checklist.md`
(PASS / WARNINGS / BLOCKERS).

## Stack

| Couche | Technologie |
| --- | --- |
| Framework | Next.js (App Router) |
| Langage | TypeScript |
| UI | Tailwind CSS + shadcn/ui (base) |
| Validation | Zod |
| Formulaires | React Hook Form |
| Base de données | PostgreSQL + Prisma |
| Qualité | ESLint + Prettier |
| Tests | Vitest + Testing Library |
| Offline / PWA | `@ducanh2912/next-pwa` |
| Prod MVP | EC2 + Docker Compose (app, Postgres, Nginx, Certbot) — `docs/ops/` |

## Prérequis

- Node.js 20.19+ (recommandé : Node 24 — voir `.nvmrc`)
- npm 10+
- PostgreSQL 14+ (pour les phases suivantes)

## Démarrage

```bash
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Ouvrir [http://localhost:3000/login](http://localhost:3000/login).

### Comptes de démo

Créés par `npx prisma db seed` (fichier `prisma/seed.ts`).  
Documentés aussi dans `docs/database/README.md`.

**Mot de passe :** défini dans `.env` (`SEED_USER_PASSWORD`).  
Ce fichier n’est **pas** versionné par git. `.env.example` indique seulement le nom de la variable, sans la valeur.

| E-mail | Rôle |
| --- | --- |
| `admin@dubai-phone.local` | Super administrateur |
| `manager@dubai-phone.local` | Manager |
| `caisse@dubai-phone.local` | Vendeur / Caissier |
| `stock@dubai-phone.local` | Responsable stock |

Ces comptes ne sont **pas** de vrais utilisateurs magasin. Ne pas les utiliser en production.

## Scripts

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (écriture) |
| `npm run format:check` | Prettier (vérification) |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:coverage` | Tests avec couverture |
| `npm run db:generate` | Génère le client Prisma |
| `npm run db:migrate` | Migrations en développement (`migrate dev`) |
| `npm run db:migrate:deploy` | Applique les migrations (prod / CI) |
| `npm run db:studio` | Ouvre Prisma Studio |

## Structure

```text
src/
  app/                 # Routes Next.js (App Router)
  components/
    layout/            # Shell applicatif
    shared/            # États loading / erreur / vide
    ui/                # Composants UI de base (shadcn-style)
  lib/
    api/               # Réponses API standardisées
    db/                # Client Prisma
    errors/            # Erreurs domaine
    env.ts             # Validation des variables d'environnement
    utils.ts           # Utilitaires (cn, etc.)
prisma/
  schema.prisma        # Schéma fondation (sans modèles métier)
```

## Variables d'environnement

Voir `.env.example` et `docs/ops/02-environment.md`.

`DATABASE_URL` est optionnelle au démarrage UI en développement, **obligatoire** si `NODE_ENV=production`.

Déploiement : deux EC2 (`dev` / `prod`) via GitHub Actions — `docs/ops/09-cd-github-actions.md`.  
Branches Git : **`prod`** (principale) et **`dev`** — `docs/ops/10-git-branches.md`.

## Langue

- Interface utilisateur : **français**
- Identifiants techniques : **anglais**
- Devise métier : **FCFA / XAF**

## Prochaine étape

MVP feature + ops documentés. Améliorations post-go-live possibles : E2E Playwright,
APM, Redis rate-limit, multi-instances. Ne pas enchaîner automatiquement.
