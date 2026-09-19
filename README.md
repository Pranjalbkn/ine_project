# INE Product Price Tracker

A small price tracker for the [INE assignment mock store](https://demo.inelabteamdev.com).
Search a product name, choose a result, and track its price and stock. The app
shows overall scrape counts, basic product information, a price-over-time graph,
saved readings, and a log of every scrape attempt.

## How it works

1. The React page searches a saved catalog of the mock store's 1,000 products.
2. The Express API loads product details from the store. Playwright opens the
   product page, reveals the live selling price, and reads price and stock.
3. If the product is tracked, the API saves valid readings and all scrape
   attempts in Supabase PostgreSQL. A failed scrape never creates a price row.
4. A GitHub Actions workflow calls the same API job every two hours. The job
   checks tracked products one at a time and records retries and failures.

The saved catalog makes search fast; live prices always come from the product
page. Only the assignment mock store is scraped.

## Folder structure

```text
backend/   Express API, Playwright scraper, catalog, SQL, private .env
frontend/  React page, styles, Vite config
```

The root `package.json` only provides commands to run both folders together.
In `frontend/src`, `App.jsx` coordinates data and actions, `api.js` handles
requests, `format.js` holds display helpers, and `components/` contains the
search, product, chart, history, and scrape-log views.

## Code walkthrough

- `frontend/src/App.jsx` holds the page state. It searches the catalog,
  loads the selected product, starts price checks, and passes the results to
  the components.
- `frontend/src/components/` only displays the search panel, results,
  product details, graph, history, and log. `api.js` makes HTTP requests,
  and `format.js` formats prices and specifications.
- `backend/src/server.js` defines the API routes. Search reads the saved
  catalog; product details come from the store's API.
- `backend/src/scraper.js` opens a product page with Playwright, reveals
  the price, checks the price and stock text, and retries failed attempts.
- `backend/src/tracking.js` saves tracked products, valid readings, and
  every scrape attempt in PostgreSQL. `backend/src/db.js` creates the
  database connection.

## Run locally

You need Node.js 22.12 or newer.

```powershell
npm ci
npx playwright install chromium
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

In `backend/.env`, replace `DATABASE_URL` with the Supabase connection string from the
Supabase **Connect** dialog. Replace the password placeholder, including its
square brackets. URL-encode reserved password characters. A Supabase session
pooler string can be used if your network cannot reach the direct IPv6 address.

```powershell
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:5173`. The API runs on port 3001. Search for a name,
select a product, click **Track product**, then click **Check live price**.
The first check can take a minute if the store is slow or the scraper retries.
The graph appears after a saved reading; two readings show a price trend.
"Scrape attempts" includes retries, while "saved prices" counts validated
readings only.

Useful commands:

```powershell
npm run scrape -- 738
npm run scrape:headed -- 738
npm run catalog:sync
npm test
npm run build
```

The headed command opens the browser so you can show how the price is revealed.
Catalog sync refreshes `backend/data/catalog.json` from the mock store and only replaces
the file when all products were found.

## Deploy

Publish this folder as a GitHub repository. `backend/.env` is ignored by Git and must
stay private.

### 1. Backend on Render

Create a **Web Service** from the repository, using the Node runtime.

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npx playwright install chromium` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| `DATABASE_URL` | Supabase connection string, preferably the session pooler string if direct IPv6 is unavailable |
| `CRON_SECRET` | A long random secret that you choose |
| `FRONTEND_ORIGIN` | Exact Vercel site origin, such as `https://your-site.vercel.app` |

The database tables were created locally with `npm run db:migrate`. To create
them for a different Supabase database, run the same command with that
database's `DATABASE_URL`. Confirm the Render URL responds at `/api/health`.

### 2. Frontend on Vercel

Import the same GitHub repository as a Vercel project. Keep the project root
at the repository root. `vercel.json` sets the build and output directory.
Set `VITE_API_BASE_URL` to the Render URL, without a trailing slash. Deploy,
then set Render's `FRONTEND_ORIGIN` to the exact Vercel URL and redeploy Render.

### 3. Two-hour schedule on GitHub

In repository **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `API_URL` | Render URL, such as `https://your-api.onrender.com` |
| `CRON_SECRET` | The same secret set on Render |

The workflow in `.github/workflows/scrape.yml` runs at minute 17 every two
hours (UTC). It can also be started manually from the **Actions** tab with
**Run workflow**. Run it once after deployment and check that the workflow
succeeds and the product's history and scrape log show a new entry. A failed
product causes the workflow to fail visibly in GitHub Actions.

GitHub scheduled runs can be delayed, and inactive public repositories may
have scheduled runs disabled. Check the Actions tab if no new scrape appears.

## Tables

| Table | Purpose |
| --- | --- |
| `tracked_products` | Products selected by the user |
| `price_history` | Valid price and stock readings with timestamps |
| `scrape_log` | Every success, retry, or failure with its error |

The schema is in `backend/sql/schema.sql`. The secret database URL is used only by the
backend; it is never sent to the browser or stored in a `VITE_` variable.

## Design choices and limits

- Search uses a local catalog snapshot because the store shuffles catalog
  pages; it does not need to scrape 1,000 pages on every keystroke.
- Playwright is used because the selling price appears after a real pointer
  interaction. The scraper ignores the hidden decoy price and crossed-out MRP.
- Each product is scraped sequentially in the scheduled job. This is simple
  and gentle on the mock store, but a large tracking list takes longer.
- The API retries a failed product up to three times and records each attempt.
  Only a validated selling price and stock count enter `price_history`.
- A free Render service may sleep when idle, so the first request can be slow.

For a demo: search for a product, track it, check its live price, show the
history and log, then run `npm run scrape:headed -- 738` to show the browser
interaction. After deployment, run the GitHub workflow manually to demonstrate
the two-hour job.
