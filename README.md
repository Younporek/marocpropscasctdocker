# MarocPromo — CI/CD DevSecOps avec TeamCity

Un petit service HTTP Node.js pour apprendre à **tester, bloquer une livraison,
corriger, construire une image, l'analyser, puis déployer exactement cette image**.

Le dépôt est livré en état **fixed**. Il contient de vraies variantes vulnérables
uniquement pour le laboratoire. Ne pas l'exposer sur Internet ni utiliser de données
réelles. Le TP ne demande aucune exploitation de vulnérabilité.

## Deux VM, deux rôles

- **Ubuntu TeamCity Server** : interface web, VCS, orchestration, historique, Artifacts.
- **Ubuntu TeamCity Agent** : checkout, Node/npm, Semgrep, Docker, Trivy et conteneur local.

Le service de démonstration est accessible à `http://127.0.0.1:18080` **sur l'agent**.
`127.0.0.1` depuis votre PC ou depuis le Server désigne une autre machine.
Aucune publication sur une adresse réseau, aucune poussée d'image vers un registre,
aucun déploiement de production n'est effectué par les scripts.

## Prérequis et démarrage court

Lire [docs/PREREQUIS.md](docs/PREREQUIS.md) pour les versions, leur installation,
le PATH du service Agent, Docker et le digest de l'image de base.

```bash
node --version
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:gates
npm start
```

Dans un autre terminal :

```bash
curl --fail http://127.0.0.1:3000/health
curl --fail 'http://127.0.0.1:3000/quote?amount=200&discount=15'
```

Résultats attendus : `{"status":"ok","app":"MarocPromo"}` et
`{"total":170,"currency":"MAD"}`. Arrêter avec Ctrl+C.
Le serveur local écoute uniquement sur loopback par défaut ; le Dockerfile choisit
0.0.0.0 dans le conteneur et Docker ne publie que le loopback de l'agent.

## Ce que les tests montrent

`tests/promo.test.js` contient **5 tests métier** ; `tests/http.test.js` ajoute
**1 test HTTP** couvrant santé, calcul, saisie invalide et route inconnue.
Le scénario vulnérable `eval()` réussit les tests fonctionnels, car les entrées
numériques testées produisent les bons résultats. Le SAST révèle un autre type de
risque. L'existence d'un test vert n'est donc pas une preuve de sécurité.

Le serveur valide toujours ses paramètres numériques, y compris dans les variantes.
Le code vulnérable est présent pour être détecté, pas pour recevoir une charge d'attaque.
La règle locale `eval(...)` est un contrôle pédagogique ciblé, pas un audit exhaustif.

## Six étapes réelles

| Étape | Commande | Condition de réussite |
|---|---|---|
| 01 | `bash ci/01-prepare-test.sh` | `npm ci`, 5 tests métier + 1 HTTP, tests des gates |
| 02 | `bash ci/02-sast.sh` | Semgrep : zéro correspondance à la règle, zéro erreur |
| 03 | `bash ci/03-sca.sh` | npm audit : zéro HIGH/CRITICAL, rapport valide |
| 04 | `bash ci/04-build-image.sh` | Base épinglée, image construite, image ID conservé |
| 05 | `bash ci/05-image-scan.sh` | Trivy : zéro HIGH/CRITICAL, OS supporté, scan valide |
| 06 | `bash ci/06-package-deploy.sh` | Même image ID, smoke HTTP vert, paquet et checksum |

Pour exécuter le tout localement, après définition de `BASE_IMAGE` :

```bash
bash ci/run-local.sh
```

Ce script collecte SAST et SCA même si l'un échoue, puis s'arrête si leur gate n'est
pas PASS. Les étapes suivantes ne sont pas appelées en cas d'échec.

Dans TeamCity, reprendre exactement [TEAMCITY_STEPS_A_COPIER.txt](TEAMCITY_STEPS_A_COPIER.txt).
L'étape 03 s'exécute même si SAST a échoué pour conserver les deux diagnostics.
Les étapes 04 à 06 utilisent **Only if build status is successful**.
Le contrôle de code retour non nul doit rester activé.

## Parcours des erreurs puis corrections

