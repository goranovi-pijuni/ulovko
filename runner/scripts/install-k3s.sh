#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run with sudo: sudo ./scripts/install-k3s.sh' >&2
  exit 1
fi
command -v curl >/dev/null || {
  echo 'curl is required.' >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_SRC="$ROOT_DIR/infra/k3s/config.yaml"
CONFIG_DST='/etc/rancher/k3s/config.yaml'

if [[ -f "$CONFIG_DST" ]] && ! cmp -s "$CONFIG_SRC" "$CONFIG_DST"; then
  echo "Existing configuration differs: $CONFIG_DST" >&2
  echo 'Inspect it and plan a controlled change before proceeding.' >&2
  exit 1
fi

if command -v k3s >/dev/null 2>&1; then
  echo 'Native K3s is already installed; leaving it unchanged.'
  if [[ ! -f "$CONFIG_DST" ]]; then
    echo 'Warning: existing installation has no managed config.yaml; inspect it manually.' >&2
  fi
else
  install -D -m 0600 "$CONFIG_SRC" "$CONFIG_DST"
  echo 'Installing native single-node K3s using the checked-in config.'
  if [[ -n "${K3S_VERSION:-}" ]]; then
    curl -fsSL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -
  else
    curl -fsSL https://get.k3s.io | sh -
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet k3s || {
    echo 'K3s service is not active; inspect: sudo journalctl -u k3s -n 100' >&2
    exit 1
  }
fi

echo 'Waiting for the single-node cluster to be ready...'
k3s kubectl wait --for=condition=Ready nodes --all --timeout=180s
k3s kubectl get nodes -o wide
