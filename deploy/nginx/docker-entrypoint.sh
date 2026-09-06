#!/bin/sh
# Entrypoint Nginx (uid 101, pas de root).
# - Écoute 8080/8443 (Compose publie 80/443).
# - Tant qu’il n’y a pas de certificat Let’s Encrypt : HTTP proxifie l’app,
#   HTTPS sert un certificat auto-signé temporaire.
# - Dès que Certbot écrit fullchain/privkey : reload vers le template HTTPS
#   (redirect 8080 → 443, certificat réel).
set -eu

DOMAIN="${CERTBOT_DOMAIN:-localhost}"
export CERTBOT_DOMAIN="${DOMAIN}"

# Volume Compose `letsencrypt` monté en lecture seule sur /data.
LE_CERT="/data/config/live/${DOMAIN}/fullchain.pem"
LE_KEY="/data/config/live/${DOMAIN}/privkey.pem"
# Rootfs read-only : tout ce qui est écrit va dans le tmpfs /tmp.
DUMMY_DIR="/tmp/dummy-certs"
CONF_DIR="/tmp/nginx-conf"

mkdir -p "${DUMMY_DIR}" "${CONF_DIR}"

# Certificat jetable pour que `listen 8443 ssl` puisse démarrer avant le 1er LE.
if [ ! -f "${DUMMY_DIR}/fullchain.pem" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${DUMMY_DIR}/privkey.pem" \
    -out "${DUMMY_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}" >/tmp/openssl.log 2>&1
fi

# envsubst ne remplace que les variables listées (ne pas toucher à $host, $scheme…).
render_conf() {
  if [ -f "${LE_CERT}" ] && [ -f "${LE_KEY}" ]; then
    export SSL_CERT="${LE_CERT}"
    export SSL_KEY="${LE_KEY}"
    template="/etc/nginx/templates/https.conf.template"
  else
    export SSL_CERT="${DUMMY_DIR}/fullchain.pem"
    export SSL_KEY="${DUMMY_DIR}/privkey.pem"
    template="/etc/nginx/templates/http.conf.template"
  fi

  envsubst '${CERTBOT_DOMAIN} ${SSL_CERT} ${SSL_KEY}' \
    < "${template}" > "${CONF_DIR}/default.conf"
}

render_conf
nginx -t -c /etc/nginx/nginx.conf

# pid 1 = ce script (gestion SIGTERM Compose). Nginx tourne en arrière-plan.
nginx -c /etc/nginx/nginx.conf -g "daemon off;" &
nginx_pid=$!

reload_nginx() {
  render_conf
  if nginx -t -c /etc/nginx/nginx.conf; then
    nginx -s reload
  fi
}

shutdown() {
  nginx -s quit 2>/dev/null || true
  wait "${nginx_pid}" 2>/dev/null || true
  exit 0
}

trap shutdown TERM INT

# inotify sur le volume LE + timeout 1 h (poll de secours si inotify rate).
while kill -0 "${nginx_pid}" 2>/dev/null; do
  if [ -d /data/config ]; then
    inotifywait -q -t 3600 -r -e create,modify,move,delete /data/config 2>/dev/null || true
  else
    sleep 60
  fi
  if ! kill -0 "${nginx_pid}" 2>/dev/null; then
    break
  fi
  reload_nginx
done

wait "${nginx_pid}"
