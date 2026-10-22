#!/usr/bin/env bash
CI_STAGE=sca
source "$(dirname "$0")/lib.sh"
context; node ci/state.mjs begin sca; require_pass tests
node ci/state.mjs clear sca-gate.json sca.json sca-summary.txt
need npm
report="$(mktemp "$ROOT/reports/sca-current-XXXXXX.json")"
rc=0
npm audit --omit=dev --audit-level=high --json --registry=https://registry.npmjs.org/ > "$report" 2> reports/sca-stderr.log || rc=$?
mv "$report" reports/sca.json
node ci/gates.mjs sca reports/sca.json "$rc"
