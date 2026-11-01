#!/usr/bin/env bash
set -euo pipefail

sudo k3s kubectl get nodes -o wide
sudo k3s kubectl -n ctf-demo get deployments,pods,services,ingresses -o wide
