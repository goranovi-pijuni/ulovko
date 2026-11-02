#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run through the provisioned deployment helper.' >&2
  exit 1
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

ROOT='/opt/ctf/runner'
INFRA="$ROOT/infra/runner-vps"
ENV_SRC="$ROOT/runner.env.next"
CADDY_ENV_SRC="$ROOT/caddy.env.next"

exec 9>/run/ctf-runner-deploy.lock
flock -x 9

for file in \
  "$ROOT/pyproject.toml" \
  "$ROOT/uv.lock" \
  "$ENV_SRC" \
  "$CADDY_ENV_SRC" \
  "$INFRA/Caddyfile" \
  "$INFRA/ctf-caddy.service" \
  "$INFRA/k3s/traefik-config.yaml" \
  "$INFRA/scripts/install-caddy.sh" \
  "$INFRA/k8s/base/namespace.yaml" \
  "$INFRA/k8s/runner-api/access.yaml" \
  "$INFRA/k8s/runner-api/deploy-access.yaml" \
  "$INFRA/scripts/import-image.sh" \
  "$INFRA/scripts/deploy.sh" \
  "$INFRA/ctf-runner.service" \
  "$INFRA/ctf-runner-builds.service" \
  "$INFRA/ctf-buildkit.service" \
  "$INFRA/buildkitd.toml" \
  "$INFRA/rootlesskit.apparmor" \
  "$INFRA/scripts/install-buildkit.sh" \
  "$INFRA/ctf-runner-token.service" \
  "$INFRA/ctf-runner-token.timer" \
  "$INFRA/scripts/refresh-token.sh"; do
  if [[ ! -f "$file" || -L "$file" ]]; then
    echo "Missing or invalid deployment file: $file" >&2
    exit 1
  fi
done

# Remove the uploaded secret even if dependency installation fails.
trap 'rm -f "$ENV_SRC" "$CADDY_ENV_SRC"' EXIT

TOKEN="$(sed -n 's/^RUNNER_API_TOKEN=//p' "$ENV_SRC" | head -n 1)"
if [[ ! "$TOKEN" =~ ^[A-Za-z0-9_-]{32,}$ ]]; then
  echo 'Invalid RUNNER_API_TOKEN in runner environment.' >&2
  exit 1
fi
unset TOKEN

CF_TOKEN="$(sed -n 's/^CLOUDFLARE_API_TOKEN=//p' "$CADDY_ENV_SRC" | head -n 1)"
if [[ ! "$CF_TOKEN" =~ ^[A-Za-z0-9_-]{20,}$ ]]; then
  echo 'Invalid Cloudflare token in caddy.env.next.' >&2
  exit 1
fi
if [[ ! -x /usr/local/bin/caddy-ulovko ]] ||
   ! /usr/local/bin/caddy-ulovko list-modules | grep -qx 'dns.providers.cloudflare'; then
  echo 'Caddy with Cloudflare module missing. Re-run infra/runner-vps/provision.sh on the VPS first.' >&2
  exit 1
fi

# A previously provisioned VPS may not yet have BuildKit.
# The same bootstrap is used on development and production hosts.
if ! systemctl is-active --quiet ctf-buildkit.service; then
  bash "$INFRA/scripts/install-buildkit.sh"
fi

# Install dependencies directly into /opt/ctf/runner/.venv.
runuser -u deploy -- env UV_PYTHON_INSTALL_DIR=/opt/ctf/python \
  /usr/local/bin/uv sync --project "$ROOT" --locked --no-dev --no-editable

# The daemon configuration is also version-controlled.
install -d -m 0755 -o root -g root /etc/buildkit
config_changed=0
if ! cmp -s "$INFRA/buildkitd.toml" /etc/buildkit/ulovko-rootless.toml; then
  config_changed=1
fi
install -m 0644 -o root -g root "$INFRA/buildkitd.toml" \
  /etc/buildkit/ulovko-rootless.toml

