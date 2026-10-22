'use strict';
const http = require('node:http');
const { totalFromOrder } = require('./promo');
function createServer() {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') return reply(405, { error: 'GET uniquement' });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') return reply(200, { status: 'ok', app: 'MarocPromo' });
    if (url.pathname === '/quote') {
      // La même validation est conservée dans TOUS les scénarios.
      // Le scénario eval est destiné au SAST, pas à une exploitation HTTP.
      const amount = url.searchParams.get('amount') ?? '200';
      const discount = url.searchParams.get('discount') ?? '15';
      if (![amount, discount].every(v => /^\d+(?:\.\d+)?$/.test(v) && v.length <= 12)) {
        return reply(400, { error: 'Paramètres numériques attendus' });
      }
      try {
        return reply(200, { total: totalFromOrder({ cart: { price: amount }, promotion: { percent: discount } }), currency: 'MAD' });
      } catch { return reply(400, { error: 'Prix ou remise non valide' }); }
    }
    reply(404, { error: 'Utiliser /health ou /quote?amount=200&discount=15' });
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer().listen(port, host, () => console.log(`MarocPromo écoute sur ${host}:${port}`));
  process.on('SIGTERM', () => server.close());
}
module.exports = { createServer };
