#!/bin/sh
# Entrypoint Certbot (uid 101, même que Nginx) pour lire/écrire le volume letsencrypt.
# HTTP-01 : fichiers dans /var/www/certbot, servis par Nginx sur le port 80 hôte.
# Sans CERTBOT_DOMAIN + CERTBOT_EMAIL : attente infinie (local, pas d’appel LE).
set -eu

DOMAIN="${CERTBOT_DOMAIN:-}"
EMAIL="${CERTBOT_EMAIL:-}"
# Chemins sur le volume `letsencrypt` (pas /etc/letsencrypt de l’image, rootfs read-only).
CONFIG_DIR=/data/config
WORK_DIR=/data/work
LOGS_DIR=/data/logs
WEBROOT=/var/www/certbot

mkdir -p "${CONFIG_DIR}" "${WORK_DIR}" "${LOGS_DIR}" "${WEBROOT}"
export HOME="${WORK_DIR}"

if [ -z "${DOMAIN}" ] || [ -z "${EMAIL}" ]; then
  echo "[certbot] CERTBOT_DOMAIN / CERTBOT_EMAIL unset — waiting (no issuance)."
  while true; do
    sleep 3600
  done
fi

# Staging Let’s Encrypt : tests sans brûler le quota de certificats de prod.
STAGING_ARGS=""
if [ "${CERTBOT_STAGING:-0}" = "1" ] || [ "${CERTBOT_STAGING:-}" = "true" ]; then
  STAGING_ARGS="--staging"
  echo "[certbot] Let's Encrypt staging enabled"
fi

certbot_base() {
  certbot "$@" \
    --config-dir "${CONFIG_DIR}" \
    --work-dir "${WORK_DIR}" \
    --logs-dir "${LOGS_DIR}" \
    --non-interactive
}

issue_or_renew() {
  live="${CONFIG_DIR}/live/${DOMAIN}/fullchain.pem"
  if [ ! -f "${live}" ]; then
    echo "[certbot] requesting certificate for ${DOMAIN}"
    # webroot : Nginx doit déjà servir /.well-known/acme-challenge/ (depends_on healthy).
    certbot_base certonly \
      --webroot -w "${WEBROOT}" \
      --agree-tos --no-eff-email \
      --email "${EMAIL}" \
      -d "${DOMAIN}" \
      ${STAGING_ARGS}
  else
    echo "[certbot] renewing if due"
    # --staging n’est pas repassé : il est déjà dans le fichier de renouvellement.
    certbot_base renew
  fi
}

# Recommandation Let’s Encrypt : tenter un renew 2×/jour (12 h). No-op si trop tôt.
while true; do
  if issue_or_renew; then
    echo "[certbot] ok"
  else
    echo "[certbot] failed (will retry after interval)" >&2
  fi
  sleep 43200
done
