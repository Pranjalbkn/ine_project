import { formatPrice, formatSpecLabel, formatSpecValue } from '../format.js';
import PriceChart from './PriceChart.jsx';
import PriceHistory from './PriceHistory.jsx';
import ScrapeLog from './ScrapeLog.jsx';

export default function ProductDetails({
  selectedId, detail, loading, error, reading, checking, checkError, onCheckPrice,
  selectedTracked, trackingAvailable, tracking, trackingError, onTrack,
  history, historyError, scrapeLog,
}) {
  const product = detail?.product;

  return <section className="detail-panel" aria-label="Product details" aria-live="polite">
    {!selectedId && <div className="detail-placeholder">
      <div className="placeholder-art" aria-hidden="true">◎</div>
      <p className="eyebrow">PRODUCT DETAILS</p>
      <h2>Pick a product</h2>
      <p>Its basic information, scrape count, price graph, and stock will appear here.</p>
    </div>}
    {selectedId && loading && <div className="panel-message">Loading product details…</div>}
    {error && <div className="error-message">{error}</div>}
    {product && <>
      <div className="detail-top"><span className="category-pill">{product.category}</span><span className="sku">{product.sku}</span></div>
      <h2 className="product-title">{product.name}</h2>
      <div className="basic-info">
        <p className="eyebrow">BASIC INFORMATION</p>
        <dl className="basic-grid">
          <div><dt>Brand</dt><dd>{product.brand}</dd></div>
          <div><dt>Category</dt><dd>{product.category}</dd></div>
          <div><dt>SKU</dt><dd>{product.sku}</dd></div>
          <div><dt>Product ID</dt><dd>{product.id}</dd></div>
        </dl>
        <p>{product.description}</p>
      </div>

      <div className="product-stats">
        <div><span>Product scrape attempts</span><strong>{scrapeLog.length}</strong></div>
        <div><span>Saved price readings</span><strong>{history.length}</strong></div>
      </div>

      <div className="price-card">
        <div><p className="eyebrow">CURRENT STORE READING</p>
          {reading ? <>
            <strong className="price-text">{formatPrice(reading.price, reading.currency)}</strong>
            <p className={reading.stock === 0 ? 'stock-out' : 'stock-in'}>{reading.stock === 0 ? 'Out of stock' : `${reading.stock} in stock`}</p>
            <small>Checked {new Date(reading.scrapedAt).toLocaleString()}</small>
          </> : <p className="price-prompt">Check the latest price and availability.</p>}
        </div>
        <button className="primary-button" type="button" onClick={onCheckPrice} disabled={checking}>
          {checking ? 'Checking…' : reading ? 'Check again' : 'Check live price'}
        </button>
      </div>
      {checking && <p className="helper-text">The store may load slowly; retries can take over a minute.</p>}
      {checkError && <p className="error-message">{checkError}</p>}

      <div className="tracking-card">
        <div><strong>{selectedTracked ? 'Tracking this product' : 'Track this product'}</strong>
          <p>{selectedTracked ? 'New readings and scrape attempts are saved in Supabase.' : 'Save its future price, stock, and scrape log.'}</p>
        </div>
        {selectedTracked ? <span className="tracking-badge">● Tracking</span> :
          <button className="secondary-button" type="button" onClick={onTrack} disabled={tracking || trackingAvailable !== true}>{tracking ? 'Adding…' : 'Track product'}</button>}
      </div>
      {trackingAvailable === false && <p className="helper-text">Set DATABASE_URL in backend/.env and run the database migration to enable tracking.</p>}
      {trackingError && trackingAvailable === true && <p className="error-message">{trackingError}</p>}

      <div className="detail-section">
        <h3>Price over scrape time</h3>
        <p className="chart-description">Each point is a saved price from a completed scrape.</p>
        {historyError && <p className="error-message">{historyError}</p>}
        <PriceChart history={history} />
      </div>
      <PriceHistory history={history} />
      <ScrapeLog entries={scrapeLog} />

      <div className="detail-section">
        <h3>Specifications</h3>
        <dl className="spec-grid">{Object.entries(product.specs || {}).map(([key, value]) => <div key={key}>
          <dt>{formatSpecLabel(key)}</dt><dd>{formatSpecValue(key, value)}</dd>
        </div>)}</dl>
      </div>
      <a className="store-link" href={detail.storeUrl} target="_blank" rel="noreferrer">View on INE mock store ↗</a>
    </>}
  </section>;
}
