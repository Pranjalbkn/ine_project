export function formatPrice(amount, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIndiaDateTime(value) {
  const date = new Date(value);
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)} IST`;
}

export function formatIndiaChartDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
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
