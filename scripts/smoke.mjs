import assert from 'node:assert/strict';
let last;
for (let attempt=1; attempt<=20; attempt++) {
  try {
    const health=await fetch('http://127.0.0.1:18080/health',{signal:AbortSignal.timeout(2000)});
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{status:'ok',app:'MarocPromo'});
    const quote=await fetch('http://127.0.0.1:18080/quote?amount=200&discount=15',{signal:AbortSignal.timeout(2000)});
    assert.equal(quote.status,200);
    assert.deepEqual(await quote.json(),{total:170,currency:'MAD'});
    console.log(JSON.stringify({status:'PASS',health:true,quote:170,currency:'MAD',at:new Date().toISOString()},null,2));
    process.exit(0);
  } catch(e) { last=e; await new Promise(resolve=>setTimeout(resolve,1000)); }
}
console.error(`Smoke test en échec : ${last?.message}`);
process.exit(1);
