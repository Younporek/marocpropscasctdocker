#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
source ci/tool-versions.env
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$ROOT/.ci/npm-cache}"
mkdir -p .ci reports
export CI_STAGE="${CI_STAGE:?CI_STAGE manquant}"
trap 'rc=$?; trap - EXIT; if ((rc != 0)); then node ci/state.mjs fail "$CI_STAGE" "$rc"; fi; exit "$rc"' EXIT
need() { command -v "$1" >/dev/null || { echo "Outil absent : $1" >&2; exit 2; }; }
context() { node ci/state.mjs context; }
require_pass() { node ci/state.mjs require "$@"; }
pass() { node ci/state.mjs pass "$CI_STAGE"; }