Effectuer ces changements dans une **copie de travail personnelle**, jamais dans
un checkout actif de TeamCity. Le script remplace exactement `src/promo.js`,
`package.json` et `package-lock.json` par les variantes du scénario choisi.
Sauvegarder vos modifications avant de l'utiliser.

```bash
node scripts/set-scenario.mjs unit-fail
bash ci/01-prepare-test.sh
```

Le calcul ajoute la remise au lieu de la déduire : le test 200 − 15 % échoue.
Lire l'attendu et l'observé. Corriger le signe dans `src/promo.js`, ou revenir à fixed :

```bash
node scripts/set-scenario.mjs fixed
bash ci/01-prepare-test.sh
```

Puis SAST, tests verts mais code dangereux :

```bash
node scripts/set-scenario.mjs sast-fail
bash ci/01-prepare-test.sh
bash ci/02-sast.sh
cat reports/sast-summary.txt
```

Résultat : FAIL, règle `formation.javascript.eval-interdit` dans `src/promo.js`.
La correction est la conversion numérique validée de `scenarios/promo.fixed.js.txt`.

Puis SCA, code corrigé mais dépendance obsolète :

```bash
node scripts/set-scenario.mjs sca-fail
bash ci/01-prepare-test.sh
bash ci/02-sast.sh
bash ci/03-sca.sh
cat reports/sca-summary.txt
```

Résultat attendu : SAST PASS, SCA FAIL pour lodash **4.17.15**. Les identifiants et
comptes des avis évoluent. Lire le rapport courant, ne pas mémoriser un nombre de CVE.
`both-security-fail` active les deux défauts pour vérifier les deux rapports ensemble.

La correction du kit utilise lodash **4.18.1**, version vérifiée sur le registre
npm officiel lors de sa préparation. Les lockfiles fournis ont été générés par npm,
avec les véritables URL et intégrités des archives, pas écrits à la main.

```bash
node scripts/set-scenario.mjs fixed
npm ci --ignore-scripts --no-audit --no-fund
```

Pour faire soi-même une mise à jour ultérieure : vérifier la version officielle,
modifier explicitement la dépendance, générer le lock avec npm, relire le diff,
commiter les deux fichiers, puis relancer tout le pipeline. Ne pas utiliser
`npm audit fix --force` comme correction automatique pédagogique.

Après chaque modification pour TeamCity :

```bash
git add src/promo.js package.json package-lock.json
git commit -m "TP : scénario choisi ou correction"
git push
```

Le kit ne choisit pas votre URL Git, ne crée aucun dépôt et n'envoie aucun commit.

## Docker / Trivy : quatrième gate

Le scénario fixed corrige le code et lodash. Il ne garantit **pas** que l'image de
base sera exempte de vulnérabilités au jour du cours.

1. Résoudre un digest réel de `node:24-bookworm-slim` selon les prérequis.
2. Fournir ce digest à `BASE_IMAGE` et à `env.BASE_IMAGE` dans TeamCity.
3. Lancer 01 à 05. Trivy met sa base à jour, conserve le JSON et ses métadonnées.
4. Si HIGH/CRITICAL ou OS en fin de support : lire package, version installée,
   version corrigée et ID de vulnérabilité. Choisir une base corrigée et relancer.
5. Ne pas masquer les CVE non corrigées, ne pas forcer le gate en PASS.

Aucune ancienne image volontairement vulnérable n'est déployée pour forcer un
résultat rouge. Les tests synthétiques des parseurs démontrent un blocage déterministe,
mais ne sont jamais présentés comme un vrai scan d'image. Un vrai échec Trivy peut
être observé uniquement si le rapport courant de l'image choisie le justifie.

Le Dockerfile utilise l'utilisateur `node` non-root. `.dockerignore` est une liste
blanche : seuls package.json, package-lock.json, src/ et Dockerfile entrent dans
le contexte. Les variantes vulnérables inactives, rapports, tests, outils et .git
ne sont pas copiés dans l'image.

## Déploiement local, preuve et arrêt

