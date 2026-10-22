import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const stages = ['tests','sast','sca','build','image','deploy'];
const reportFor = {tests:'tests.txt',sast:'sast.json',sca:'sca.json',build:'image.json',image:'trivy.json',deploy:'smoke.json'};
const hashFile = name => crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
function clearRelease() { fs.rmSync(path.join(root,'release'),{recursive:true,force:true}); fs.mkdirSync(path.join(root,'release')); }
const write = (name, value) => fs.writeFileSync(name, JSON.stringify(value, null, 2) + '\n');
function files(p) { return fs.statSync(p).isDirectory() ? fs.readdirSync(p).sort().flatMap(n => files(path.join(p, n))) : [p]; }
function fingerprint() {
  const hash = crypto.createHash('sha256');
  for (const p of ['src','tests','rules','ci','scripts','package.json','package-lock.json','Dockerfile','.dockerignore']) {
    for (const f of files(p)) hash.update(f).update('\0').update(fs.readFileSync(f)).update('\0');
  }
  return hash.digest('hex');
}
function context() {
  const run = read('.ci/run.json');
  if (run.sourceHash !== fingerprint()) throw Error('Sources modifiées depuis le début : relancer étape 01.');
  if ((process.env.BUILD_NUMBER || 'local') !== run.buildNumber) throw Error('Rapport d’un autre build : relancer étape 01.');
  return run;
}
function status(stage, state, detail={}) {
  const run = context();
  if (state === 'PASS') detail.reportSha256 = hashFile('reports/'+reportFor[stage]);
  write(`reports/${stage}-gate.json`, { runId:run.runId, sourceHash:run.sourceHash, stage, status:state, at:new Date().toISOString(), ...detail });
}
try {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'init') {
    // Nettoyage uniquement des trois répertoires de sortie dédiés de CE dépôt.
    for (const name of ['reports','release','.ci']) {
      const target = path.join(root, name);
      if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw Error(`Lien symbolique interdit : ${name}`);
      fs.rmSync(target, { recursive:true, force:true });
      fs.mkdirSync(target);
    }
    write('.ci/run.json', { runId:crypto.randomUUID(), sourceHash:fingerprint(), buildNumber:process.env.BUILD_NUMBER || 'local', startedAt:new Date().toISOString() });
    fs.copyFileSync('.ci/run.json','reports/run.json');
  } else if (cmd === 'context') { context(); }
  else if (cmd === 'begin') {
    context();
    const index = stages.indexOf(args[0]);
    if(index < 0) throw Error('Étape inconnue');
    clearRelease();
    for(const stage of stages.slice(index)) fs.rmSync(`reports/${stage}-gate.json`,{force:true});
    if(index <= 3) { fs.rmSync('reports/image.json',{force:true}); fs.rmSync('.ci/image-id',{force:true}); }
  }
  else if (cmd === 'require') {
    const run = context();
    for (const stage of args) {
      const g = read(`reports/${stage}-gate.json`);
      if (g.status !== 'PASS' || g.runId !== run.runId || g.sourceHash !== run.sourceHash) throw Error(`Gate ${stage} absent, périmé ou non PASS.`);
      if(g.reportSha256 !== hashFile('reports/'+reportFor[stage])) throw Error(`Rapport ${stage} modifié après validation.`);
    }
  } else if (cmd === 'clear') {
    context();
    for (const name of args) {
      if (!/^[a-z0-9-]+\.(json|txt|log)$/.test(name)) throw Error('Nom de rapport non autorisé');
      fs.rmSync(path.join('reports',name), {force:true});
    }
  } else if (cmd === 'pass') status(args[0], 'PASS');
  else if (cmd === 'result') {
    if(!stages.includes(args[0]) || !['FAIL','ERROR'].includes(args[1])) throw Error('Résultat invalide');
    status(args[0],args[1],{reason:args[2]});
  }
  else if (cmd === 'fail') {
    clearRelease();
    try {
      const run = context();
      const p = `reports/${args[0]}-gate.json`;
      let previous;
      if (fs.existsSync(p)) previous = read(p);
      if (!(previous?.runId === run.runId && ['FAIL','ERROR'].includes(previous.status))) status(args[0], 'ERROR', { exitCode:Number(args[1]), reason:'Étape interrompue. Voir les journaux.' });
    } catch(e) { console.error(`Rapport impossible : ${e.message}`); fs.writeFileSync('reports/pipeline-error.txt', e.message+'\n'); }
  } else throw Error('Commande state inconnue');
} catch (e) { console.error(e.message); process.exitCode=2; }
