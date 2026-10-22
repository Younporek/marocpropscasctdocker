#!/usr/bin/env bash
CI_STAGE=image
source "$(dirname "$0")/lib.sh"
context; node ci/state.mjs begin image; require_pass tests sast sca build
node ci/state.mjs clear image-gate.json trivy.json trivy-db.json image-summary.txt
need trivy; need docker
: "${TRIVY_VERSION:?Définir la version exacte installée, par exemple celle vérifiée dans docs/PREREQUIS.md}"
cache="${TRIVY_CACHE_DIR:-$HOME/.cache/trivy}"
trivy --version > reports/trivy-version.txt
actual="$(head -n 1 reports/trivy-version.txt)"
[[ "$actual" == "Version: $TRIVY_VERSION" ]] || { echo "Version Trivy inattendue : $actual" >&2; exit 2; }
image_id="$(node -p 'JSON.parse(require("fs").readFileSync("reports/image.json")).imageId')"
[[ "$(docker image inspect --format '{{.Id}}' "$image_id")" == "$image_id" ]]
report="$(mktemp "$ROOT/reports/trivy-current-XXXXXX.json")"
rc=0
# 10 = vulnérabilités ; 11 = OS EOL ; tout autre non-zéro = erreur technique.
# Pas de --ignore-unfixed, pas de --skip-db-update, pas de suppression locale.
trivy --cache-dir "$cache" image --image-src docker --scanners vuln --severity HIGH,CRITICAL --ignorefile /dev/null --exit-code 10 --exit-on-eol 11 --format json --output "$report" "$image_id" > reports/trivy-stdout.log 2> reports/trivy-stderr.log || rc=$?
mv "$report" reports/trivy.json
# Preuve de la base réellement disponible après ce scan, jamais une date inventée.
if [[ -r "$cache/db/metadata.json" ]]; then cp "$cache/db/metadata.json" reports/trivy-db.json; fi
node ci/gates.mjs image reports/trivy.json "$rc" "$image_id"
