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

async function scrapeAndPersist(productId) {
  if (!await isTracked(productId)) throw new Error('Product is not tracked');
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let reading;
  let attempts;
  let scrapeError;
  try {
    reading = await scrapeProduct(productId);
    attempts = reading.attempts;
  } catch (error) {
    scrapeError = error;
    attempts = error.attempts?.length ? error.attempts : [{
      attempt: 1, startedAt, finishedAt: new Date().toISOString(),
      outcome: 'failed', error: error.message,
    }];
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const attempt of attempts) {
      await client.query(`
        insert into scrape_log
          (product_id, run_id, attempt, started_at, finished_at, outcome, error)
        values ($1, $2, $3, $4, $5, $6, $7)
      `, [productId, runId, attempt.attempt, attempt.startedAt,
        attempt.finishedAt, attempt.outcome, attempt.error ?? null]);
    }
    if (reading) {
      await client.query(`
        insert into price_history
          (product_id, price, currency, stock, scraped_at)
        values ($1, $2, $3, $4, $5)
        on conflict (product_id, scraped_at) do nothing
      `, [productId, reading.price, reading.currency, reading.stock, reading.scrapedAt]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  if (scrapeError) {
    scrapeError.attempts = attempts;
    throw scrapeError;
  }
  return reading;
}

const activeRuns = new Map();
export function runTrackedScrape(productId) {
  if (!activeRuns.has(productId)) {
    const task = scrapeAndPersist(productId).finally(() => activeRuns.delete(productId));
    activeRuns.set(productId, task);
  }
  return activeRuns.get(productId);
}
