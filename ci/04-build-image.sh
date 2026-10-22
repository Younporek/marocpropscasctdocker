#!/usr/bin/env bash
CI_STAGE=build
source "$(dirname "$0")/lib.sh"
context; node ci/state.mjs begin build; require_pass tests sast sca
node ci/state.mjs clear build-gate.json image.json
need docker
: "${BASE_IMAGE:?Définir BASE_IMAGE=node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205}"
[[ "$BASE_IMAGE" =~ ^node:[A-Za-z0-9._-]+@sha256:[a-f0-9]{64}$ ]] || { echo "Référence officielle Node épinglée par digest requise" >&2; exit 2; }
docker info > reports/docker-info.txt 2>&1
printf '%s\n' "$BASE_IMAGE" > reports/base-image.txt
run_id="$(node -p 'JSON.parse(require("fs").readFileSync(".ci/run.json")).runId')"
tag="marocpromo-lab:$run_id"
docker build --pull --build-arg "BASE_IMAGE=$BASE_IMAGE" --iidfile .ci/image-id --tag "$tag" . > reports/docker-build.log 2>&1
image_id="$(cat .ci/image-id)"
[[ "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]]
[[ "$(docker image inspect --format '{{.Id}}' "$tag")" == "$image_id" ]]
node - "$tag" "$image_id" "$BASE_IMAGE" <<'JS'
const fs=require('fs');
const [tag,imageId,baseImage]=process.argv.slice(2);
fs.writeFileSync('reports/image.json',JSON.stringify({tag,imageId,baseImage},null,2)+'\n');
JS
pass
