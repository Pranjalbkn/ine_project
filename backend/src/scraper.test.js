import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, validateReading } from './scraper.js';

test('store price formats all resolve to the same integer rupee amount', () => {
  for (const shown of [
    '₹4,198', '₹4 198', '₹4.198,00', 'Rs.\u00a04,198.00',
    '₹４,１９８', '₹4\u00a0\u200b,\u00a01\u00a0\u200b9\u00a0\u200b8',
    '₹4,198/- (incl. of all taxes)',
  ]) assert.equal(parseAmount(shown), 4198, shown);
});

test('stock and invalid readings are distinguished', () => {
  assert.equal(validateReading({ name: 'A', rawPrice: '₹4,198', rawStock: 'Only 5 left', outOfStock: false }).stock, 5);
  assert.equal(validateReading({ name: 'A', rawPrice: '₹4,198', rawStock: 'Out of stock', outOfStock: true }).stock, 0);
  assert.throws(() => validateReading({ name: 'A', rawPrice: 'Price hidden', rawStock: 'Only 5 left', outOfStock: false }));
  assert.throws(() => validateReading({ name: 'A', rawPrice: '₹4,198', rawStock: 'Availability unknown', outOfStock: false }));
});
