# Design note

## The simple explanation

The React page lets a user search and choose a product. The Express API runs a
Playwright browser to reveal that product's selling price and stock on INE's
mock store. Supabase stores the products being tracked, valid readings, and a
log of scrape attempts. GitHub Actions calls the API's protected job every two
hours.

## Why these parts exist

- **Catalog snapshot:** The store shuffles its catalog pages, so a saved list
  of product names makes partial-name search fast and predictable. A separate
  command refreshes the snapshot.
- **Browser scraper:** The current price is hidden until pointer interaction.
  Reading the rendered page is more dependable than guessing from an API
  response or parsing its HTML without the interaction.
- **Three database tables:** `tracked_products` answers what to check;
  `price_history` contains valid readings; `scrape_log` records every success,
  retry, or failure. A failed scrape cannot create a misleading price row.
- **One scheduled endpoint:** The same scraper handles manual checks and
  scheduled checks. A secret protects the job from arbitrary callers, and
  GitHub Actions provides the two-hour trigger and a visible run result.

## Failure handling

The scraper retries each product up to three times. It checks the product page,
visible selling price, currency, and stock before saving a reading. Each
attempt is logged, including error text on failures. The scheduled job checks
products one at a time and continues to the next product if one fails. The
GitHub workflow fails when any product fails, making the problem visible.

## Tradeoffs

The local catalog must be refreshed if the store adds or removes products.
Sequential scraping is easy to understand and avoids hitting the mock store
too hard, but it takes longer as more products are tracked. GitHub's schedule
can be delayed, so the Actions run history and Supabase log are the source of
truth for whether each check actually happened.
