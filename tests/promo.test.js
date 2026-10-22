'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { totalFromOrder } = require('../src/promo');
const quote = (price, percent) => totalFromOrder({ cart: { price }, promotion: { percent } });
test('200 MAD moins 15 % = 170 MAD', () => assert.equal(quote(200, '15'), 170));
test('sans remise, le prix ne change pas', () => assert.equal(quote(125, '0'), 125));
test('remise de 100 % = gratuit', () => assert.equal(quote(200, '100'), 0));
test('arrondi à deux décimales', () => assert.equal(quote(19.99, '15'), 16.99));
test('rejeter prix négatif et remise supérieure à 100', () => {
  assert.throws(() => quote(-1, '10'), RangeError);
  assert.throws(() => quote(200, '101'), RangeError);
});
