# Nginx unprivileged (uid 101). Bind 8080/8443 — pas besoin de CAP_NET_BIND_SERVICE.
# Compose mappe 80:8080 et 443:8443.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Build seulement : apk / chown. Le runtime rebascule USER nginx.
USER root
RUN apk add --no-cache openssl inotify-tools wget \
  && mkdir -p /tmp/nginx-conf /var/www/certbot /data/config /data/work /data/logs \
  && chown -R nginx:nginx /tmp/nginx-conf /var/www/certbot /data

USER nginx
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx proxy_params /etc/nginx/proxy_params
COPY --chown=nginx:nginx templates /etc/nginx/templates
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

# 1er montage d’un volume vide : Docker copie ces dossiers (uid 101) dans le volume.
VOLUME ["/data", "/var/www/certbot"]

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/nginx-health >/dev/null || exit 1

EXPOSE 8080 8443
ENTRYPOINT ["/docker-entrypoint.sh"]
