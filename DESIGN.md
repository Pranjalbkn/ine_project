# Design note: reliable price scraping

## Approach

The store hides its live price until a visitor interacts with the product page,
so I use Playwright to read the rendered page. The scraper dismisses the cookie
overlay, moves the pointer across the price card, clicks **Reveal price**, and
waits for either a success or an error. It then reads the visible selling price
and stock. Validation rejects hidden decoy prices, crossed-out prices, the
wrong product, and invalid stock text before anything is saved.

Each product gets up to five attempts because the store's reveal step sometimes
fails even when the page loads. Every attempt is recorded in `scrape_log`, with
the stage and error on failures; only a validated reading goes into
`price_history`. The scheduled job checks tracked products sequentially every
two hours. GitHub Actions calls the protected backend endpoint and marks the run
failed if any product ultimately fails.

## Trade-offs

A real browser is slower and uses more memory than a simple HTTP request, but
the price depends on browser interaction. Five retries improve the chance of a
reading while making a difficult product take longer. Sequential checks reduce
load on the mock store but make total run time grow with the number of tracked
products. GitHub's schedule can be delayed, so the scrape log and Actions run
history show what actually ran.

## What the AI-assisted first attempt got wrong

The first scraper used Playwright's default headless shell, made one pointer
pass, and waited only for a success state. In testing, the store could leave
the reveal button disabled or return a challenge error; the scraper then timed
out without explaining why. I reproduced the failure in the browser, compared
headed and headless runs, and changed the scraper to use full Chromium in
headless mode, retry the pointer interaction, and detect the store's error
state. I also tested the complete API path to confirm that a successful scrape
creates a saved price and a failed attempt creates only a log entry.
