import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { searchCatalog } from './catalog.js';
import { scrapeProduct } from './scraper.js';
import { pool, requireDatabase } from './db.js';
import { addTracked, getHistory, getScrapeLog, isTracked, listTracked, runTrackedScrape } from './tracking.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { products } = JSON.parse(await readFile(resolve(root, 'data/catalog.json'), 'utf8'));
if (!Array.isArray(products) || !products.length) throw new Error('Catalog cache is missing or invalid');
const productIds = new Set(products.map((product) => product.id));
const productById = new Map(products.map((product) => [product.id, product]));
const app = express();
const allowedOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173', process.env.FRONTEND_ORIGIN].filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

function validId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || !productIds.has(id)) {
    res.status(404).json({ error: 'Product not found in the INE catalog' });
    return null;
  }
  return id;
}

async function storeProduct(id) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://demo.inelabteamdev.com/api/product/${id}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`INE store returned HTTP ${response.status}`);
      const product = await response.json();
      if (product.id !== id || !product.name) throw new Error('INE store returned an invalid product');
      return product;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', catalogCount: products.length }));

app.get('/api/products', (req, res) => {
  const query = String(req.query.search ?? '').trim();
  if (!query) return res.json({ query, total: 0, products: [] });
  const matches = searchCatalog(products, query);
  res.json({ query, total: matches.length, products: matches });
});

app.get('/api/products/:id', async (req, res) => {
  const id = validId(req, res);
  if (id === null) return;
  try {
    const product = await storeProduct(id);
    res.json({ product, storeUrl: `https://demo.inelabteamdev.com/product/${id}` });
  } catch (error) {
    res.status(502).json({ error: `Could not load details: ${error.message}` });
  }
});

function databaseError(res, error) {
  console.error('Database request failed:', error.message);
  return res.status(502).json({ error: 'Database unavailable. Check DATABASE_URL and run npm run db:migrate.' });
}

app.get('/api/tracked', requireDatabase, async (_req, res) => {
  try {
    res.json({ products: await listTracked() });
  } catch (error) {
    databaseError(res, error);
  }
});

app.post('/api/tracked/:id', requireDatabase, async (req, res) => {
  const id = validId(req, res);
  if (id === null) return;
  try {
    const product = await addTracked(productById.get(id));
    recentReadings.delete(id);
    res.status(201).json({ product });
  } catch (error) {
    databaseError(res, error);
  }
});

app.get('/api/tracked/:id/history', requireDatabase, async (req, res) => {
  const id = validId(req, res);
  if (id === null) return;
  try {
    res.json({ history: await getHistory(id) });
  } catch (error) {
    databaseError(res, error);
  }
});

app.get('/api/tracked/:id/log', requireDatabase, async (req, res) => {
  const id = validId(req, res);
  if (id === null) return;
  try {
    res.json({ log: await getScrapeLog(id) });
  } catch (error) {
    databaseError(res, error);
  }
});

const recentReadings = new Map();
const inProgress = new Map();
app.post('/api/products/:id/price-check', async (req, res) => {
  const id = validId(req, res);
  if (id === null) return;
  let tracked = false;
  if (pool) {
    try {
      tracked = await isTracked(id);
    } catch (error) {
      return databaseError(res, error);
    }
  }
  const recent = recentReadings.get(id);
  if (recent && Date.now() - recent.time < 120_000) {
    return res.json({ reading: recent.reading, cached: true });
  }
  try {
    let reading;
    if (tracked) {
      reading = await runTrackedScrape(id);
    } else {
      if (!inProgress.has(id)) {
        const task = scrapeProduct(id).finally(() => inProgress.delete(id));
        inProgress.set(id, task);
      }
      reading = await inProgress.get(id);
    }
    recentReadings.set(id, { reading, time: Date.now() });
    res.json({ reading, cached: false, saved: tracked });
  } catch (error) {
    res.status(502).json({ error: error.message, attempts: error.attempts ?? [] });
  }
});

function validCronSecret(value) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected === 'replace-with-a-long-random-secret') return false;
  const supplied = value?.startsWith('Bearer ') ? value.slice(7) : '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

let cronRunning = false;
app.post('/api/jobs/scrape', requireDatabase, async (req, res) => {
  if (!validCronSecret(req.get('authorization'))) return res.status(401).json({ error: 'Unauthorized' });
  if (cronRunning) return res.status(409).json({ error: 'A scrape run is already in progress' });
  cronRunning = true;
  try {
    const tracked = await listTracked();
    const results = [];
    for (const product of tracked) {
      try {
        const reading = await runTrackedScrape(product.productId);
        recentReadings.set(product.productId, { reading, time: Date.now() });
        results.push({ productId: product.productId, outcome: 'success', attempts: reading.attempts.length });
      } catch (error) {
        results.push({ productId: product.productId, outcome: 'failed', error: error.message });
      }
    }
    res.json({ started: tracked.length, results });
  } catch (error) {
    databaseError(res, error);
  } finally {
    cronRunning = false;
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`INE API listening on http://127.0.0.1:${port}`));
