#!/usr/bin/env bash
set -Eeuo pipefail

# Provision the Ulovko application VPS (Debian/Ubuntu, systemd).

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
APP_DIR="/opt/ctf/backend"
SERVICE_NAME="ctf-backend.service"
DEPLOY_KEY_FILE=""

usage() {
  cat <<'USAGE'
Usage: sudo bash infra/app-vps/provision.sh [--deploy-key /path/to/actions.pub]

  --deploy-key FILE   Add this SSH public key to deploy's authorized_keys.
                      Optional if the key is already configured.
USAGE
}

while (($#)); do
  case "$1" in
  --deploy-key)
    if (($# < 2)); then
      echo "Missing file after --deploy-key" >&2
      exit 2
    fi
    DEPLOY_KEY_FILE="$2"
    shift 2
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown argument: $1" >&2
    usage >&2
    exit 2
    ;;
  esac
done

if ((EUID != 0)); then
  echo "Run this script as root." >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Cannot detect Linux distribution." >&2
  exit 1
fi
# shellcheck disable=SC1091
source /etc/os-release
case "${ID:-}" in
ubuntu | debian) ;;
*)
  echo "Only Ubuntu and Debian VPSes are currently supported; found: ${ID:-unknown}." >&2
  exit 1
  ;;
esac

if [[ -n "$DEPLOY_KEY_FILE" && ! -f "$DEPLOY_KEY_FILE" ]]; then
  echo "Deploy public key not found: $DEPLOY_KEY_FILE" >&2
  exit 1
fi

log() { printf '\n==> %s\n' "$*"; }
export DEBIAN_FRONTEND=noninteractive

log "Installing base packages"
apt-get update
apt-get install -y \
  apt-transport-https ca-certificates curl gnupg \
  git rsync sudo openssh-server \
  debian-keyring debian-archive-keyring
systemctl enable --now ssh.service

log "Configuring the NodeSource Node.js 22 repository"
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
  gpg --batch --yes --dearmor -o /usr/share/keyrings/nodesource.gpg
chmod 0644 /usr/share/keyrings/nodesource.gpg
cat >/etc/apt/sources.list.d/nodesource.sources <<'SOURCE'
Types: deb
URIs: https://deb.nodesource.com/node_22.x
Suites: nodistro
Components: main
Signed-By: /usr/share/keyrings/nodesource.gpg
SOURCE
cat >/etc/apt/preferences.d/ulovko-nodejs <<'PREF'
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
PREF

log "Configuring the official Caddy repository"
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
  gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  -o /etc/apt/sources.list.d/caddy-stable.list

apt-get update
apt-get install -y nodejs caddy

if [[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" != "22" ]]; then
  echo "Expected Node.js 22 at /usr/bin/node; found: $(/usr/bin/node --version)" >&2
  exit 1
fi

log "Creating application and deployment users"
if ! id -u ctfapi >/dev/null 2>&1; then
  useradd --system --user-group \
    --home-dir /nonexistent --shell /usr/sbin/nologin ctfapi
fi
if ! id -u deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --user-group deploy
fi

install -d -m 0755 -o root -g root /opt/ctf
install -d -m 0755 -o deploy -g deploy "$APP_DIR"
chown -R deploy:deploy "$APP_DIR"

log "Installing restricted systemd permissions for GitHub Actions"
cat >/etc/sudoers.d/ctf-deploy <<'SUDOERS'
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart ctf-backend.service, /usr/bin/systemctl is-active ctf-backend.service
SUDOERS
chmod 0440 /etc/sudoers.d/ctf-deploy
visudo -cf /etc/sudoers.d/ctf-deploy

log "Preparing deploy SSH access"
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
if [[ -n "$DEPLOY_KEY_FILE" ]]; then
  public_key="$(head -n 1 "$DEPLOY_KEY_FILE")"
  if [[ ! "$public_key" =~ ^ssh-ed25519[[:space:]]+[A-Za-z0-9+/=]+([[:space:]].*)?$ ]]; then
    echo "Expected an ssh-ed25519 public key in $DEPLOY_KEY_FILE" >&2
    exit 1
  fi
  touch /home/deploy/.ssh/authorized_keys
  if ! grep -Fqx -- "$public_key" /home/deploy/.ssh/authorized_keys; then
    printf '%s\n' "$public_key" >>/home/deploy/.ssh/authorized_keys
  fi
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 0600 /home/deploy/.ssh/authorized_keys
else
  echo "No --deploy-key given: provide a deploy public key before using GitHub Actions."
fi

log "Installing and enabling the NestJS systemd service"
install -m 0644 -o root -g root \
  "$SCRIPT_DIR/ctf-backend.service" "/etc/systemd/system/$SERVICE_NAME"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

if [[ -f "$APP_DIR/dist/main.js" ]]; then
  systemctl restart "$SERVICE_NAME"
else
  echo "Backend build not yet deployed; systemd unit enabled"
fi

log "Installing and starting Caddy"
caddy validate --config "$SCRIPT_DIR/Caddyfile"
if [[ -f /etc/caddy/Caddyfile && ! -f /etc/caddy/Caddyfile.pre-ulovko ]]; then
  cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.pre-ulovko
fi
install -m 0644 -o root -g root "$SCRIPT_DIR/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy.service
systemctl reload caddy.service

if command -v ufw >/dev/null 2>&1; then
  log "Allowing HTTP/HTTPS through UFW (if UFW is enabled)"
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

log "Provisioning finished"
echo "Node: $(/usr/bin/node --version)"
echo "Caddy: $(caddy version)"
echo "Application directory: $APP_DIR"
echo "Backend systemd unit: $SERVICE_NAME"
echo "Caddy site: https://api.ulovko.fun/api"
