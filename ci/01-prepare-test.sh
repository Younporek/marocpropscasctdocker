#!/usr/bin/env bash
CI_STAGE=tests
source "$(dirname "$0")/lib.sh"
node ci/state.mjs init
need node; need npm
[[ "$(node -p 'process.versions.node.split(".")[0]')" == "$NODE_MAJOR" ]] || { echo "Node $NODE_MAJOR requis" >&2; exit 2; }
{
  date -u +%FT%TZ
  node --version
  npm --version
  git --version
} > reports/tools.txt
npm ci --ignore-scripts --no-audit --no-fund > reports/npm-ci.log 2>&1
# Les rapports sont écrits avant le retour non nul, donc restent publiables.
if node --test --test-reporter=spec --test-reporter-destination=reports/tests.txt --test-reporter=junit --test-reporter-destination=reports/tests-junit.xml tests/promo.test.js tests/http.test.js; then
  if ! npm run test:gates > reports/gate-tests.txt 2>&1; then
    node ci/state.mjs result tests FAIL "Tests des parseurs en échec"; exit 1
  fi
  pass
else
  cat reports/tests.txt
  node ci/state.mjs result tests FAIL "Tests fonctionnels en échec"
  exit 1
fi
cat reports/tests.txt
