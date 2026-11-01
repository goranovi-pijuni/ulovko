#!/usr/bin/env bash
set -euo pipefail

sudo k3s kubectl -n ctf-demo delete \
  deployment/demo-http deployment/demo-tcp \
  service/demo-http service/demo-tcp \
  ingress/demo-http \
  --ignore-not-found

echo 'Demo workloads removed; K3s and the ctf-demo namespace remain.'
