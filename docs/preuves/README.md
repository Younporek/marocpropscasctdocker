# Preuves compactes de préparation

Échantillons historiques du 21 octobre 2026 UTC, non utilisés comme entrées
par le pipeline. Les rapports courants sont toujours recréés dans reports/.

- unit-fail, sast-fail, sca-fail, fixed : exécutions réelles Node, Semgrep et npm audit.
- tests-synthetiques : cas indépendants de contrôle de logique, pas des scans réels.
- trivy-filesystem : véritable scan du lockfile, pas une image ni un déploiement.

Les identifiants de run et hashes de source identifient les essais à cette date,
pas votre futur build. Lire ../VALIDATION.md pour les limites et les étapes non exécutées.
