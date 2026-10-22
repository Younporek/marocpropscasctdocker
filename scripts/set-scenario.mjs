import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const choice = process.argv[2];
const choices = ['fixed', 'unit-fail', 'sast-fail', 'sca-fail', 'both-security-fail'];
if (!choices.includes(choice)) { console.error(`Usage: node scripts/set-scenario.mjs ${choices.join('|')}`); process.exit(2); }
const source = fs.readFileSync(path.join(root, 'scenarios/promo.fixed.js.txt'), 'utf8');
let code = source;
if (choice === 'unit-fail') code = code.replace('(1 - percent / 100)', '(1 + percent / 100)');
if (['sast-fail', 'both-security-fail'].includes(choice)) {
  const start = code.indexOf('function readPromotionPercent(raw) {');
  const end = code.indexOf('\n\nfunction totalFromOrder', start);
  code = code.slice(0, start) + 'function readPromotionPercent(raw) {\n  return eval(raw); // Défaut volontaire : SAST seulement, ne pas exploiter.\n}' + code.slice(end);
}
fs.writeFileSync(path.join(root, 'src/promo.js'), code);
const dependency = ['sca-fail', 'both-security-fail'].includes(choice) ? 'vulnerable' : 'fixed';
for (const filename of ['package.json', 'package-lock.json']) {
  fs.copyFileSync(path.join(root, `scenarios/${dependency}.${filename}`), path.join(root, filename));
}
console.log(`Scénario ${choice} activé. Lancer npm ci puis les scripts CI. Commiter ces trois fichiers avant TeamCity.`);
console.log('Ne pas modifier le checkout actif du service TeamCity. Usage en laboratoire isolé uniquement.');
