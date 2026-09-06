# 05 — Recovery incidents

Contexte : EC2 + Compose + Nginx ([01-deployment.md](./01-deployment.md)).

## App down / 5xx / 502

1. `GET https://…/api/health` — process vivant (via Nginx) ?
2. `GET https://…/api/ready` — Postgres OK ?
3. Si **502** : Nginx n’atteint pas `app:3000` — `docker compose ps`, `docker compose logs app`, `curl -sS http://127.0.0.1/nginx-health`.
4. Logs app : `docker compose logs --tail=200 app` (JSON : `unhandled_api_error`, `readiness_check_failed`).
5. `docker compose restart app` si hang ; vérifier disque / OOM (`dmesg`, `free -h`).
6. Si DB down : `docker compose logs db` ; **ne pas** lancer de migrate. Volume `dubai_phone_pg` intact ?

## TLS / Certbot

- Certificat auto-signé qui persiste : `docker compose logs certbot` (DNS, port 80, e-mail/domaine).
- Renouvellement : automatique toutes les 12 h dans le conteneur `certbot` ; Nginx reload via inotify. Pas de `certbot` hôte.
- HTTP marche, HTTPS non : security group **443**, logs `nginx`.

## Login impossible / rate-limit

- Rate-limit **en mémoire** (ADR-0008) : `docker compose restart app` réinitialise les compteurs.
- Vérifier `TRUSTED_PROXY=1` et que Nginx **écrase** `X-Forwarded-For` avec `$remote_addr` ([08-nginx.md](./08-nginx.md)). Un `$proxy_add_x_forwarded_for` spoofe le bucket IP.
- Sans `TRUSTED_PROXY`, l’IP vaut `unknown` : le bucket IP n’est pas appliqué (anti-lockout).
- Multi-instances : **non supporté** pour le rate-limit sans Redis — une seule EC2 / un seul conteneur `app`.

## Sessions compromises

1. Désactiver l’utilisateur (`status=DISABLED`) ou changer le mot de passe ([07-user-provisioning.md](./07-user-provisioning.md)).
2. `UPDATE sessions SET "revokedAt" = NOW() WHERE "userId" = '…'`.
3. Audit : `GET /api/audit` (permission `audit.read`).

## Sync POS bloquée / CONFLICT

1. Ouvrir `/sync` — classer FAILED vs CONFLICT.
2. Conflits métier (IMEI déjà vendu, stock) : résoudre en magasin, abandonner ou corriger le brouillon.
3. Ne pas « forcer » un double `clientTxnId`.

## Migration ratée

1. Ne pas redéployer en boucle.
2. Restore backup pré-migrate ([04-backup-restore.md](./04-backup-restore.md)).
3. Redeploy ancienne image / commit (`docker compose up --build -d`).
4. Analyser la migration en staging.

## Perte caisse offline

Si une caisse a perdu son disque avant flush : ventes locales perdues. Mitigation = flush fréquent + backup serveur à jour.