Le build récupère un **image ID** local. Trivy analyse cet ID ; le déploiement utilise
cet ID, jamais une étiquette mutable. Le conteneur observé est revérifié avec Docker.
Il est lancé non-root, en lecture seule, sans capacités ajoutées, avec limites de
ressources et port publié seulement sur `127.0.0.1:18080`.

```bash
cat reports/image.json
cat reports/image-gate.json
cat reports/container-name.txt
docker inspect --format '{{.Image}}' "$(cat reports/container-name.txt)"
curl --fail http://127.0.0.1:18080/health
```

Le conteneur reste actif pour l'observation. Après la démonstration, arrêter et
supprimer **uniquement** le conteneur nommé par votre build :

```bash
NAME="$(cat reports/container-name.txt)"
docker stop "$NAME"
docker rm "$NAME"
```

Le script ne supprime jamais un conteneur existant automatiquement. Si le port 18080
est occupé, le build échoue. Conserver le nom et effectuer le nettoyage autorisé
avant de relancer. Concurrency = 1 et agent dédié sont requis pour ce TP.
Si un déploiement échoue après création du conteneur, consulter également
`reports/container-id.txt` pour retrouver uniquement ce conteneur.

## Rapports, release et anti-faux-PASS

`reports/` contient les JSON, erreurs standard, résumés, versions, JUnit et preuves.
Il est publié même lors d'un échec. Les gates distinguent :

- **PASS** : rapport normal, couverture attendue et seuil respecté.
- **FAIL** : défaut détecté ou test fonctionnel rouge.
- **ERROR** : outil absent, erreur réseau, base périmée, JSON invalide ou analyse incomplète.

FAIL et ERROR bloquent tous deux la livraison. Une panne de scanner n'est pas un
résultat « zéro vulnérabilité ». Les codes retour des commandes sont capturés pour
écrire les rapports, pas neutralisés pour poursuivre la livraison.

Au début du build, seuls les dossiers de sortie `reports/`, `release/` et `.ci/` de
ce dépôt sont réinitialisés. Un identifiant unique et un hash des sources lient les
gates au build. Une relance d'étape invalide les étapes suivantes et la release.
Des sources modifiées ou un rapport modifié après validation bloquent la suite.
Ne jamais exécuter deux pipelines simultanément dans la même copie de travail.

`release/` est rempli uniquement après tous les gates et le smoke test :
`marocpromo-source.tar.gz`, `image.json`, `image-gate.json`, `smoke.json`, `SHA256SUMS`.
Il s'agit d'un paquet pédagogique de sources et de preuves, pas d'une image Docker
exportée. Le conteneur a été lancé à partir de l'image ID scannée, sans rebuild.

## Arborescence essentielle

```text
src/                  logique métier et serveur HTTP
tests/                tests métier, HTTP et parseurs
rules/no-eval.yml      règle Semgrep locale
ci/                   six étapes, helper, état et gates
scripts/              sélection des scénarios et smoke test
scenarios/            snapshots pédagogiques + vrais lockfiles
docs/                 prérequis et validation effectuée
Dockerfile            image non-root
TEAMCITY_STEPS_A_COPIER.txt
```

## Limites et sources officielles

La validation réellement effectuée est décrite dans [docs/VALIDATION.md](docs/VALIDATION.md).
La sécurité dépend aussi du durcissement de l'agent, de la provenance des outils,
du traitement des secrets et des droits Git/TeamCity, hors de ce mini-projet.

- Node test runner : https://nodejs.org/api/test.html
- npm ci : https://docs.npmjs.com/cli/v11/commands/npm-ci/
- npm audit : https://docs.npmjs.com/cli/v11/commands/npm-audit/
- lodash officiel : https://registry.npmjs.org/lodash/latest
- Semgrep CLI : https://semgrep.dev/docs/cli-reference
- Trivy reporting : https://trivy.dev/docs/latest/configuration/reporting/
- Trivy conteneurs : https://trivy.dev/docs/latest/guide/target/container_image/
- Docker image IDs/digests : https://docs.docker.com/reference/cli/docker/image/pull/
- TeamCity steps : https://www.jetbrains.com/help/teamcity/configuring-build-steps.html
- TeamCity Artifacts : https://www.jetbrains.com/help/teamcity/configuring-general-settings.html
