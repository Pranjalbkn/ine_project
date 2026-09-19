const STORE_ORIGIN = 'https://demo.inelabteamdev.com';

async function getStoreJson(path, maximumAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await fetch(`${STORE_ORIGIN}${path}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < maximumAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
      }
    }
  }
  throw lastError;
}

/** Get a complete catalog. Store catalog pages shuffle, so fill gaps by ID. */
export async function loadCatalog(onProgress = () => {}) {
  const pageSize = 60;
  const firstPage = await getStoreJson(`/api/catalog?page=1&pageSize=${pageSize}`);
  if (!Number.isSafeInteger(firstPage.total) || firstPage.total < 1 || !Array.isArray(firstPage.items)) {
    throw new Error('Store catalog response is invalid');
  }
  const productsById = new Map(firstPage.items.map((product) => [product.id, product]));
  for (let pass = 1; pass <= 7 && productsById.size < firstPage.total; pass += 1) {
    for (let page = 1; page <= firstPage.pages; page += 1) {
      // Repeated, slowly paced passes are much gentler than hundreds of
      // simultaneous detail requests and compensate for randomized ordering.
      if (pass === 1 && page === 1) continue;
      try {
        const pageData = await getStoreJson(`/api/catalog?page=${page}&pageSize=${pageSize}`);
        for (const product of pageData.items ?? []) {
          productsById.set(product.id, product);
        }
      } catch (error) {
        onProgress(`Catalog page ${page} failed on pass ${pass}: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    onProgress(`Catalog pass ${pass}: ${productsById.size}/${firstPage.total} products`);
  }

  // The mock catalog uses integer product IDs from 1 through total. Its
  // shuffled pages are only an optimization, never proof of full coverage.
  const missingIds = Array.from({ length: firstPage.total }, (_, index) => index + 1)
    .filter((productId) => !productsById.has(productId));
  onProgress(`Checking ${missingIds.length} remaining products by ID`);
  const failures = [];
  for (const productId of missingIds) {
    try {
      const product = await getStoreJson(`/api/product/${productId}`);
      if (product.id !== productId || !product.name) {
        throw new Error(`Invalid product ${productId}`);
      }
      productsById.set(productId, product);
    } catch (error) {
      failures.push(`${productId}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (failures.length || productsById.size !== firstPage.total) {
    throw new Error(
      `Catalog incomplete (${productsById.size}/${firstPage.total}); ${failures.slice(0, 10).join('; ')}`,
    );
  }
  return [...productsById.values()]
    .map(({ id, name, brand, category, sku }) => ({ id, name, brand, category, sku }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function searchCatalog(products, query) {
  const searchText = query.trim().toLocaleLowerCase();
  if (!searchText) throw new Error('Enter a product name or part of one');
  return products.filter((product) => product.name.toLocaleLowerCase().includes(searchText));
}
