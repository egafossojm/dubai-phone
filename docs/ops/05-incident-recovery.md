# 05 — Recovery incidents

## App down / 5xx

1. `GET /api/health` — process vivant ?
2. `GET /api/ready` — Postgres OK ?
3. Logs stdout JSON (`level=error`, `msg=unhandled_api_error` / `readiness_check_failed`).
4. Redémarrer le process si hang ; vérifier disque / OOM.
5. Si DB down : escalade hébergeur Postgres, ne pas lancer de migrate.

## Login impossible / rate-limit

- Rate-limit **en mémoire** (ADR-0008) : redémarrer le process réinitialise les compteurs.
- Vérifier `TRUSTED_PROXY` : sans proxy de confiance, l’IP partagée « unknown » n’est plus bucketée globalement (anti-lockout).
- Multi-instances : **non supporté** pour le rate-limit sans Redis — rester mono-processus.

## Sessions compromises

1. Désactiver l’utilisateur (`status=DISABLED`) ou changer le mot de passe.
2. `UPDATE sessions SET "revokedAt" = NOW() WHERE "userId" = '…'`.
3. Audit : `GET /api/audit` (permission `audit.read`).

## Sync POS bloquée / CONFLICT

1. Ouvrir `/sync` — classer FAILED vs CONFLICT.
2. Conflits métier (IMEI déjà vendu, stock) : résoudre en magasin, abandonner ou corriger le brouillon.
3. Ne pas « forcer » un double `clientTxnId`.

## Migration ratée

1. Ne pas redéployer en boucle.
2. Restore backup pré-migrate ([04-backup-restore.md](./04-backup-restore.md)).
3. Redeploy ancienne version d’app.
4. Analyser la migration en staging.

## Perte caisse offline

Si une caisse a perdu son disque avant flush : ventes locales perdues. Mitigation = flush fréquent + backup serveur à jour.