# Apply BuildKit unit changes only when its configuration changed.
builder_changed=0
if ! cmp -s "$INFRA/ctf-buildkit.service" /etc/systemd/system/ctf-buildkit.service; then
  builder_changed=1
fi

# Updating RBAC is independent of restarting K3s itself.
k3s kubectl apply -f "$INFRA/k8s/base/namespace.yaml"
k3s kubectl apply -f "$INFRA/k8s/runner-api/access.yaml"
k3s kubectl apply -f "$INFRA/k8s/runner-api/deploy-access.yaml"
install -m 0755 -o root -g root "$INFRA/scripts/import-image.sh" \
  /usr/local/libexec/ulovko/import-image.sh
printf '%s\n' \
  'ctf-runner ALL=(root) NOPASSWD: /usr/local/libexec/ulovko/import-image.sh *' \
  > /etc/sudoers.d/ctf-runner-image-import
chmod 0440 /etc/sudoers.d/ctf-runner-image-import
visudo -cf /etc/sudoers.d/ctf-runner-image-import
install -m 0755 -o root -g root "$INFRA/scripts/refresh-token.sh" \
  /usr/local/libexec/ulovko/refresh-token.sh
for name in ctf-runner.service ctf-runner-builds.service ctf-buildkit.service ctf-runner-token.service ctf-runner-token.timer ctf-caddy.service; do
  install -m 0644 -o root -g root "$INFRA/$name" "/etc/systemd/system/$name"
done
systemctl daemon-reload
systemctl enable --now ctf-buildkit.service
if (( builder_changed || config_changed )); then
  systemctl restart ctf-buildkit.service
fi
runuser -u ctf-runner -- buildctl \
  --addr unix:///run/ulovko-buildkit/buildkitd.sock debug workers \
  >/dev/null
systemctl enable --now ctf-runner-token.timer

# Store the runner's complete environment outside the application directory.
tmp_env="$(mktemp /etc/ulovko/.runner.env.XXXXXX)"
trap 'rm -f "$tmp_env" "$ENV_SRC" "$CADDY_ENV_SRC"' EXIT
install -m 0640 -o root -g ctf-runner "$ENV_SRC" "$tmp_env"
mv -f "$tmp_env" /etc/ulovko/runner.env
rm -f "$ENV_SRC"

# The deployment restart below loads the refreshed kubeconfig.
RUNNER_NO_RESTART=1 /usr/local/libexec/ulovko/refresh-token.sh

systemctl enable ctf-runner.service
systemctl restart ctf-runner.service
systemctl is-active --quiet ctf-runner.service
systemctl enable --now ctf-runner-builds.service
systemctl restart ctf-runner-builds.service
systemctl is-active --quiet ctf-runner-builds.service

HOST="$(sed -n 's/^RUNNER_BIND_HOST=//p' /etc/ulovko/runner.env | head -n 1)"
TOKEN="$(sed -n 's/^RUNNER_API_TOKEN=//p' /etc/ulovko/runner.env | head -n 1)"
[[ -n "$HOST" && -n "$TOKEN" ]] || {
  echo 'Missing runner bind host or API token.' >&2
  exit 1
}
if [[ "$HOST" == '0.0.0.0' ]]; then
  HOST='127.0.0.1'
elif [[ "$HOST" == *:* ]]; then
  HOST="[$HOST]"
fi

curl --silent --show-error --fail \
  --retry 10 --retry-delay 2 --retry-connrefused \
  --output /dev/null "http://$HOST:8000/health"
printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" | \
  curl --config - --silent --show-error --fail \
    --retry 10 --retry-delay 2 --retry-connrefused \
    --output /dev/null "http://$HOST:8000/nodes"
unset TOKEN

# Prepare Caddy while Traefik is still serving the old public endpoints.
# The Traefik ClusterIP is already allocated even while it is a LoadBalancer.
TRAEFIK_IP="$(k3s kubectl -n kube-system get service traefik \
  -o jsonpath='{.spec.clusterIP}')"
