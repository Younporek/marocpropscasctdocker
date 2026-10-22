#!/usr/bin/env bash
CI_STAGE=sast
source "$(dirname "$0")/lib.sh"
context; node ci/state.mjs begin sast; require_pass tests
node ci/state.mjs clear sast-gate.json sast.json sast-summary.txt
need semgrep
export SEMGREP_ENABLE_VERSION_CHECK=0
if ! semgrep --version > reports/semgrep-version.txt 2> reports/semgrep-version.log; then
  cat reports/semgrep-version.log >&2; exit 2
fi
actual="$(cat reports/semgrep-version.txt)"
[[ "$actual" == "$SEMGREP_VERSION" ]] || { echo "Semgrep $SEMGREP_VERSION requis, trouvé $actual" >&2; exit 2; }
printf '%s\n' "$actual" > reports/semgrep-version.txt
report="$(mktemp "$ROOT/reports/sast-current-XXXXXX.json")"
rc=0
semgrep scan --config rules/no-eval.yml --strict --error --disable-nosem --disable-version-check --metrics=off --json --output "$report" src > reports/sast-stdout.log 2> reports/sast-stderr.log || rc=$?
mv "$report" reports/sast.json
node ci/gates.mjs sast reports/sast.json "$rc"
