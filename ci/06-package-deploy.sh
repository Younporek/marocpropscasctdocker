#!/usr/bin/env bash
CI_STAGE=deploy
source "$(dirname "$0")/lib.sh"
context; node ci/state.mjs begin deploy; require_pass tests sast sca build image
need docker; need tar; need sha256sum
image_id="$(node -p 'JSON.parse(require("fs").readFileSync("reports/image.json")).imageId')"
scanned_id="$(node -p 'JSON.parse(require("fs").readFileSync("reports/image-gate.json")).imageId')"
[[ "$image_id" == "$scanned_id" ]]
[[ "$(docker image inspect --format '{{.Id}}' "$image_id")" == "$image_id" ]]
run_id="$(node -p 'JSON.parse(require("fs").readFileSync(".ci/run.json")).runId')"
name="marocpromo-lab-${run_id}"
# Aucun conteneur existant n'est supprimé. Port occupé = échec explicite.
docker run -d --name "$name" --label marocpromo.lab=true --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=100 --memory=128m --cpus=1 --publish 127.0.0.1:18080:3000 "$image_id" > reports/container-id.txt
[[ "$(docker inspect --format '{{.Image}}' "$name")" == "$image_id" ]]
printf '%s\n' "$name" > reports/container-name.txt
node scripts/smoke.mjs > reports/smoke.json
# Le conteneur reste disponible pour l'observation. La suppression est manuelle.
# Le paquet de sources est uniquement une sortie de laboratoire, pas l'image déployée.
tmp="$(mktemp -d "$ROOT/.ci/release-XXXXXX")"
tar -czf "$tmp/marocpromo-source.tar.gz" package.json package-lock.json Dockerfile .dockerignore src
cp reports/image.json "$tmp/image.json"
cp reports/image-gate.json "$tmp/image-gate.json"
cp reports/smoke.json "$tmp/smoke.json"
(cd "$tmp" && sha256sum marocpromo-source.tar.gz image.json image-gate.json smoke.json > SHA256SUMS)
# L'ensemble est publié seulement après tous les contrôles, y compris le smoke test.
cp "$tmp/"* release/
pass
printf 'Déployé sur http://127.0.0.1:18080/health (sur la VM Agent)\n'
printf 'Nettoyage manuel après observation : docker stop %s && docker rm %s\n' "$name" "$name"
