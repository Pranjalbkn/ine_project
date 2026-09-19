const STORE_ORIGIN = 'https://demo.inelabteamdev.com';

async function getJson(path, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${STORE_ORIGIN}${path}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
  throw lastError;
}

/** Get a complete catalog. Store catalog pages shuffle, so fill gaps by ID. */
export async function loadCatalog(onProgress = () => {}) {
  const pageSize = 60;
  const first = await getJson(`/api/catalog?page=1&pageSize=${pageSize}`);
  if (!Number.isSafeInteger(first.total) || first.total < 1 || !Array.isArray(first.items)) {
    throw new Error('Store catalog response is invalid');
  }
  const products = new Map(first.items.map((item) => [item.id, item]));
  for (let pass = 1; pass <= 7 && products.size < first.total; pass += 1) {
    for (let page = 1; page <= first.pages; page += 1) {
      // Repeated, slowly paced passes are much gentler than hundreds of
      // simultaneous detail requests and compensate for randomized ordering.
      if (pass === 1 && page === 1) continue;
      try {
        const data = await getJson(`/api/catalog?page=${page}&pageSize=${pageSize}`);
        for (const item of data.items ?? []) products.set(item.id, item);
      } catch (error) {
        onProgress(`Catalog page ${page} failed on pass ${pass}: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    onProgress(`Catalog pass ${pass}: ${products.size}/${first.total} products`);
  }

  // The mock catalog uses integer product IDs from 1 through total. Its
  // shuffled pages are only an optimization, never proof of full coverage.
  const missing = Array.from({ length: first.total }, (_, index) => index + 1)
    .filter((id) => !products.has(id));
  onProgress(`Checking ${missing.length} remaining products by ID`);
  const failures = [];
  for (const id of missing) {
    try {
      const item = await getJson(`/api/product/${id}`);
      if (item.id !== id || !item.name) throw new Error(`Invalid product ${id}`);
      products.set(id, item);
    } catch (error) {
      failures.push(`${id}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (failures.length || products.size !== first.total) {
    throw new Error(`Catalog incomplete (${products.size}/${first.total}); ${failures.slice(0, 10).join('; ')}`);
  }
  return [...products.values()]
    .map(({ id, name, brand, category, sku }) => ({ id, name, brand, category, sku }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function searchCatalog(products, query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) throw new Error('Enter a product name or part of one');
  return products.filter((product) => product.name.toLocaleLowerCase().includes(term));
}
