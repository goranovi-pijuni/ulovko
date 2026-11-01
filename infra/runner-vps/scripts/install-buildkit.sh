#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run with sudo: sudo bash infra/runner-vps/scripts/install-buildkit.sh' >&2
  exit 1
fi
command -v systemctl >/dev/null || {
  echo 'systemd is required.' >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v pacman >/dev/null 2>&1; then
  pacman -S --needed --noconfirm buildkit rootlesskit slirp4netns runc shadow
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y rootlesskit slirp4netns uidmap runc curl ca-certificates
  if ! command -v buildkitd >/dev/null || ! command -v buildctl >/dev/null; then
    # Debian/Ubuntu do not consistently package both BuildKit binaries.
    # Use the same upstream version as the local Arch development example.
    version='0.34.1'
    arch="$(dpkg --print-architecture)"
    case "$arch" in
      amd64|arm64) ;;
      *) echo "Unsupported BuildKit architecture: $arch" >&2; exit 1 ;;
    esac
    archive="$(mktemp)"
    trap 'rm -f "$archive"' EXIT
    curl --fail --location --silent --show-error \
      "https://github.com/moby/buildkit/releases/download/v${version}/buildkit-v${version}.linux-${arch}.tar.gz" \
      --output "$archive"
    tar -xzf "$archive" -C /usr/local/bin --strip-components=1 \
      bin/buildkitd bin/buildctl
    chmod 0755 /usr/local/bin/buildkitd /usr/local/bin/buildctl
  fi
else
  echo 'Package manager must be pacman or apt-get.' >&2
  exit 1
fi

for binary in buildctl buildkitd rootlesskit slirp4netns newuidmap newgidmap runc; do
  command -v "$binary" >/dev/null || {
    echo "Missing required command: $binary" >&2
    exit 1
  }
done

if ! getent group ulovko-build >/dev/null; then
  groupadd --system ulovko-build
fi
if ! id -u ctf-builder >/dev/null 2>&1; then
  useradd --create-home --home-dir /var/lib/ctf-builder \
    --gid ulovko-build --shell "$(command -v nologin)" ctf-builder
fi
if ! id -u ctf-runner >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/ctf-runner \
    --shell "$(command -v nologin)" ctf-runner
fi
usermod -aG ulovko-build ctf-runner

# Permit the operator who invoked sudo to run buildctl after re-login.
if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != root && "$SUDO_USER" != deploy ]] && id "$SUDO_USER" >/dev/null 2>&1; then
  usermod -aG ulovko-build "$SUDO_USER"
fi

# RootlessKit requires a range of subordinate UIDs and GIDs.
if ! grep -q '^ctf-builder:' /etc/subuid || ! grep -q '^ctf-builder:' /etc/subgid; then
  start="$(awk -F: 'BEGIN { max=99999 } NF>=3 && $2+$3-1 > max { max=$2+$3-1 } END { print max+1 }' /etc/subuid /etc/subgid)"
  end="$((start + 65535))"
  if ! grep -q '^ctf-builder:' /etc/subuid; then
    usermod --add-subuids "${start}-${end}" ctf-builder
  fi
  if ! grep -q '^ctf-builder:' /etc/subgid; then
    usermod --add-subgids "${start}-${end}" ctf-builder
  fi
fi

# Ubuntu 24.04+ can restrict unprivileged user namespaces with AppArmor.
# Provide a narrowly targeted allowance for the rootlesskit executable
# without globally disabling the kernel protection.
if [[ -r /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]] &&
   [[ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns)" == 1 ]] &&
   command -v apparmor_parser >/dev/null 2>&1 &&
   [[ ! -f /etc/apparmor.d/usr.bin.rootlesskit ]]; then
  install -m 0644 -o root -g root "$ROOT_DIR/rootlesskit.apparmor" \
    /etc/apparmor.d/usr.bin.rootlesskit
  apparmor_parser -r /etc/apparmor.d/usr.bin.rootlesskit
fi

install -d -m 0755 -o root -g root /etc/buildkit
install -m 0644 -o root -g root "$ROOT_DIR/buildkitd.toml" \
  /etc/buildkit/ulovko-rootless.toml
install -d -m 0750 -o ctf-runner -g ctf-runner /var/lib/ctf-runner/builds
install -m 0644 -o root -g root "$ROOT_DIR/ctf-buildkit.service" \
  /etc/systemd/system/ctf-buildkit.service
systemctl daemon-reload
systemctl enable --now ctf-buildkit.service
systemctl restart ctf-buildkit.service

# Wait for the socket and a usable OCI worker, not just systemd 'active'.
for _ in {1..30}; do
  if runuser -u ctf-runner -- buildctl \
    --addr unix:///run/ulovko-buildkit/buildkitd.sock debug workers \
    >/dev/null 2>&1; then
    echo 'Rootless BuildKit is ready.'
    exit 0
  fi
  sleep 1
done

systemctl status ctf-buildkit.service --no-pager || true
echo 'Rootless BuildKit did not become ready. Inspect:' >&2
echo '  sudo journalctl -u ctf-buildkit.service -n 100 --no-pager' >&2
exit 1
