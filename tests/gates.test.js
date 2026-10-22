'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
let gates;
async function load() { gates ??= await import('../ci/gates.mjs'); return gates; }
const sast = () => ({version:'1.182.0',results:[],errors:[],paths:{scanned:['src/promo.js','src/server.js']}});
const sca = () => ({auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}});
const imageId = 'sha256:'+'a'.repeat(64);
const db = () => ({Version:2,UpdatedAt:new Date().toISOString(),DownloadedAt:new Date().toISOString(),NextUpdate:new Date(Date.now()+3600000).toISOString()});
const trivy = () => ({SchemaVersion:2,ArtifactType:'container_image',Metadata:{ImageID:imageId,OS:{Family:'debian',Name:'12'}},Results:[{Target:'debian',Class:'os-pkgs',Type:'debian'},{Target:'Node.js',Class:'lang-pkgs',Type:'node-pkg'}]});
test('SAST : succès, défaut, erreur et analyse partielle',async()=>{
  const {evaluateSast:f}=await load();
  assert.equal(f(sast(),0,['src/promo.js']).status,'PASS');
  const hit=sast();hit.results=[{check_id:'no-eval',extra:{severity:'ERROR'}}];
  assert.equal(f(hit,1).status,'FAIL');
  assert.equal(f(hit,0).status,'ERROR');
  assert.equal(f(sast(),2).status,'ERROR');
  const bad=sast();bad.errors=[{message:'parse error'}];assert.equal(f(bad,0).status,'ERROR');
  const empty=sast();empty.paths.scanned=[];assert.equal(f(empty,0).status,'ERROR');
  assert.equal(f(sast(),0,['src/missing.js']).status,'ERROR');
  assert.equal(f({},0).status,'ERROR');
});
test('SCA : succès, HIGH, erreur réseau et faux compteurs',async()=>{
  const {evaluateSca:f}=await load();
  assert.equal(f(sca(),0).status,'PASS');
  const hit=sca();hit.vulnerabilities.lodash={name:'lodash',severity:'high',via:[]};hit.metadata.vulnerabilities.high=1;hit.metadata.vulnerabilities.total=1;
  assert.equal(f(hit,1).status,'FAIL');
  assert.equal(f(hit,0).status,'ERROR');
  assert.equal(f({error:{code:'ENOAUDIT'}},1).status,'ERROR');
  assert.equal(f(sca(),1).status,'ERROR');
  const malformed=sca();malformed.metadata.vulnerabilities.high='0';assert.equal(f(malformed,0).status,'ERROR');
  const inconsistent=sca();inconsistent.metadata.vulnerabilities.total=1;assert.equal(f(inconsistent,0).status,'ERROR');
  assert.equal(f({},0).status,'ERROR');
});
test('Trivy : seuil, scanner défaillant, image différente, DB absente et couverture',async()=>{
  const {evaluateTrivy:f}=await load();
  assert.equal(f(trivy(),0,imageId,db()).status,'PASS');
  const hit=trivy();hit.Results[0].Vulnerabilities=[{VulnerabilityID:'TEST-NOT-A-REAL-CVE',Severity:'HIGH'}];
  assert.equal(f(hit,10,imageId,db()).status,'FAIL');
  assert.equal(f(hit,0,imageId,db()).status,'ERROR');
  assert.equal(f(trivy(),1,imageId,db()).status,'ERROR');
  assert.equal(f(trivy(),0,'sha256:'+'b'.repeat(64),db()).status,'ERROR');
  assert.equal(f(trivy(),0,imageId,{}).status,'ERROR');
  const old=db();old.NextUpdate='2000-01-01T00:00:00Z';assert.equal(f(trivy(),0,imageId,old).status,'ERROR');
  const noNpm=trivy();noNpm.Results.pop();assert.equal(f(noNpm,0,imageId,db()).status,'ERROR');
  const eos=trivy();eos.Metadata.OS.Eosl=true;assert.equal(f(eos,11,imageId,db()).status,'FAIL');
  assert.equal(f({},0,imageId,db()).status,'ERROR');
});
