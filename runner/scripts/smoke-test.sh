#!/usr/bin/env bash
set -euo pipefail

command -v curl >/dev/null || {
  echo 'curl is required.' >&2
  exit 1
}
command -v python3 >/dev/null || {
  echo 'python3 is required.' >&2
  exit 1
}

HOST="${1:-}"
if [[ -z "$HOST" ]]; then
  HOST="$(sudo k3s kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')"
fi
if [[ -z "$HOST" ]]; then
  echo 'Could not determine the node IP. Supply it: ./scripts/smoke-test.sh <IP>' >&2
  exit 1
fi

HTTP_PORT="${HTTP_PORT:-80}"
TCP_PORT="${TCP_PORT:-30080}"

echo "Testing HTTP ingress at $HOST:$HTTP_PORT..."
curl --fail --silent --show-error --max-time 10 \
  -H 'Host: demo.ctf.test' "http://$HOST:$HTTP_PORT/" | grep -Fx 'CTF HTTP demo OK'

echo "Testing TCP NodePort at $HOST:$TCP_PORT..."
python3 - "$HOST" "$TCP_PORT" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])
with socket.create_connection((host, port), timeout=10) as sock:
    greeting = sock.recv(64)
    assert greeting == b"CTF TCP demo OK\n", greeting
    sock.sendall(b"ping\n")
    echoed = sock.recv(64)
    assert echoed == b"ping\n", echoed
    print(greeting.decode().strip(), 'and echo ping: OK')
PY

echo 'Both smoke tests passed.'
