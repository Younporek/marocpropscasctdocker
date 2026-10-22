# Validation réellement effectuée

Date : **21 octobre 2026 (UTC)**. Ce document distingue l'exécution réelle des tests
synthétiques. Il ne constitue pas une certification de sécurité ni une promesse
sur le résultat des bases de vulnérabilités futures.

## Environnement disponible

- Node.js **24.19.0**, npm **11.9.0**, Python **3.12.14**.
- Semgrep **1.182.0**, réellement installé dans un venv depuis PyPI.
- Trivy **0.76.0**, réellement téléchargé depuis la publication GitHub officielle.
- Pas de client/daemon Docker utilisable ; pas de serveur TeamCity dans cet environnement.

## Exécutions réelles

| Variante | Tests fonctionnels | Semgrep | npm audit |
|---|---|---|---|
| unit-fail | FAIL attendu | non exécuté | non exécuté |
| sast-fail | 6/6 PASS | FAIL : 1 appel eval | PASS |
| sca-fail | 6/6 PASS | PASS | FAIL : 1 dépendance HIGH |
| both-security-fail | 6/6 PASS | FAIL : 1 appel eval | FAIL : 1 dépendance HIGH |
| fixed | 6/6 PASS | PASS | PASS |

Les deux lockfiles ont été générés avec npm depuis le registre officiel. Le scénario
final a été remis à **fixed**, lodash **4.18.1**. Aucun `npm audit fix --force` utilisé.
Le nombre indiqué pour SCA est un nombre de dépendances vulnérables, pas une promesse
sur le nombre d'advisories ni de CVE.

Les 3 groupes de tests de parseurs intégrés à `npm run test:gates` passent également.
Ils vérifient notamment les erreurs de scanner, JSON absent ou malformé, code de sortie
incohérent, scan incomplet, image différente et base périmée.

Les scripts Bash passent `bash -n`. Tous les imports/modules utilisés par les tests
ont été chargés avec succès. Les cinq scénarios ont été exécutés via les scripts CI
01, 02 et 03, et pas seulement via des appels directs aux fonctions métier.

## Trivy : vérifications réelles, mais pas d'image Docker

Archive officielle :
https://github.com/aquasecurity/trivy/releases/download/v0.76.0/trivy_0.76.0_Linux-64bit.tar.gz

Manifeste de checksums officiel :
https://github.com/aquasecurity/trivy/releases/download/v0.76.0/trivy_0.76.0_checksums.txt

SHA-256 de cette archive, vérifié contre le manifeste :

```text
e24b1c51293c1b15e4ba8d45bbc7891ba053f90278ec2698f3562c993e145fe7
```

Le binaire annonce `Version: 0.76.0`. Les options employées dans le script 05 sont
présentes dans son aide (`--image-src`, `--exit-code`, `--exit-on-eol`, `--ignorefile`,
`--scanners`, `--severity`, `--format`).

Le téléchargement réel de la base de vulnérabilités a réussi. Métadonnées observées :

```json
{
  "Version": 2,
  "UpdatedAt": "2026-10-21T19:18:22.876313144Z",
  "NextUpdate": "2026-10-22T19:18:22.876312904Z",
  "DownloadedAt": "2026-10-21T19:47:45.444862381Z"
}
```

Un **scan filesystem**, avec Trivy 0.76.0, du package-lock corrigé a réellement
retourné zéro HIGH/CRITICAL (SchemaVersion 2, ArtifactType filesystem, Type npm).
Ce résultat ne couvre ni une image de base, ni ses packages OS, ni un conteneur.
Il n'est pas utilisé comme substitut au gate image.

## Vérification indépendante par cas synthétiques

- **26 cas** de parseurs : schémas, seuils, erreurs, couverture Node image `node-pkg`,
  date de DB, même image ID et incohérences de codes retour.
- **13 cas** d'état : build/run périmé, mutation des sources, mutation du rapport,
  invalidation des gates suivants et suppression de release en cas d'échec.
- **10 contrôles** pré-déploiement : prérequis absents/FAIL bloquent avant Docker,
  sans laisser de release.

Le chemin succès des étapes 04 à 06 a également été vérifié dans une copie isolée,
avec commandes Docker, Trivy et smoke entièrement simulées : ordre correct, image ID
constant, options de confinement et 4/4 checksums de release conformes. Ce contrôle
ne constitue pas une exécution réelle de Docker, de scanner d’image ou de déploiement.

Ces vérifications sont des tests de logique et de contrôle de flux. Les identifiants
d'image ou de vulnérabilité synthétiques dans les tests ne sont pas des résultats
réels de scan.

## Non exécuté : à vérifier sur les VM du formateur

1. Installation, autorisation, PATH et droits du véritable TeamCity Agent.
2. Checkout Git par TeamCity et publication réelle des Artifacts, y compris en FAIL.
3. Construction Docker d'une base réelle épinglée par digest.
4. Scan Trivy de **cette image construite**, avec packages OS et Node installés.
5. Déploiement réel de l'image ID scannée et vérification Docker du conteneur.
6. Smoke test à travers le port Docker `127.0.0.1:18080` de la VM Agent.
7. Arrêt/suppression du seul conteneur du TP et lancement d'un second build.

Ne pas présenter ces étapes comme validées avant leur exécution. La checklist et
les commandes nécessaires sont présentes dans README.md et TEAMCITY_STEPS_A_COPIER.txt.
