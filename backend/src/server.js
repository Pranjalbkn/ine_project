import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

import { searchCatalog } from './catalog.js';
import { scrapeProduct } from './scraper.js';
import { pool, requireDatabase } from './db.js';
import {
  addTracked,
  getHistory,
  getRecentScrapeLog,
  getScrapeLog,
  getStats,
  isTracked,
  listTracked,
  runTrackedScrape,
} from './tracking.js';

const backendFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);

const { products } = JSON.parse(
  await readFile(
    resolve(backendFolder, 'data/catalog.json'),
    'utf8',
  ),
);

if (!Array.isArray(products) || !products.length) {
  throw new Error('Catalog cache is missing or invalid');
}

const productIds = new Set(
  products.map((product) => product.id),
);

const productById = new Map(
  products.map((product) => [product.id, product]),
);

const app = express();

const allowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

function getProductId(req, res) {
  const productId = Number(req.params.id);

  if (
    !Number.isSafeInteger(productId) ||
    !productIds.has(productId)
  ) {
    res.status(404).json({
      error: 'Product not found in the INE catalog',
    });

    return null;
  }

  return productId;
}

async function fetchStoreProduct(productId) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://demo.inelabteamdev.com/api/product/${productId}`,
        {
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        throw new Error(
          `INE store returned HTTP ${response.status}`,
        );
      }

      const product = await response.json();

      if (product.id !== productId || !product.name) {
        throw new Error('INE store returned an invalid product');
      }

      delete product.reviews;

      return product;
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * attempt),
        );
      }
    }
  }

  throw lastError;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    catalogCount: products.length,
  });
});

app.get('/api/products', (req, res) => {
  const query = String(
    req.query.search ?? '',
  ).trim();

  if (!query) {
    return res.json({
      query,
      total: 0,
      products: [],
    });
  }

  const matches = searchCatalog(products, query);

  res.json({
    query,
    total: matches.length,
    products: matches,
  });
});

app.get('/api/products/:id', async (req, res) => {
  const productId = getProductId(req, res);

  if (productId === null) return;

  try {
    const product = await fetchStoreProduct(productId);

    res.json({
      product,
      storeUrl: `https://demo.inelabteamdev.com/product/${productId}`,
    });
  } catch (error) {
    res.status(502).json({
      error: `Could not load details: ${error.message}`,
    });
  }
});

function databaseError(res, error) {
  console.error(
    'Database request failed:',
    error.message,
  );

  return res.status(502).json({
    error: ['EACCES', 'ENETUNREACH', 'EHOSTUNREACH'].includes(error.code)
      ? 'Cannot reach Supabase. If this network cannot use the direct IPv6 address, set DATABASE_URL to the Supabase session pooler connection string.'
      : 'Database unavailable. Check DATABASE_URL and run npm run db:migrate.',
  });
}

app.get(
  '/api/tracked',
  requireDatabase,
  async (_req, res) => {
    try {
      res.json({
        products: await listTracked(),
      });
    } catch (error) {
      databaseError(res, error);
    }
  },
);

app.get(
  '/api/stats',
  requireDatabase,
  async (_req, res) => {
    try {
      res.json(await getStats());
    } catch (error) {
      databaseError(res, error);
    }
  },
);

app.get(
  '/api/scrape-log',
  requireDatabase,
  async (_req, res) => {
    try {
      res.json({ log: await getRecentScrapeLog() });
    } catch (error) {
      databaseError(res, error);
    }
  },
);

app.post(
  '/api/tracked/:id',
  requireDatabase,
  async (req, res) => {
    const productId = getProductId(req, res);

    if (productId === null) return;

    try {
      const product = await addTracked(
        productById.get(productId),
      );

      // Clear both headless and headed cache entries
      recentReadings.delete(`${productId}:true`);
      recentReadings.delete(`${productId}:false`);

      res.status(201).json({
        product,
      });
    } catch (error) {
      databaseError(res, error);
    }
  },
);

