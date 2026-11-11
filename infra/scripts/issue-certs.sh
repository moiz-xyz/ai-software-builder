#!/bin/sh
# Issues Let's Encrypt certificates for customer custom domains that passed DNS
# verification, writes an nginx server block per domain, reloads nginx and reports
# SSL status back to the API. Run from cron (e.g. every 10 minutes) on the VPS.
#   API_URL=http://localhost:4100 INTERNAL_TOKEN=... ./issue-certs.sh
set -eu
API_URL=${API_URL:-http://localhost:4100}
CERT_DIR=${CERT_DIR:-./infra/nginx/certs}
mkdir -p "$CERT_DIR/custom"
for d in $(curl -fsS -H "x-internal-token: $INTERNAL_TOKEN" "$API_URL/internal/domains/pending-ssl" | grep -o '"hostname":"[^"]*"' | cut -d'"' -f4); do
  if certbot certonly --webroot -w /var/www/certbot -d "$d" --non-interactive --agree-tos -m "${ACME_EMAIL:-admin@$d}"; then
    cat > "$CERT_DIR/custom/$d.conf" <<CONF
server { listen 443 ssl; http2 on; server_name $d;
  ssl_certificate /etc/letsencrypt/live/$d/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/$d/privkey.pem;
  location / { proxy_pass http://web; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Host \$host; proxy_set_header X-Forwarded-Proto https; } }
CONF
    status=ACTIVE
  else
    status=FAILED
  fi
  curl -fsS -X POST -H "Content-Type: application/json" -H "x-internal-token: $INTERNAL_TOKEN" -d "{\"hostname\":\"$d\",\"status\":\"$status\"}" "$API_URL/internal/domains/ssl" >/dev/null
done
docker compose exec nginx nginx -s reload 2>/dev/null || true
