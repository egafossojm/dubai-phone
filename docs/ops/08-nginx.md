# 08 — Nginx + Let’s Encrypt (conteneurs)

Nginx et Certbot tournent **dans Compose**, uid **101**, sans privilèges root. L’EC2 n’installe pas Nginx.

```text
Caisse --HTTPS:443--> nginx:8443 --HTTP--> app:3000 --> db
              :80 --> nginx:8080 (ACME HTTP-01 + redirect une fois le certificat émis)
```

L’image Nginx écoute **8080 / 8443** (pas besoin de `CAP_NET_BIND_SERVICE`). Compose publie 80 et 443.

Conf versionnée : `deploy/nginx/`. Renouvellement : `deploy/certbot/` (boucle toutes les 12 h).

## Services Compose

| Service | Image | uid | Rôle |
| --- | --- | --- | --- |
| `nginx` | `deploy/nginx` (nginx-unprivileged) | 101 | TLS, proxy, challenge ACME |
| `certbot` | `deploy/certbot` | 101 | émission + `certbot renew` |
| `app` | `Dockerfile` | `nextjs` | Next.js — **pas** de port public |
| `db` | postgres:16-alpine | `postgres` | volume `dubai_phone_pg` |

Volumes : `letsencrypt` (`/data`), `acme-www` (webroot ACME). Nginx les monte **en lecture seule**.

`TRUSTED_PROXY=1` dès que le trafic passe par Nginx (défaut Compose).

## En-têtes (obligatoires)

| En-tête | Valeur | Pourquoi |
| --- | --- | --- |
| `Host` | `$host` | Next.js / cookies / PWA voient le domaine public |
| `X-Forwarded-Proto` | `$scheme` | HTTP vs HTTPS réel |
| `X-Forwarded-For` | `$remote_addr` | Rate-limit IP |
| `X-Real-IP` | `$remote_addr` | Fallback app |

L’app lit le **premier** hop de `X-Forwarded-For`. **Ne pas** utiliser `$proxy_add_x_forwarded_for`.

`proxy_pass http://app:3000` (nom de service Compose), **sans** slash final. Pas `127.0.0.1` : ce serait Nginx lui-même.

`NEXT_PUBLIC_APP_URL` = origine HTTPS exacte (`https://pos.exemple.cm`, sans slash).

## Let’s Encrypt (automatique)

1. DNS **A** `CERTBOT_DOMAIN` → Elastic IP ; security group **80** et **443** ouverts.
2. `.env` :

```bash
CERTBOT_DOMAIN=pos.exemple.cm
CERTBOT_EMAIL=ops@exemple.cm
NEXT_PUBLIC_APP_URL=https://pos.exemple.cm
TRUSTED_PROXY=1
```

3. `docker compose up --build -d`

Sans `CERTBOT_DOMAIN` + `CERTBOT_EMAIL`, le conteneur `certbot` **attend** (pas d’appel à l’API Let’s Encrypt) — adapté au local.

Comportement :

- Pas encore de certificat : HTTP reverse-proxifie vers l’app ; HTTPS sert un certificat **auto-signé** temporaire ; `/.well-known/acme-challenge/` est servi pour HTTP-01.
- Certbot obtient le certificat (webroot), l’écrit dans `letsencrypt`.
- Nginx détecte le fichier (inotify + poll horaire) et **reload** : HTTP redirige vers HTTPS, certificat réel, HSTS.

Renouvellement : **toutes les 12 heures**, `certbot renew` (Let’s Encrypt recommande 2×/jour). Un certificat est renouvelé à ~30 jours de l’expiration. Pas de cron hôte, pas de Certbot sur Ubuntu.

Premier essai : `CERTBOT_STAGING=1` pour le staging Let’s Encrypt (évite le rate-limit). Retirer ensuite et **supprimer le volume** `letsencrypt` pour redemander un certificat de production (`docker compose down` ne suffit pas : `docker volume rm`).

## Commandes

```bash
docker compose logs -f nginx certbot
docker compose exec nginx id          # uid=101
docker compose exec nginx wget -qO- http://127.0.0.1:8080/nginx-health
```

Reload manuel (rare) : `docker compose exec nginx nginx -s reload`.

## Interdits

| Tentation | Pourquoi |
| --- | --- |
| `$proxy_add_x_forwarded_for` | Spoof IP → rate-limit login (ADR-0009) |
| `proxy_cache` sur `/` ou `/api` | Stock / sessions / POS périmés |
| Publier `:3000` sur l’hôte | Contourne TLS et `TRUSTED_PROXY` |
| Nginx ou Certbot en `user: root` | Hors politique de ces images |
| `proxy_pass http://127.0.0.1:3000` | Mauvaise cible dans le réseau Compose |
| Plusieurs conteneurs `app` | Rate-limit mémoire (ADR-0008) |

## Débogage

| Symptôme | Cause fréquente |
| --- | --- |
| 502 | `app` pas prêt — `docker compose logs app` |
| 504 | App/DB lente (PDF, vente) |
| Login puis déconnecté | `NEXT_PUBLIC_APP_URL` encore en `http://` alors que le navigateur est en HTTPS |
| 403 Origin | Domaine ≠ `NEXT_PUBLIC_APP_URL` |
| Certbot échoue | Port 80 fermé, DNS pas prêt, `CERTBOT_STAGING` oublié au 1er test |
| HTTPS auto-signé qui reste | Certbot n’a pas émis — logs `certbot` ; volume `letsencrypt` |
| PWA non installable | Pas de certificat LE (navigateur refuse l’auto-signé) |

```bash
docker compose logs -f nginx
docker compose logs -f certbot
docker compose logs -f app
```
