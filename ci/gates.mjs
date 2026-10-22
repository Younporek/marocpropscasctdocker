import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const error = reason => ({ status:'ERROR', reason });
const fail = (reason, count) => ({ status:'FAIL', reason, blockingFindings:count });
const pass = () => ({ status:'PASS', reason:'Rapport valide, aucun résultat au seuil bloquant.', blockingFindings:0 });
export function evaluateSast(report, rc, expectedFiles=[]) {
  if (![0,1].includes(rc)) return error(`Erreur technique Semgrep (code ${rc}).`);
  if (!object(report) || !Array.isArray(report.results) || !Array.isArray(report.errors) || typeof report.version !== 'string') return error('Schéma Semgrep invalide.');
  if (report.errors.length) return error('Semgrep signale au moins une erreur d’analyse.');
  if (!Array.isArray(report.paths?.scanned) || report.paths.scanned.length === 0) return error('Aucun fichier analysé.');
  const scanned = report.paths.scanned.map(f => path.resolve(f));
  if (expectedFiles.some(f => !scanned.includes(path.resolve(f)))) return error('Scan incomplet : un fichier source attendu manque.');
  if (report.results.some(f => !object(f) || typeof f.check_id !== 'string' || !object(f.extra) || f.extra.severity !== 'ERROR')) return error('Résultat Semgrep inattendu.');
  if (rc !== (report.results.length ? 1 : 0)) return error('Code de sortie Semgrep incohérent avec le rapport.');
  return report.results.length ? fail('Appel eval() interdit dans src/.', report.results.length) : pass();
}
export function evaluateSca(report, rc) {
  if (![0,1].includes(rc)) return error(`Erreur technique npm audit (code ${rc}).`);
  if (!object(report) || 'error' in report || report.auditReportVersion !== 2 || !object(report.vulnerabilities) || !object(report.metadata?.vulnerabilities)) return error('Rapport npm audit absent, invalide ou erreur du registre.');
  const counts = report.metadata.vulnerabilities;
  const levels = ['info','low','moderate','high','critical'];
  if (![...levels,'total'].every(k => integer(counts[k]))) return error('Compteurs npm audit invalides.');
  if (levels.reduce((n,k) => n+counts[k],0) !== counts.total) return error('Total npm audit incohérent.');
  const actual = Object.fromEntries(levels.map(k => [k,0]));
  for (const v of Object.values(report.vulnerabilities)) {
    if (!object(v) || !levels.includes(v.severity) || typeof v.name !== 'string' || !Array.isArray(v.via)) return error('Détail npm audit invalide.');
    actual[v.severity]++;
  }
  if (!levels.every(k => actual[k] === counts[k])) return error('Compteurs npm audit incompatibles avec les résultats.');
  const blocking = counts.high + counts.critical;
  if (rc !== (blocking ? 1 : 0)) return error('Code de sortie npm audit incohérent avec le seuil HIGH/CRITICAL.');
  return blocking ? fail('Dépendance HIGH ou CRITICAL.', blocking) : pass();
}
export function evaluateTrivy(report, rc, imageId, database) {
  if (![0,10,11].includes(rc)) return error(`Erreur technique Trivy (code ${rc}).`);
  if (!object(report) || 'error' in report || report.SchemaVersion !== 2 || report.ArtifactType !== 'container_image' || !Array.isArray(report.Results) || report.Results.length === 0) return error('Schéma Trivy invalide ou aucune cible analysée.');
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId) || report.Metadata?.ImageID !== imageId) return error('L’image analysée ne correspond pas à l’image construite.');
  if (!object(report.Metadata?.OS) || !report.Metadata.OS.Family || !report.Results.some(r=>r.Class==='os-pkgs') || !report.Results.some(r=>r.Class==='lang-pkgs' && ['node-pkg','npm'].includes(r.Type))) return error('Couverture attendue OS + npm absente.');
  if (!object(database) || database.Version !== 2 || !['UpdatedAt','NextUpdate','DownloadedAt'].every(k=>typeof database[k]==='string' && Number.isFinite(Date.parse(database[k])))) return error('Métadonnées de la base Trivy absentes ou invalides.');
  if (Date.parse(database.NextUpdate) < Date.now()) return error('Base Trivy périmée : mise à jour requise.');
  if (report.Metadata.OS.Eosl === true || rc === 11) return fail('Système de base en fin de support.', 1);
  let count=0;
  for (const result of report.Results) {
    if (!object(result) || typeof result.Target !== 'string') return error('Cible Trivy invalide.');
    if (result.Vulnerabilities !== undefined && !Array.isArray(result.Vulnerabilities)) return error('Liste Trivy invalide.');
    for (const v of result.Vulnerabilities ?? []) {
      if (!object(v) || typeof v.VulnerabilityID !== 'string' || !['HIGH','CRITICAL'].includes(v.Severity)) return error('Résultat Trivy inattendu pour le filtre HIGH,CRITICAL.');
      count++;
    }
  }
  if (rc !== (count ? 10 : 0)) return error('Code Trivy incohérent avec le rapport.');
  return count ? fail('Image contenant des vulnérabilités HIGH ou CRITICAL.', count) : pass();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [kind, reportFile, rcText, extra] = process.argv.slice(2);
  const run = JSON.parse(fs.readFileSync('.ci/run.json','utf8'));
  let result;
  let report;
  try {
    report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
    const rc=Number(rcText);
    if (kind === 'sast') result=evaluateSast(report,rc,fs.readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>'src/'+f));
    else if (kind === 'sca') result=evaluateSca(report,rc);
    else if (kind === 'image') result=evaluateTrivy(report,rc,extra,JSON.parse(fs.readFileSync('reports/trivy-db.json','utf8')));
    else throw Error('Type de gate inconnu');
  } catch(e) { result=error(`Rapport inexploitable : ${e.message}`); }
  const summary={ runId:run.runId, sourceHash:run.sourceHash, stage:kind, ...result, scannerExitCode:Number(rcText), at:new Date().toISOString() };
  if (fs.existsSync(reportFile)) summary.reportSha256=crypto.createHash('sha256').update(fs.readFileSync(reportFile)).digest('hex');
  if(kind==='image') summary.imageId=extra;
  fs.writeFileSync(`reports/${kind}-gate.json`,JSON.stringify(summary,null,2)+'\n');
  fs.writeFileSync(`reports/${kind}-summary.txt`,`${kind.toUpperCase()} : ${result.status}\n${result.reason}\n`);
  console.log(`${kind.toUpperCase()} : ${result.status} — ${result.reason}`);
  process.exitCode=result.status==='PASS'?0:result.status==='FAIL'?1:2;
}
