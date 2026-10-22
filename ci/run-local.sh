#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
bash ci/01-prepare-test.sh
# Collecter les deux rapports même si une analyse trouve un défaut.
rc_sast=0; bash ci/02-sast.sh || rc_sast=$?
rc_sca=0; bash ci/03-sca.sh || rc_sca=$?
if ((rc_sast != 0 || rc_sca != 0)); then echo 'Security Gate non PASS : pas de build/release/déploiement.' >&2; exit 1; fi
bash ci/04-build-image.sh
bash ci/05-image-scan.sh
bash ci/06-package-deploy.sh
