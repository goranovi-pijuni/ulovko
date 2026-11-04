#!/usr/bin/env bash
set -euo pipefail

# Root-only helper invoked as: sudo -n /usr/local/libexec/ulovko/import-image.sh BUILD_ID SERVICE
# No user-controlled paths or arbitrary shell commands are accepted.
if [[ $EUID -ne 0 || $# -ne 2 ]]; then
  echo 'Expected root and two arguments: BUILD_ID SERVICE' >&2
  exit 1
fi

BUILD_ID="$1"
SERVICE="$2"
if [[ ! "$BUILD_ID" =~ ^[0-9a-f]{32}$ ]] ||
   [[ ! "$SERVICE" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] ||
   (( ${#SERVICE} > 63 )); then
  echo 'Invalid build ID or service name.' >&2
  exit 1
fi

root='/var/lib/ctf-runner/builds'
job="$root/$BUILD_ID"
archive="$job/images/$SERVICE.oci.tar"

for path in "$job" "$job/images" "$archive"; do
  if [[ -L "$path" ]]; then
    echo "Symlink not permitted: $path" >&2
    exit 1
  fi
done
if [[ ! -f "$job/job.json" || ! -f "$archive" ]]; then
  echo "Missing build record or OCI archive: $BUILD_ID/$SERVICE" >&2
  exit 1
fi

# Verify the selected image belongs to a successful completed build.
python3 - "$job/job.json" "$SERVICE" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as file:
        job = json.load(file)
    service = sys.argv[2]
    valid = (
        job.get("status") == "succeeded"
        and job.get("images", {}).get(service) == f"{service}.oci.tar"
    )
except (OSError, ValueError, AttributeError):
    valid = False
if not valid:
    raise SystemExit("Build record does not permit this import")
PY

image="ulovko.local/challenges/$BUILD_ID/$SERVICE:v1"
# Import into containerd's Kubernetes namespace. The OCI index receives a
# predictable image reference even though builder.py exports unnamed archives.
k3s ctr -n k8s.io images import --index-name "$image" "$archive"
k3s ctr -n k8s.io images list -q | grep -Fx -- "$image" >/dev/null || {
  echo "Imported image not found: $image" >&2
  exit 1
}
echo "Imported $image"
