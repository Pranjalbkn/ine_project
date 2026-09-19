export function formatPrice(amount, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSpecLabel(key) {
  if (key === 'weightGrams') return 'Weight';
  const words = key.replace(/([A-Z])/g, ' $1');
  return words.replace(/^./, (letter) => letter.toUpperCase());
}

export function formatSpecValue(key, value) {
  if (key === 'weightGrams') {
    return value >= 1000 ? `${(value / 1000).toFixed(2)} kg` : `${value} g`;
  }
  return String(value);
}
