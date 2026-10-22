'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');
test('HTTP : santé, devis, saisie invalide et route inconnue', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: 'ok', app: 'MarocPromo' });
  assert.deepEqual(await (await fetch(`${base}/quote?amount=200&discount=15`)).json(), { total: 170, currency: 'MAD' });
  assert.equal((await fetch(`${base}/quote?discount=abc`)).status, 400);
  assert.equal((await fetch(`${base}/absent`)).status, 404);
});
