import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, validateReading } from './scraper.js';

test('store price formats all resolve to the same integer rupee amount', () => {
  for (const displayedPrice of [
    '₹4,198', '₹4 198', '₹4.198,00', 'Rs.\u00a04,198.00',
    '₹４,１９８', '₹4\u00a0\u200b,\u00a01\u00a0\u200b9\u00a0\u200b8',
    '₹4,198/- (incl. of all taxes)',
  ]) {
    assert.equal(parseAmount(displayedPrice), 4198, displayedPrice);
  }
});

test('stock and invalid readings are distinguished', () => {
  const availableProduct = {
    name: 'A', rawPrice: '₹4,198', rawStock: 'Only 5 left', outOfStock: false,
  };
  const soldOutProduct = {
    name: 'A', rawPrice: '₹4,198', rawStock: 'Out of stock', outOfStock: true,
  };
  assert.equal(validateReading(availableProduct).stock, 5);
  assert.equal(validateReading(soldOutProduct).stock, 0);
  assert.throws(() => validateReading({ ...availableProduct, rawPrice: 'Price hidden' }));
  assert.throws(() => validateReading({ ...availableProduct, rawStock: 'Availability unknown' }));
});
