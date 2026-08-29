# 10 — Déploiement et observabilité

## 1. Déploiement MVP (simple)

| Élément | Choix recommandé |
| --- | --- |
| Application | 1 process Node (`next start`) derrière reverse proxy |
| Base | PostgreSQL managé ou VM dédiée |
| Fichiers (reçus PDF) | Disque local ou object storage simple plus tard |
| Environnements | `development`, `staging` (si possible), `production` |

**Hors MVP :** Kubernetes, multi-région, service mesh.

Variables : `.env.example` déjà amorcé (`DATABASE_URL`, `NEXT_PUBLIC_*`).  
À ajouter en phase auth : `AUTH_SECRET`, paramètres cookie, etc.

---

## 2. Pipeline de release (cible)

```text
lint → typecheck → unit tests → (integration) → build → migrate → deploy
```

Commandes déjà présentes dans le projet (rappel pour plus tard) :

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 24 via .nvmrc
npm run lint
npm run typecheck
npm test
npm run build
```

Ne pas exécuter ces commandes pour **cette** phase documentation.

---

## 3. Migrations en prod

1. Backup DB  
2. `prisma migrate deploy`  
3. Déployer l’app compatible  
4. Smoke test (`/api/health`, login)

---

## 4. Observabilité

| Signal | MVP |
| --- | --- |
| Health | `GET /api/health` (existe) |
| Logs app | stdout JSON / lignes structurées |
| Erreurs | log + corrélation `requestId` |
| Métriques | basiques plus tard (latence, 5xx) |
| APM complet | FUTURE |
| Audit métier | table `AuditLog` (pas un substitut de logs ops) |

Alertes utiles MVP : app down, DB down, taux d’échec sync POS élevé.

---

## 5. Backups

- Sauvegardes PostgreSQL planifiées (quotidien minimum).  
- Tester une restauration périodiquement.  
- Les données offline locales **ne remplacent pas** le backup serveur.
