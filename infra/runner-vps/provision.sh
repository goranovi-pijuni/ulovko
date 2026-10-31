#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run with sudo: sudo bash infra/runner-vps/provision.sh --deploy-key /path/to/key.pub' >&2
  exit 1
fi

DEPLOY_KEY=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy-key)
      if [[ $# -lt 2 ]]; then
        echo 'Missing path after --deploy-key.' >&2
        exit 1
      fi
      DEPLOY_KEY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done
command -v curl >/dev/null || {
  echo 'curl is required.' >&2
  exit 1
}
command -v systemctl >/dev/null || {
  echo 'systemd is required.' >&2
  exit 1
}

# Install the few tools required by the service and deployment scripts.
missing=()
for tool in rsync python3 visudo flock; do
  command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if (( ${#missing[@]} > 0 )); then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y rsync python3 sudo util-linux
  elif command -v pacman >/dev/null 2>&1; then
    pacman -S --needed --noconfirm rsync python sudo util-linux
  else
    echo "Install required tools: ${missing[*]}" >&2
    exit 1
  fi
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_SRC="$ROOT_DIR/k3s/config.yaml"
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

systemctl is-active --quiet k3s || {
  echo 'K3s service is not active; inspect: sudo journalctl -u k3s -n 100' >&2
  exit 1
}

echo 'Waiting for the single-node cluster to be ready...'
k3s kubectl wait --for=condition=Ready nodes --all --timeout=180s
k3s kubectl get nodes -o wide

# The challenge namespace must exist before its namespace-scoped Role.
k3s kubectl apply -f "$ROOT_DIR/k8s/base/namespace.yaml"
k3s kubectl apply -f "$ROOT_DIR/k8s/runner-api/access.yaml"

if ! id -u ctf-runner >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/ctf-runner \
    --shell "$(command -v nologin)" ctf-runner
fi
if ! id -u deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi

# Install the public key supplied during the one-time provisioning step.
# Re-running without --deploy-key preserves the existing SSH configuration.
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
if [[ -n "$DEPLOY_KEY" ]]; then
  if [[ ! -s "$DEPLOY_KEY" ]] ||
     ! grep -Eq '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) ' "$DEPLOY_KEY"; then
    echo "Missing or invalid SSH public key: $DEPLOY_KEY" >&2
    exit 1
  fi
  install -m 0600 -o deploy -g deploy \
    "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys
elif [[ ! -s /home/deploy/.ssh/authorized_keys ]]; then
  echo 'No deploy SSH key configured; pass --deploy-key /path/to/key.pub.' >&2
  exit 1
fi

install -d -m 0755 -o deploy -g deploy \
  /opt/ctf/runner /opt/ctf/runner/infra \
  /opt/ctf/runner/infra/runner-vps
install -d -m 0755 -o deploy -g deploy /opt/ctf/python
install -d -m 0750 -o root -g ctf-runner /etc/ulovko
install -d -m 0755 -o root -g root /usr/local/libexec/ulovko

if [[ ! -x /usr/local/bin/uv ]]; then
  UV_VERSION="${UV_VERSION:-0.13.6}"
  echo "Installing uv $UV_VERSION."
  curl -fsSL "https://astral.sh/uv/$UV_VERSION/install.sh" |
    env UV_UNMANAGED_INSTALL=/usr/local/bin sh
fi
/usr/local/bin/uv --version

install -m 0755 -o root -g root \
  "$ROOT_DIR/scripts/deploy.sh" /usr/local/sbin/ctf-runner-deploy
install -m 0755 -o root -g root \
  "$ROOT_DIR/scripts/refresh-token.sh" /usr/local/libexec/ulovko/refresh-token.sh
install -m 0644 -o root -g root \
  "$ROOT_DIR/ctf-runner.service" /etc/systemd/system/ctf-runner.service
install -m 0644 -o root -g root \
  "$ROOT_DIR/ctf-runner-token.service" /etc/systemd/system/ctf-runner-token.service
install -m 0644 -o root -g root \
  "$ROOT_DIR/ctf-runner-token.timer" /etc/systemd/system/ctf-runner-token.timer

# Restrict CI's sudo access to the fixed, root-owned deployment entrypoint.
printf '%s\n' \
  'deploy ALL=(root) NOPASSWD: /usr/local/sbin/ctf-runner-deploy' \
  > /etc/sudoers.d/ctf-runner-deploy
chmod 0440 /etc/sudoers.d/ctf-runner-deploy
visudo -cf /etc/sudoers.d/ctf-runner-deploy

systemctl daemon-reload
systemctl enable --now ctf-runner-token.timer

# Bootstrap credentials without starting FastAPI before its first release.
RUNNER_NO_RESTART=1 /usr/local/libexec/ulovko/refresh-token.sh

# Revoke the old static credential if one was created during development.
k3s kubectl -n runner-system delete secret runner-api-token --ignore-not-found

echo 'Runner VPS provisioned. Trigger Runner CD in GitHub Actions for the first release.'
