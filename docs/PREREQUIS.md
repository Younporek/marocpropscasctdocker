# Prérequis Ubuntu, à préparer par le formateur

Deux VM séparées : TeamCity Server orchestre ; TeamCity Agent exécute les outils.
Le kit ne modifie aucune VM, n'installe aucun service et ne crée aucun compte.
Toutes les commandes de validation doivent fonctionner sous le compte du service Agent.

## Outils

- Ubuntu pris en charge par TeamCity et Docker, Git, Bash, tar, sha256sum.
- Node.js **24.x LTS**. Référence testée pour le code : **24.19.0**, npm **11.9.0**.
  `.nvmrc` indique 24.19.0 mais n'installe rien. Le service Agent doit disposer d'un
  PATH explicite ; un nvm chargé dans votre shell personnel ne suffit pas.
- Python 3 et venv, Semgrep **1.182.0**.
- Docker Engine installé selon la documentation officielle Ubuntu.
- Trivy **0.76.0**, téléchargé depuis la publication officielle ci-dessous.
- Accès sortant vers Git, registry.npmjs.org, registre des images de base,
  et les registres de base de vulnérabilités utilisés par Trivy.

Node : https://nodejs.org/en/download
Docker Ubuntu : https://docs.docker.com/engine/install/ubuntu/
Docker permissions : https://docs.docker.com/engine/install/linux-postinstall/
Semgrep : https://semgrep.dev/docs/getting-started/quickstart
Trivy : https://github.com/aquasecurity/trivy/releases/tag/v0.76.0

## Semgrep : venv dédié, pas de pip système non isolé

À adapter aux permissions administrées de l'agent :

```bash
python3 -m venv "$HOME/teamcity-tools/semgrep-1.182.0"
"$HOME/teamcity-tools/semgrep-1.182.0/bin/pip" install semgrep==1.182.0
export PATH="$HOME/teamcity-tools/semgrep-1.182.0/bin:$PATH"
semgrep --version
```

Rendre ce PATH disponible au service Agent par le mécanisme de service approuvé,
puis redémarrer le service si nécessaire. Le dépôt fige la version Semgrep principale,
mais pas toutes les dépendances Python : archiver `pip freeze` si une reproduction
binaire exacte de l'outillage est exigée. Les dépendances Node, elles, ont un lock réel.

## Trivy : archive officielle et checksum du même tag

Exemple Linux x86_64, dans un répertoire de préparation vide :

```bash
VERSION=0.76.0
ASSET="trivy_${VERSION}_Linux-64bit.tar.gz"
BASE="https://github.com/aquasecurity/trivy/releases/download/v${VERSION}"
curl --fail --location --output "$ASSET" "$BASE/$ASSET"
curl --fail --location --output "trivy_${VERSION}_checksums.txt" "$BASE/trivy_${VERSION}_checksums.txt"
grep " $ASSET\$" "trivy_${VERSION}_checksums.txt" > selected-checksum.txt
test "$(wc -l < selected-checksum.txt)" -eq 1
sha256sum --check selected-checksum.txt
tar -xzf "$ASSET" trivy
install -m 0755 trivy "$HOME/.local/bin/trivy"
export PATH="$HOME/.local/bin:$PATH"
trivy --version
```

Créer `$HOME/.local/bin` au besoin. Sur ARM64, utiliser l'asset ARM64 approprié de
la même publication, et son checksum. Ne pas recopier un checksum d'une autre version.
Le contrôle vérifie l'intégrité contre le manifeste HTTPS officiel ; il ne remplace
pas une politique de signature/provenance plus forte. Aucun `curl | sh` dans ce kit.

## Docker : accès contrôlé

`docker info` doit fonctionner sous le compte Agent. L'appartenance au groupe Docker
équivaut pratiquement à un accès root sur l'hôte. Le formateur choisit un agent dédié,
Docker rootless ou un accès administré adapté. Ne jamais faire `chmod 666` sur le socket,
ne pas ajouter automatiquement les étudiants au groupe Docker, ne pas exposer le daemon.
Le kit ne manipule pas les droits du socket. Un refus d'accès est un blocage à résoudre
avec l'administrateur, pas à contourner.

## Résoudre une base immuable sur l'agent, avant le build

```bash
docker pull node:24-bookworm-slim
docker image inspect node:24-bookworm-slim --format '{{range .RepoDigests}}{{println .}}{{end}}'
```

Copier le digest réel `node@sha256:...` obtenu, puis définir :

```bash
export BASE_IMAGE='node:24-bookworm-slim@sha256:COLLER_LES_64_CARACTERES_REELS'
```

Le marqueur ci-dessus n'est pas une commande exécutable sans adaptation. Ne pas
inventer de SHA. Utiliser le même digest dans le paramètre TeamCity `env.BASE_IMAGE`.
Si votre politique impose un miroir approuvé, adapter explicitement la validation
et le Dockerfile puis faire relire le changement ; ne pas désactiver le gate.

La base est immuable pour un build, pas éternellement sûre. En cas de CVE HIGH/CRITICAL,
choisir une nouvelle base corrigée, résoudre son nouveau digest, relancer les tests
et scans. Aucune option `--ignore-unfixed` ni seuil abaissé n'est prévu.

## Validation rapide

```bash
node --version
npm --version
semgrep --version
trivy --version
docker info
```

Les versions exactes utilisées sont archivées dans les rapports du build.
