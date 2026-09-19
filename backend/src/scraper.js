import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localBrowsers = resolve(dirname(fileURLToPath(import.meta.url)), '../.playwright-browsers');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}
const { chromium } = await import('playwright');

const STORE_ORIGIN = 'https://demo.inelabteamdev.com';
const DEFAULT_ATTEMPTS = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseAmount(text) {
  const clean = text
    .replace(/[\uFF10-\uFF19]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
    .replace(/[\u200b-\u200d\u2060\u00a0]/g, '')
    .replace(/^.*?(?=\d)/s, '')
    .replace(/\/-.*/s, '')
    .trim();
  const match = clean.match(/^([\d.,\s]+)/);
  if (!match) throw new Error(`No numeric price in: ${text}`);
  let number = match[1].replace(/\s/g, '');
  // The store's two decimal formats end in .00 or ,00. Other punctuation
  // separates thousands, including the Indian grouping used by Intl.
  number = number.replace(/[.,]00$/, '').replace(/[.,]/g, '');
  const value = Number(number);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid selling price: ${text}`);
  }
  return value;
}

async function dismissCookies(page) {
  const decline = page.getByRole('button', { name: 'Decline cookies' });
  // This overlay appears after a random delay and can demand several clicks.
  await decline.waitFor({ state: 'visible', timeout: 2_500 }).catch(() => {});
  for (let i = 0; i < 4; i += 1) {
    if (!await decline.isVisible().catch(() => false)) return;
    await decline.click();
    await page.locator('.cookie-overlay').waitFor({ state: 'hidden', timeout: 700 }).catch(() => {});
  }
  if (await decline.isVisible().catch(() => false)) throw new Error('Cookie overlay did not close');
}

async function revealPrice(page) {
  const card = page.locator('.price-block').first();
  await card.waitFor({ state: 'visible', timeout: 25_000 });
  await dismissCookies(page);

  // The storefront requires real pointer movement and a short dwell before
  // it enables the price button. Playwright mouse input creates browser events.
  const box = await card.boundingBox();
  if (!box) throw new Error('Price area has no visible bounding box');
  await page.mouse.move(box.x + 15, box.y + box.height / 2);
  for (let i = 1; i <= 12; i += 1) {
    const x = box.x + 15 + ((box.width - 30) * i) / 13;
    const y = box.y + box.height * (0.35 + (i % 3) * 0.12);
    await page.mouse.move(x, y, { steps: 2 });
    await delay(85);
  }
  await delay(750);

  const button = page.getByRole('button', { name: 'Reveal price' });
  await button.waitFor({ state: 'visible', timeout: 5_000 });
  await dismissCookies(page);
  try {
    await button.click({ timeout: 4_000 });
  } catch (error) {
    // The delayed overlay can arrive between checking and clicking.
    if (!await page.locator('.cookie-overlay').isVisible()) throw error;
    await dismissCookies(page);
    await button.click({ timeout: 4_000 });
  }
  await page.locator('.price-block.price-success').waitFor({ state: 'visible', timeout: 25_000 });
  // A first quote can be marked as pending while the final price is updated.
  await page.locator('.price-block.price-success').getByText('Updating…').waitFor({ state: 'hidden', timeout: 12_000 });
}

async function extractReading(page, expectedName) {
  return page.locator('.price-block.price-success').evaluate((card, expected) => {
    const main = card.querySelector('.price-main');
    const badge = card.querySelector('.stock-badge');
    const heading = document.querySelector('h1');
    if (!main || !badge || !heading) throw new Error('Required product fields are missing');
    const name = heading.textContent.trim();
    if (expected && name !== expected) throw new Error(`Wrong product page: ${name}`);

    // Choose the large, visible selling price. The store also includes a hidden
    // decoy amount, an MRP, and occasionally a separate deal-price label.
    const candidates = [...main.children].filter((element) => {
      const style = getComputedStyle(element);
      return element.getAttribute('aria-hidden') !== 'true'
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && !style.textDecorationLine.includes('line-through')
        && !/^Deal price\b/i.test(element.textContent.trim())
        && !/%\s*off\b/i.test(element.textContent);
    });
    const priceElement = candidates.sort((a, b) =>
      parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize)
    )[0];
    if (!priceElement || parseFloat(getComputedStyle(priceElement).fontSize) < 25) {
      throw new Error('Visible selling price was not found');
    }
    return {
      name,
      rawPrice: priceElement.textContent,
      rawStock: badge.textContent.trim(),
      outOfStock: badge.classList.contains('out-stock'),
    };
  }, expectedName);
}

export function validateReading(raw) {
  const price = parseAmount(raw.rawPrice);
  let stock;
  if (raw.outOfStock && /^Out of stock$/i.test(raw.rawStock)) {
    stock = 0;
  } else {
    const match = raw.rawStock.match(/\b(\d+)\b/);
    if (!match || !raw.rawStock.toLowerCase().includes('stock') && !raw.rawStock.toLowerCase().includes('left')) {
      throw new Error(`Unrecognized stock text: ${raw.rawStock}`);
    }
    stock = Number(match[1]);
    if (!Number.isSafeInteger(stock) || stock <= 0) {
      throw new Error(`Invalid stock count: ${raw.rawStock}`);
    }
  }
  return { name: raw.name, price, currency: 'INR', stock };
}

/** Scrape one INE product and return both its reading and an honest attempt log. */
export async function scrapeProduct(productId, options = {}) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Product ID must be a positive integer');
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const log = [];
  const browser = await chromium.launch({ headless: !options.headed, slowMo: options.headed ? 70 : 0 });
  const context = await browser.newContext();
  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const startedAt = new Date().toISOString();
      const page = await context.newPage();
      try {
        page.setDefaultTimeout(15_000);
        await page.goto(`${STORE_ORIGIN}/product/${id}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const heading = page.locator('h1');
        await heading.waitFor({ state: 'visible', timeout: 25_000 });
        const expectedName = (await heading.textContent())?.trim();
        await revealPrice(page);
        const reading = validateReading(await extractReading(page, expectedName));
        const entry = { attempt, startedAt, finishedAt: new Date().toISOString(), outcome: 'success' };
        log.push(entry);
        options.onAttempt?.(entry);
        return { productId: id, productUrl: `${STORE_ORIGIN}/product/${id}`, ...reading, scrapedAt: entry.finishedAt, attempts: log };
      } catch (error) {
        const entry = {
          attempt, startedAt, finishedAt: new Date().toISOString(),
          outcome: attempt < attempts ? 'retried' : 'failed',
          error: error instanceof Error ? error.message.split('\n')[0] : String(error),
        };
        log.push(entry);
        options.onAttempt?.(entry);
        if (attempt === attempts) {
          const failure = new Error(`Could not scrape product ${id} after ${attempts} attempts: ${entry.error}`);
          failure.attempts = log;
          throw failure;
        }
        await delay(500 * attempt);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
}
