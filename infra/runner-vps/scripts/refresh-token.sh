#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run as root (systemd manages this service).' >&2
  exit 1
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

CONFIG='/etc/ulovko/runner.kubeconfig'
install -d -m 0750 -o root -g ctf-runner /etc/ulovko

# Prevent a timer run and a deployment from replacing credentials together.
exec 9>/run/ctf-runner-token.lock
flock -x 9

tmp="$(mktemp /etc/ulovko/.runner.kubeconfig.XXXXXX)"
trap 'rm -f "$tmp"' EXIT
umask 077

CA="$(k3s kubectl config view --raw --minify \
  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')"
TOKEN="$(k3s kubectl -n runner-system create token runner-api --duration=6h)"

if [[ -z "$CA" || -z "$TOKEN" ]]; then
  echo 'Cannot obtain cluster CA or ServiceAccount token.' >&2
  exit 1
fi

# The API server may issue a shorter lifetime than requested.
printf '%s' "$TOKEN" | python3 -c '
import base64, json, sys, time
parts = sys.stdin.read().split(".")
if len(parts) != 3:
    raise SystemExit("Invalid ServiceAccount token")
body = parts[1] + "=" * (-len(parts[1]) % 4)
expiry = json.loads(base64.urlsafe_b64decode(body))["exp"]
if expiry < time.time() + 35 * 60:
    raise SystemExit("ServiceAccount token lifetime is too short for the timer")
'

cat > "$tmp" <<EOF_CONFIG
apiVersion: v1
kind: Config
clusters:
- name: k3s
  cluster:
    server: https://127.0.0.1:6443
    certificate-authority-data: $CA
users:
- name: runner-api
  user:
    token: $TOKEN
contexts:
- name: runner
  context:
    cluster: k3s
    user: runner-api
current-context: runner
EOF_CONFIG
unset CA TOKEN

# Test the restricted token, NOT K3s's administrator kubeconfig.
k3s kubectl --kubeconfig="$tmp" get nodes -o name >/dev/null

chown root:ctf-runner "$tmp"
chmod 0640 "$tmp"
mv -f "$tmp" "$CONFIG"

# The current Python client is configured once during FastAPI startup.
# The deployment script restarts the service itself after refreshing.
if [[ "${RUNNER_NO_RESTART:-0}" != 1 ]] && \
   systemctl is-active --quiet ctf-runner.service; then
  exec 8>/run/ctf-runner-deploy.lock
  if flock -n 8; then
    systemctl restart ctf-runner.service
  else
    echo 'Deployment in progress; deferring the runner restart.'
  fi
fi

echo 'Refreshed restricted Kubernetes credentials.'
