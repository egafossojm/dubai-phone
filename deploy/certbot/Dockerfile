# Certbot uid 101 = Nginx, pour écrire des clés que Nginx (volume :ro) peut lire.
FROM certbot/certbot:v3.3.0

# Propriété initiale copiée dans le named volume au premier démarrage.
RUN mkdir -p /data/config /data/work /data/logs /var/www/certbot \
  && chown -R 101:101 /data /var/www/certbot

COPY --chmod=755 --chown=101:101 docker-entrypoint.sh /docker-entrypoint.sh
USER 101:101
ENV HOME=/data/work
VOLUME ["/data", "/var/www/certbot"]
ENTRYPOINT ["/docker-entrypoint.sh"]
