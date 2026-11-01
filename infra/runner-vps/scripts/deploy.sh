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

exec 9>/run/ctf-runner-deploy.lock
flock -x 9

for file in \
  "$ROOT/pyproject.toml" \
  "$ROOT/uv.lock" \
  "$ENV_SRC" \
  "$INFRA/k8s/base/namespace.yaml" \
  "$INFRA/k8s/runner-api/access.yaml" \
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
trap 'rm -f "$ENV_SRC"' EXIT

TOKEN="$(sed -n 's/^RUNNER_API_TOKEN=//p' "$ENV_SRC" | head -n 1)"
if [[ ! "$TOKEN" =~ ^[A-Za-z0-9_-]{32,}$ ]]; then
  echo 'Invalid RUNNER_API_TOKEN in runner environment.' >&2
  exit 1
fi
unset TOKEN

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
install -m 0755 -o root -g root "$INFRA/scripts/refresh-token.sh" \
  /usr/local/libexec/ulovko/refresh-token.sh
for name in ctf-runner.service ctf-runner-builds.service ctf-buildkit.service ctf-runner-token.service ctf-runner-token.timer; do
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
trap 'rm -f "$tmp_env" "$ENV_SRC"' EXIT
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

# Update the fixed root-owned helper only after a successful deployment.
next_helper="$(mktemp /usr/local/sbin/.ctf-runner-deploy.XXXXXX)"
install -m 0755 -o root -g root "$INFRA/scripts/deploy.sh" "$next_helper"
mv -f "$next_helper" /usr/local/sbin/ctf-runner-deploy

echo 'Runner deployed.'
