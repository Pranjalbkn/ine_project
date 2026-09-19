import { randomUUID } from 'node:crypto';
import { pool } from './db.js';
import { scrapeProduct } from './scraper.js';

export async function listTracked() {
  const result = await pool.query(`
    select t.product_id as "productId", t.name, t.brand, t.category, t.sku,
           t.tracked_at as "trackedAt", h.price, h.currency, h.stock,
           h.scraped_at as "scrapedAt"
      from tracked_products t
      left join lateral (
        select price, currency, stock, scraped_at
          from price_history
         where product_id = t.product_id
         order by scraped_at desc limit 1
      ) h on true
     order by t.tracked_at desc
  `);
  return result.rows;
}

export async function getStats() {
  const result = await pool.query(`
    select (select count(*)::integer from scrape_log) as "totalScrapes",
           (select count(*)::integer from tracked_products) as "trackedProducts",
           (select count(*)::integer from price_history) as "savedPrices"
  `);
  return result.rows[0];
}

export async function isTracked(productId) {
  const result = await pool.query('select 1 from tracked_products where product_id = $1', [productId]);
  return result.rowCount > 0;
}

export async function addTracked(product) {
  const result = await pool.query(`
    insert into tracked_products (product_id, name, brand, category, sku)
    values ($1, $2, $3, $4, $5)
    on conflict (product_id) do update
      set name = excluded.name, brand = excluded.brand,
          category = excluded.category, sku = excluded.sku
    returning product_id as "productId", name, brand, category, sku,
              tracked_at as "trackedAt"
  `, [product.id, product.name, product.brand, product.category, product.sku]);
  return result.rows[0];
}

export async function getHistory(productId) {
  const result = await pool.query(`
    select id, price, currency, stock, scraped_at as "scrapedAt"
      from price_history where product_id = $1 order by scraped_at desc
  `, [productId]);
  return result.rows;
}

export async function getScrapeLog(productId) {
  const result = await pool.query(`
    select id, run_id as "runId", attempt, started_at as "startedAt",
           finished_at as "finishedAt", outcome, error
      from scrape_log where product_id = $1 order by started_at desc, id desc
  `, [productId]);
  return result.rows;
}

async function scrapeAndSave(productId) {
  if (!await isTracked(productId)) throw new Error('Product is not tracked');
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let reading;
  let attemptLog;
  let scrapeError;
  try {
    reading = await scrapeProduct(productId);
    attemptLog = reading.attempts;
  } catch (error) {
    scrapeError = error;
    attemptLog = error.attempts?.length ? error.attempts : [{
      attempt: 1, startedAt, finishedAt: new Date().toISOString(),
      outcome: 'failed', error: error.message,
    }];
  }

  // Save every attempt and the successful reading together.
  const databaseClient = await pool.connect();
  try {
    await databaseClient.query('begin');
    for (const attempt of attemptLog) {
      await databaseClient.query(`
        insert into scrape_log
          (product_id, run_id, attempt, started_at, finished_at, outcome, error)
        values ($1, $2, $3, $4, $5, $6, $7)
      `, [productId, runId, attempt.attempt, attempt.startedAt,
        attempt.finishedAt, attempt.outcome, attempt.error ?? null]);
    }
    if (reading) {
      await databaseClient.query(`
        insert into price_history
          (product_id, price, currency, stock, scraped_at)
        values ($1, $2, $3, $4, $5)
        on conflict (product_id, scraped_at) do nothing
      `, [productId, reading.price, reading.currency, reading.stock, reading.scrapedAt]);
    }
    await databaseClient.query('commit');
  } catch (error) {
    await databaseClient.query('rollback');
    throw error;
  } finally {
    databaseClient.release();
  }
  if (scrapeError) {
    scrapeError.attempts = attemptLog;
    throw scrapeError;
  }
  return reading;
}

const activeTrackedScrapes = new Map();
export function runTrackedScrape(productId) {
  // Share one scrape when two requests ask for the same product at once.
  if (!activeTrackedScrapes.has(productId)) {
    const task = scrapeAndSave(productId)
      .finally(() => activeTrackedScrapes.delete(productId));
    activeTrackedScrapes.set(productId, task);
  }
  return activeTrackedScrapes.get(productId);
}
