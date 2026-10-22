'use strict';
const get = require('lodash/get');

function readPromotionPercent(raw) {
  // Une chaîne de données n'est jamais du code à exécuter.
  if (typeof raw !== 'string' || !/^\d+(?:\.\d+)?$/.test(raw.trim())) {
    throw new RangeError('Remise non valide');
  }
  return Number(raw);
}

function totalFromOrder(order) {
  const amount = Number(get(order, 'cart.price', 0));
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Prix non valide');
  const percent = readPromotionPercent(String(get(order, 'promotion.percent', '0')));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new RangeError('Remise non valide');
  return Number((amount * (1 + percent / 100)).toFixed(2));
}
module.exports = { readPromotionPercent, totalFromOrder };
