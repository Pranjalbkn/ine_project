import { formatPrice, formatSpecLabel, formatSpecValue } from '../format.js';
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
    <section className="detail-panel" aria-label="Product details" aria-live="polite">
      {!selectedId && (
        <div className="detail-placeholder">
          <h2>Select a product</h2>
        </div>
      )}

      {selectedId && loading && <div className="panel-message">Loading product details…</div>}
      {error && <div className="error-message">{error}</div>}

      {product && (
        <>
          <div className="detail-top">
            <span className="category-pill">{product.category}</span>
            <span className="sku">{product.sku}</span>
          </div>
          <h2 className="product-title">{product.name}</h2>

          <div className="basic-info">
            <p className="eyebrow">BASIC INFORMATION</p>
            <dl className="basic-grid">
              <div><dt>Brand</dt><dd>{product.brand}</dd></div>
              <div><dt>Category</dt><dd>{product.category}</dd></div>
              <div><dt>SKU</dt><dd>{product.sku}</dd></div>
              <div><dt>Product ID</dt><dd>{product.id}</dd></div>
            </dl>
          </div>

          <div className="product-stats">
            <div>
              <span>Product scrape attempts</span>
              <strong>{scrapeLog.length}</strong>
            </div>
            <div>
              <span>Saved price readings</span>
              <strong>{history.length}</strong>
            </div>
          </div>

          <div className="price-card">
            <div>
              <p className="eyebrow">CURRENT STORE READING</p>
              {reading && (
                <>
                  <strong className="price-text">
                    {formatPrice(reading.price, reading.currency)}
                  </strong>
                  <p className={reading.stock === 0 ? 'stock-out' : 'stock-in'}>
                    {reading.stock === 0 ? 'Out of stock' : `${reading.stock} in stock`}
                  </p>
                  <small>Checked {new Date(reading.scrapedAt).toLocaleString()}</small>
                </>
              )}
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={onCheckPrice}
              disabled={checking}
            >
              {checking ? 'Checking…' : reading ? 'Check again' : 'Check live price'}
            </button>
          </div>

          {checkError && <p className="error-message">{checkError}</p>}

          <div className="tracking-card">
            <strong>Price tracking</strong>
            {selectedTracked ? (
              <span className="tracking-badge">● Active</span>
            ) : (
              <button
                className="secondary-button"
                type="button"
                onClick={onTrack}
                disabled={tracking || trackingAvailable !== true}
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
            <p className="error-message">{trackingError}</p>
          )}

          <div className="detail-section">
            <h3>Price over scrape time</h3>
            {historyError && <p className="error-message">{historyError}</p>}
            <PriceChart history={history} />
          </div>

          <PriceHistory history={history} />
          <ScrapeLog entries={scrapeLog} />

          <div className="detail-section">
            <h3>Specifications</h3>
            <dl className="spec-grid">
              {Object.entries(product.specs || {}).map(([name, value]) => (
                <div key={name}>
                  <dt>{formatSpecLabel(name)}</dt>
                  <dd>{formatSpecValue(name, value)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <a className="store-link" href={detail.storeUrl} target="_blank" rel="noreferrer">
            View on INE mock store ↗
          </a>
        </>
      )}
    </section>
  );
}
