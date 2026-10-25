#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v k3s >/dev/null || {
  echo 'Native K3s is missing. Run sudo ./scripts/install-k3s.sh' >&2
  exit 1
}

sudo k3s kubectl apply -k "$ROOT_DIR/infra/k8s/base"
sudo k3s kubectl -n ctf-demo rollout status deployment/demo-http --timeout=180s
sudo k3s kubectl -n ctf-demo rollout status deployment/demo-tcp --timeout=180s
sudo k3s kubectl -n ctf-demo get deployments,services,ingresses
