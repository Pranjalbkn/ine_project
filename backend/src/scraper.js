import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localBrowserFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../.playwright-browsers',
);

if (
  !process.env.PLAYWRIGHT_BROWSERS_PATH &&
  existsSync(localBrowserFolder)
) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserFolder;
}

const { chromium } = await import('playwright');

const STORE_ORIGIN = 'https://demo.inelabteamdev.com';
const DEFAULT_ATTEMPTS = 5;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseAmount(text) {
  const cleanedText = text
    .replace(/[\uFF10-\uFF19]/g, (digit) =>
      String(digit.charCodeAt(0) - 0xff10),
    )
    .replace(/[\u200b-\u200d\u2060\u00a0]/g, '')
    .replace(/^.*?(?=\d)/s, '')
    .replace(/\/.*?$/s, '')
    .trim();

  const match = cleanedText.match(/^([\d.,\s]+)/);

  if (!match) {
    throw new Error(`No numeric price in: ${text}`);
  }

  let numberText = match[1].replace(/\s/g, '');

  numberText = numberText
    .replace(/[.,]00$/, '')
    .replace(/[.,]/g, '');

  const price = Number(numberText);

  if (!Number.isSafeInteger(price) || price <= 0) {
    throw new Error(`Invalid selling price: ${text}`);
  }

  return price;
}

async function dismissCookies(page) {
  const declineButton = page.getByRole(
    'button',
    { name: 'Decline cookies' },
  );

  await declineButton
    .waitFor({
      state: 'visible',
      timeout: 2500,
    })
    .catch(() => {});

  for (
    let clickNumber = 0;
    clickNumber < 4;
    clickNumber += 1
  ) {
    if (
      !await declineButton
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }

    await declineButton.click();

    await page
      .locator('.cookie-overlay')
      .waitFor({
        state: 'hidden',
        timeout: 700,
      })
      .catch(() => {});
  }

  if (
    await declineButton
      .isVisible()
      .catch(() => false)
  ) {
    throw new Error('Cookie overlay did not close');
  }
}

async function revealPrice(page) {
  const priceCard = page
    .locator('.price-block')
    .first();

  await priceCard.waitFor({
    state: 'visible',
    timeout: 25_000,
  });

  await dismissCookies(page);

  const revealButton = page.getByRole(
    'button',
    { name: 'Reveal price' },
  );

  await revealButton.waitFor({
    state: 'visible',
    timeout: 5000,
  });

  // The cookie overlay can arrive while the pointer is moving. Leave and
  // re-enter the card until the store enables its reveal button.
  for (let pass = 0; pass < 3; pass += 1) {
    await dismissCookies(page);

    const bounds = await priceCard.boundingBox();
    if (!bounds) {
      throw new Error('Price area has no visible bounding box');
    }

    await page.mouse.move(bounds.x - 20, bounds.y - 20);
    await page.mouse.move(
      bounds.x + 15,
      bounds.y + bounds.height / 2,
    );

    for (let step = 1; step <= 12; step += 1) {
      const xPosition =
        bounds.x + 15 + ((bounds.width - 30) * step) / 13;
      const yPosition =
        bounds.y + bounds.height * (0.35 + (step % 3) * 0.12);

      await page.mouse.move(xPosition, yPosition, { steps: 2 });
      await delay(85);
    }

    await delay(750);
    await dismissCookies(page);
    if (await revealButton.isEnabled()) break;
  }

  if (!await revealButton.isEnabled()) {
    throw new Error('Price reveal button did not become ready');
  }

  await dismissCookies(page);

  try {
    await revealButton.click({
      timeout: 4000,
    });
  } catch (error) {
    const cookieVisible = await page
      .locator('.cookie-overlay')
      .isVisible()
      .catch(() => false);

    if (!cookieVisible) {
      throw error;
    }

    await dismissCookies(page);

    await revealButton.click({
      timeout: 4000,
    });
  }

  const completedPriceCard = page.locator(
    '.price-block.price-success, .price-block.price-error',
  );
  await completedPriceCard.waitFor({
    state: 'visible',
    timeout: 25_000,
  });

  if (await page.locator('.price-block.price-error').isVisible()) {
    const reason = await page
      .locator('.price-block.price-error .price-substatus')
      .innerText();
    throw new Error(`Store price reveal failed: ${reason}`);
  }

  await page
    .locator('.price-block.price-success')
    .getByText('Updating…')
    .waitFor({
      state: 'hidden',
      timeout: 20_000,
    });
}

