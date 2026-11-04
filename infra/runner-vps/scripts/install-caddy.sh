#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run install-caddy.sh as root.' >&2
  exit 1
fi

# Build Caddy with the DNS-01 Cloudflare provider (not in stock Caddy).
CADDY_VERSION='v2.11.7'
XCADDY_VERSION='v0.4.7'
CLOUDFLARE_VERSION='v0.2.4'
EXPECTED="caddy=$CADDY_VERSION xcaddy=$XCADDY_VERSION cloudflare=$CLOUDFLARE_VERSION"
BINARY='/usr/local/bin/caddy-ulovko'
VERSION_FILE='/usr/local/share/ulovko/caddy-build-version'

if [[ -x "$BINARY" && -f "$VERSION_FILE" ]] &&
   [[ "$(cat "$VERSION_FILE")" == "$EXPECTED" ]] &&
   "$BINARY" list-modules | grep -qx 'dns.providers.cloudflare'; then
  echo 'Caddy with Cloudflare DNS support already installed.'
  exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo 'Automated Caddy build currently supports Debian/Ubuntu (apt).' >&2
  exit 1
fi

# GOTOOLCHAIN=auto lets Go obtain a newer toolchain when required.
apt-get update
apt-get install -y --no-install-recommends golang-go ca-certificates git

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
export GOTOOLCHAIN=auto
GOBIN="$workdir/bin" go install "github.com/caddyserver/xcaddy/cmd/xcaddy@$XCADDY_VERSION"
"$workdir/bin/xcaddy" build "$CADDY_VERSION" \
  --with "github.com/caddy-dns/cloudflare@$CLOUDFLARE_VERSION" \
  --output "$workdir/caddy-ulovko"
"$workdir/caddy-ulovko" list-modules | grep -qx 'dns.providers.cloudflare'

install -d -m 0755 -o root -g root /usr/local/share/ulovko
install -m 0755 -o root -g root "$workdir/caddy-ulovko" "$BINARY.next"
mv -f "$BINARY.next" "$BINARY"
printf '%s\n' "$EXPECTED" > "$VERSION_FILE"
chmod 0644 "$VERSION_FILE"
echo "Installed $EXPECTED"