app.get(
  '/api/tracked/:id/history',
  requireDatabase,
  async (req, res) => {
    const productId = getProductId(req, res);

    if (productId === null) return;

    try {
      res.json({
        history: await getHistory(productId),
      });
    } catch (error) {
      databaseError(res, error);
    }
  },
);

app.get(
  '/api/tracked/:id/log',
  requireDatabase,
  async (req, res) => {
    const productId = getProductId(req, res);

    if (productId === null) return;

    try {
      res.json({
        log: await getScrapeLog(productId),
      });
    } catch (error) {
      databaseError(res, error);
    }
  },
);

// Price check cache and active requests
const recentReadings = new Map();
const activePriceChecks = new Map();

app.post(
  '/api/products/:id/price-check',
  async (req, res) => {
    const productId = getProductId(req, res);

    if (productId === null) return;

    // Default to headless mode
    const { headless = true } = req.body ?? {};

    // Validate browser mode
    if (typeof headless !== 'boolean') {
      return res.status(400).json({
        error: '`headless` must be a boolean',
      });
    }

    let isProductTracked = false;

    if (pool) {
      try {
        isProductTracked = await isTracked(productId);
      } catch (error) {
        return databaseError(res, error);
      }
    }

    // Separate cache for headed and headless modes
    const cacheKey = `${productId}:${headless}`;

    const cachedReading = recentReadings.get(cacheKey);

    if (
      !isProductTracked &&
      cachedReading &&
      Date.now() - cachedReading.time < 120_000
    ) {
      return res.json({
        reading: cachedReading.reading,
        cached: true,
        headless,
      });
    }

    try {
      let reading;

      if (isProductTracked) {
        reading = await runTrackedScrape(
          productId,
          {
            headless,
          },
        );
      } else {
        if (!activePriceChecks.has(cacheKey)) {
          const task = scrapeProduct(
            productId,
            {
              headless,
            },
          ).finally(() => {
            activePriceChecks.delete(cacheKey);
          });

          activePriceChecks.set(cacheKey, task);
        }

        reading = await activePriceChecks.get(cacheKey);
      }

      recentReadings.set(cacheKey, {
        reading,
        time: Date.now(),
      });

      res.json({
        reading,
        cached: false,
        saved: isProductTracked,
        headless,
      });
    } catch (error) {
      res.status(502).json({
        error: error.message,
        attempts: error.attempts ?? [],
      });
    }
  },
);

function validCronSecret(value) {
  const expected = process.env.CRON_SECRET;

  if (
    !expected ||
    expected === 'replace-with-a-long-random-secret'
  ) {
    return false;
  }

  const supplied = value?.startsWith('Bearer ')
    ? value.slice(7)
    : '';

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(
      suppliedBuffer,
      expectedBuffer,
    )
  );
}

let scheduledScrapeRunning = false;

app.post(
  '/api/jobs/scrape',
  requireDatabase,
  async (req, res) => {
    if (
      !validCronSecret(
        req.get('authorization'),
      )
    ) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    if (scheduledScrapeRunning) {
      return res.status(409).json({
        error: 'A scrape run is already in progress',
      });
    }

    scheduledScrapeRunning = true;

    try {
      const trackedProducts = await listTracked();
      const results = [];

      for (const product of trackedProducts) {
        try {
          // Scheduled scraping always uses headless mode
          const reading = await runTrackedScrape(
            product.productId,
            {
              headless: true,
            },
          );

          recentReadings.set(
            `${product.productId}:true`,
            {
              reading,
              time: Date.now(),
            },
          );

          results.push({
            productId: product.productId,
            outcome: 'success',
            attempts: reading.attempts.length,
          });
        } catch (error) {
          results.push({
            productId: product.productId,
            outcome: 'failed',
            error: error.message,
          });
        }
      }

      res.json({
        started: trackedProducts.length,
        results,
      });
    } catch (error) {
      databaseError(res, error);
    } finally {
      scheduledScrapeRunning = false;
    }
  },
);

const port = Number(
  process.env.PORT || 3001,
);

app.listen(port, () => {
  console.log(
    `INE API listening on http://127.0.0.1:${port}`,
  );
});