async function extractReading(page, expectedName) {
  return page
    .locator('.price-block.price-success')
    .evaluate((priceCard, expected) => {
      const priceArea = priceCard.querySelector(
        '.price-main',
      );

      const stockBadge = priceCard.querySelector(
        '.stock-badge',
      );

      const heading = document.querySelector('h1');

      if (!priceArea || !stockBadge || !heading) {
        throw new Error(
          'Required product fields are missing',
        );
      }

      const name = heading.textContent.trim();

      if (expected && name !== expected) {
        throw new Error(
          `Wrong product page: ${name}`,
        );
      }

      const visiblePrices = [
        ...priceArea.children,
      ].filter((element) => {
        const style = getComputedStyle(element);

        return (
          element.getAttribute('aria-hidden') !== 'true' &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          !style.textDecorationLine.includes(
            'line-through',
          ) &&
          !/^Deal price\b/i.test(
            element.textContent.trim(),
          ) &&
          !/%\s*off\b/i.test(element.textContent)
        );
      });

      const priceElement = visiblePrices.sort(
        (first, second) =>
          parseFloat(
            getComputedStyle(second).fontSize,
          ) -
          parseFloat(
            getComputedStyle(first).fontSize,
          ),
      )[0];

      if (
        !priceElement ||
        parseFloat(
          getComputedStyle(priceElement).fontSize,
        ) < 25
      ) {
        throw new Error(
          'Visible selling price was not found',
        );
      }

      return {
        name,
        rawPrice: priceElement.textContent,
        rawStock: stockBadge.textContent.trim(),
        outOfStock: stockBadge.classList.contains(
          'out-stock',
        ),
      };
    }, expectedName);
}

export function validateReading(rawReading) {
  const price = parseAmount(rawReading.rawPrice);

  let stock;

  if (
    rawReading.outOfStock &&
    /^Out of stock$/i.test(rawReading.rawStock)
  ) {
    stock = 0;
  } else {
    const stockCount = rawReading.rawStock.match(
      /\b(\d+)\b/,
    );

    const stockText =
      rawReading.rawStock.toLowerCase();

    if (
      !stockCount ||
      (
        !stockText.includes('stock') &&
        !stockText.includes('left')
      )
    ) {
      throw new Error(
        `Unrecognized stock text: ${rawReading.rawStock}`,
      );
    }

    stock = Number(stockCount[1]);

    if (
      !Number.isSafeInteger(stock) ||
      stock <= 0
    ) {
      throw new Error(
        `Invalid stock count: ${rawReading.rawStock}`,
      );
    }
  }

  return {
    name: rawReading.name,
    price,
    currency: 'INR',
    stock,
  };
}

/**
 * Scrape one INE product and return
 * both its reading and an honest attempt log.
 */
export async function scrapeProduct(
  productId,
  options = {},
) {
  const numericProductId = Number(productId);

  if (
    !Number.isSafeInteger(numericProductId) ||
    numericProductId <= 0
  ) {
    throw new Error(
      'Product ID must be a positive integer',
    );
  }

  const maximumAttempts =
    options.attempts ?? DEFAULT_ATTEMPTS;

  const attemptLog = [];

  let browser;

  /*
   * Browser mode:
   *
   * options.headless = true  -> headless browser
   * options.headless = false -> headed browser
   *
   * The fallback supports the older options.headed value.
   */
  const headless =
    typeof options.headless === 'boolean'
      ? options.headless
      : !Boolean(options.headed);

  try {
    browser = await chromium.launch({
      headless,
      ...(headless ? { channel: 'chromium' } : {}),
      slowMo: headless ? 0 : 70,
    });
  } catch (error) {
    if (
      error.message.includes(
        "Executable doesn't exist",
      )
    ) {
      throw new Error(
        'Playwright browser is missing. Install Chromium from the backend folder using the README setup command, then restart the backend.',
      );
    }

    throw error;
  }

  const context = await browser.newContext();

  try {
    for (
      let attempt = 1;
      attempt <= maximumAttempts;
      attempt += 1
    ) {
      const startedAt = new Date().toISOString();

      const page = await context.newPage();
      let stage = 'opening the product page';

      try {
        page.setDefaultTimeout(15_000);

        await page.goto(
          `${STORE_ORIGIN}/product/${numericProductId}`,
          {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          },
        );

        stage = 'loading product details';
        const heading = page.locator('h1');

        await heading.waitFor({
          state: 'visible',
          timeout: 25_000,
        });

        const expectedName = (
          await heading.textContent()
        )?.trim();

        stage = 'revealing the live price';
        await revealPrice(page);

        stage = 'reading the price and stock';
        const reading = validateReading(
          await extractReading(
            page,
            expectedName,
          ),
        );

        const attemptRecord = {
          attempt,
          startedAt,
          finishedAt: new Date().toISOString(),
          outcome: 'success',
        };

        attemptLog.push(attemptRecord);

        await options.onAttempt?.(attemptRecord);

        return {
          productId: numericProductId,
          productUrl:
            `${STORE_ORIGIN}/product/${numericProductId}`,
          ...reading,
          scrapedAt: attemptRecord.finishedAt,
          attempts: attemptLog,
        };
      } catch (error) {
        const attemptRecord = {
          attempt,
          startedAt,
          finishedAt: new Date().toISOString(),
          outcome:
            attempt < maximumAttempts
              ? 'retried'
              : 'failed',
          error:
            error instanceof Error
              ? `${stage}: ${error.message.split('\n')[0]}`
              : String(error),
        };

        attemptLog.push(attemptRecord);

        await options.onAttempt?.(attemptRecord);

        if (attempt === maximumAttempts) {
          const failure = new Error(
            `Could not scrape product ${numericProductId} after ${maximumAttempts} attempts: ${attemptRecord.error}`,
          );

          failure.attempts = attemptLog;

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