if [[ ! "$TRAEFIK_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Traefik does not have an IPv4 ClusterIP.' >&2
  exit 1
fi
TRAEFIK_UPSTREAM="$TRAEFIK_IP:80"

install -d -m 0755 -o root -g root /etc/caddy
install -m 0644 -o root -g root "$INFRA/Caddyfile" /etc/caddy/ulovko.Caddyfile
tmp_caddy_env="$(mktemp /etc/ulovko/.caddy.env.XXXXXX)"
trap 'rm -f "$tmp_caddy_env" "$ENV_SRC" "$CADDY_ENV_SRC"' EXIT
{
  printf 'CLOUDFLARE_API_TOKEN=%s\n' "$CF_TOKEN"
  printf 'TRAEFIK_UPSTREAM=%s\n' "$TRAEFIK_UPSTREAM"
} > "$tmp_caddy_env"
chown root:root "$tmp_caddy_env"
chmod 0600 "$tmp_caddy_env"

# Initial validation also needs a writable state directory for the caddy user.
install -d -m 0750 -o ctf-caddy -g ctf-caddy \
  /var/lib/ctf-caddy /var/lib/ctf-caddy/data /var/lib/ctf-caddy/config

# Validate before touching Traefik or restarting Caddy.
runuser -u ctf-caddy -- env \
  HOME=/var/lib/ctf-caddy \
  XDG_DATA_HOME=/var/lib/ctf-caddy/data \
  XDG_CONFIG_HOME=/var/lib/ctf-caddy/config \
  CLOUDFLARE_API_TOKEN="$CF_TOKEN" \
  TRAEFIK_UPSTREAM="$TRAEFIK_UPSTREAM" \
  /usr/local/bin/caddy-ulovko validate \
    --config /etc/caddy/ulovko.Caddyfile --adapter caddyfile
unset CF_TOKEN
mv -f "$tmp_caddy_env" /etc/ulovko/caddy.env
rm -f "$CADDY_ENV_SRC"

# K3s reconciles this HelmChartConfig and removes Traefik's public ServiceLB.
# Caddy can then own :80 and :443 on the host.
TRAEFIK_MANIFESTS='/var/lib/rancher/k3s/server/manifests'
install -m 0644 -o root -g root "$INFRA/k3s/traefik-config.yaml" \
  "$TRAEFIK_MANIFESTS/k3s-traefik-config.yaml"
for _ in $(seq 1 60); do
  TRAEFIK_TYPE="$(k3s kubectl -n kube-system get service traefik \
    -o jsonpath='{.spec.type}')"
  [[ "$TRAEFIK_TYPE" == 'ClusterIP' ]] && break
  sleep 2
done
if [[ "$TRAEFIK_TYPE" != 'ClusterIP' ]]; then
  echo 'Traefik did not change to ClusterIP. Check K3s Helm controller logs.' >&2
  exit 1
fi

systemctl enable ctf-caddy.service
systemctl restart ctf-caddy.service
systemctl is-active --quiet ctf-caddy.service

# Validate local HTTPS to FastAPI with the real hostname and certificate.
# DNS-01 issuance can take some time on a first install.
if ! curl --silent --show-error --fail \
    --connect-timeout 5 --max-time 10 \
    --retry 20 --retry-delay 5 --retry-all-errors \
    --resolve chal.ulovko.fun:443:127.0.0.1 \
    --output /dev/null https://chal.ulovko.fun/health; then
  journalctl -u ctf-caddy.service -n 60 --no-pager >&2
  echo 'Caddy HTTPS check failed. Verify DNS, Cloudflare token, and ACME logs.' >&2
  exit 1
fi

# Update the fixed root-owned helper only after a successful deployment.
next_helper="$(mktemp /usr/local/sbin/.ctf-runner-deploy.XXXXXX)"
install -m 0755 -o root -g root "$INFRA/scripts/deploy.sh" "$next_helper"
mv -f "$next_helper" /usr/local/sbin/ctf-runner-deploy

echo 'Runner deployed.'
