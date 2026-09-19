import {
  formatIndiaDateTime,
  formatPrice,
  formatSpecLabel,
  formatSpecValue,
} from '../format.js';

import PriceChart from './PriceChart.jsx';
import PriceHistory from './PriceHistory.jsx';
import ScrapeLog from './ScrapeLog.jsx';

export default function ProductDetails({
  selectedId,
  detail,
  loading,
  error,
  reading,
  checking,
  checkError,
  onCheckPrice,
  browserMode,
  onBrowserModeChange,
  selectedTracked,
  trackingAvailable,
  tracking,
  trackingError,
  onTrack,
  history,
  historyError,
  scrapeLog,
}) {
  const product = detail?.product;

  return (
    <section
      className="detail-panel"
      aria-label="Product details"
      aria-live="polite"
    >
      {!selectedId && (
        <div className="detail-placeholder">
          <h2>Select a product</h2>
        </div>
      )}

      {selectedId && loading && (
        <div className="panel-message">
          Loading product details…
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {product && (
        <div className="product-dashboard">

          {/* ================= TOP GRID ================= */}

          <div className="dashboard-top-grid">

            {/* LEFT: PRODUCT SUMMARY */}

            <section className="dashboard-card product-summary-card">

              <div className="detail-top">
                <span className="category-pill">
                  {product.category}
                </span>

                <span className="sku">
                  {product.sku}
                </span>
              </div>

              <h2 className="product-title">
                {product.name}
              </h2>

              <div className="basic-info">
                <p className="eyebrow">
                  BASIC INFORMATION
                </p>

                <dl className="basic-grid">
                  <div>
                    <dt>Brand</dt>
                    <dd>{product.brand || 'N/A'}</dd>
                  </div>

                  <div>
                    <dt>Category</dt>
                    <dd>{product.category || 'N/A'}</dd>
                  </div>

                  <div>
                    <dt>SKU</dt>
                    <dd>{product.sku || 'N/A'}</dd>
                  </div>

                  <div>
                    <dt>Product ID</dt>
                    <dd>{product.id}</dd>
                  </div>
                </dl>
              </div>

              <div className="product-stats">
                <div>
                  <span>Scrape attempts</span>
                  <strong>{scrapeLog.length}</strong>
                </div>

                <div>
                  <span>Saved readings</span>
                  <strong>{history.length}</strong>
                </div>
              </div>

              {/* PRICE CARD */}

              <div className="price-card">
                <div>
                  <p className="eyebrow">
                    CURRENT STORE READING
                  </p>

                  {reading ? (
                    <>
                      <strong className="price-text">
                        {formatPrice(
                          reading.price,
                          reading.currency
                        )}
                      </strong>

                      <p
                        className={
                          reading.stock === 0
                            ? 'stock-out'
                            : 'stock-in'
                        }
                      >
                        {reading.stock === 0
                          ? 'Out of stock'
                          : `${reading.stock} in stock`}
                      </p>

                      <small>
                        Checked{' '}
                        {formatIndiaDateTime(reading.scrapedAt)}
                      </small>
                    </>
                  ) : (
                    <p className="muted-text">
                      No price reading available
                    </p>
                  )}
                </div>
                <div className="price-actions">
                  <label className="browser-mode-label">
                    Browser mode
                    <select
                      value={browserMode}
                      onChange={(event) => onBrowserModeChange(event.target.value)}
                      disabled={checking}
                    >
                      <option value="headless">Headless</option>
                      <option value="headed">Headed</option>
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={onCheckPrice}
                    disabled={checking}
                  >
                    {checking
                      ? 'Checking…'
                      : reading
                        ? 'Check again'
                        : 'Check live price'}
                  </button>
                </div>
              </div>

              {checkError && (
                <p className="error-message">
                  {checkError}
                </p>
              )}

              {/* TRACKING */}

              <div className="tracking-card">
                <strong>Price tracking</strong>

                {selectedTracked ? (
                  <span className="tracking-badge">
                    ● Active
                  </span>
                ) : (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={onTrack}
                    disabled={
                      tracking ||
                      trackingAvailable !== true
                    }
                  >
                    {tracking ? 'Adding…' : 'Track product'}
                  </button>
                )}
              </div>

              {trackingAvailable === false && (
                <p className="helper-text">
                  Tracking is unavailable. Check the backend setup.
                </p>
              )}

              {trackingError && trackingAvailable === true && (
                <p className="error-message">
                  {trackingError}
                </p>
              )}

            </section>


            {/* RIGHT: DESCRIPTION AND SPECIFICATIONS */}

            <section className="dashboard-card product-overview-card">

              <div className="section-heading">
                <p className="eyebrow">
                  PRODUCT OVERVIEW
                </p>

                <h3>
                  Product Description
                </h3>
              </div>

              <div className="product-description">
                {product.description ? (
                  <p>{product.description}</p>
                ) : (
                  <p className="muted-text">
                    No description available for this product.
                  </p>
                )}
              </div>

              <div className="detail-section">
                <h3>Specifications</h3>

                <dl className="spec-grid">
                  {Object.entries(product.specs || {}).map(
                    ([name, value]) => (
                      <div key={name}>
                        <dt>{formatSpecLabel(name)}</dt>
                        <dd>{formatSpecValue(name, value)}</dd>
                      </div>
                    )
                  )}
                </dl>
              </div>

              <a
                className="store-link"
                href={detail.storeUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on INE mock store ↗
              </a>

            </section>

          </div>


          {/* ================= GRAPH ================= */}

          <section className="dashboard-card graph-section">
            <div className="section-heading">
              <p className="eyebrow">
                PRICE ANALYTICS
              </p>

              <h3>
                Price over scrape time (IST)
              </h3>
            </div>

            {historyError && (
              <p className="error-message">
                {historyError}
              </p>
            )}

            <PriceChart history={history} />
          </section>


          {/* ================= BOTTOM GRID ================= */}

          <div className="dashboard-bottom-grid">

            <section className="dashboard-card history-section">
              <PriceHistory history={history} />
            </section>

            <section className="dashboard-card scrape-section">
              <ScrapeLog entries={scrapeLog} />
            </section>

          </div>

        </div>
      )}
    </section>
  );
}
