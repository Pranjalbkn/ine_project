import { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

async function api(path, options) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function label(key) {
  if (key === 'weightGrams') return 'Weight';
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function specValue(key, value) {
  if (key === 'weightGrams') return value >= 1000 ? `${(value / 1000).toFixed(2)} kg` : `${value} g`;
  return String(value);
}

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount);
}

export default function App() {
  const priceRequest = useRef(0);
  const selectedIdRef = useRef(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [reading, setReading] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [trackingAvailable, setTrackingAvailable] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [history, setHistory] = useState([]);
  const [scrapeLog, setScrapeLog] = useState([]);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    api('/api/tracked')
      .then(({ products }) => { setTrackedProducts(products); setTrackingAvailable(true); })
      .catch((error) => { setTrackingAvailable(false); setTrackingError(error.message); });
  }, []);

  async function loadSavedData(id) {
    try {
      const [past, attempts] = await Promise.all([
        api(`/api/tracked/${id}/history`), api(`/api/tracked/${id}/log`),
      ]);
      if (selectedIdRef.current !== id) return;
      setHistory(past.history);
      setScrapeLog(attempts.log);
      setHistoryError('');
    } catch (error) {
      if (selectedIdRef.current === id) setHistoryError(error.message);
    }
  }

  useEffect(() => {
    if (selectedId !== null && trackedProducts.some((item) => item.productId === selectedId)) {
      loadSavedData(selectedId);
    } else {
      setHistory([]);
      setScrapeLog([]);
    }
  }, [selectedId, trackedProducts]);

  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      setSearchError('');
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      api(`/api/products?search=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(({ products }) => { setMatches(products); setSearchError(''); })
        .catch((error) => { if (error.name !== 'AbortError') setSearchError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    if (selectedId === null) return;
    const controller = new AbortController();
    setDetailsLoading(true);
    setDetail(null);
    setReading(null);
    setDetailError('');
    setCheckError('');
    api(`/api/products/${selectedId}`, { signal: controller.signal })
      .then(setDetail)
      .catch((error) => { if (error.name !== 'AbortError') setDetailError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailsLoading(false); });
    return () => controller.abort();
  }, [selectedId]);

  async function checkPrice() {
    const request = ++priceRequest.current;
    const id = selectedId;
    setChecking(true);
    setCheckError('');
    try {
      const data = await api(`/api/products/${id}/price-check`, { method: 'POST' });
      if (priceRequest.current === request) {
        setReading(data.reading);
        if (data.saved) await loadSavedData(id);
      }
    } catch (error) {
      if (priceRequest.current === request) setCheckError(error.message);
    } finally {
      if (priceRequest.current === request) setChecking(false);
    }
  }

  function changeQuery(value) {
    priceRequest.current += 1;
    selectedIdRef.current = null;
    setQuery(value);
    setSelectedId(null);
    setDetail(null);
    setReading(null);
    setChecking(false);
  }

  function selectProduct(id) {
    priceRequest.current += 1;
    selectedIdRef.current = id;
    setSelectedId(id);
    setReading(null);
    setChecking(false);
  }

  async function trackProduct() {
    setTracking(true);
    setTrackingError('');
    try {
      const { product } = await api(`/api/tracked/${selectedId}`, { method: 'POST' });
      setTrackedProducts((items) => [product, ...items.filter((item) => item.productId !== product.productId)]);
    } catch (error) {
      setTrackingError(error.message);
    } finally {
      setTracking(false);
    }
  }

  const product = detail?.product;
  const selectedTracked = trackedProducts.some((item) => item.productId === selectedId);
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">◫</div>
        <div className="brand-copy"><strong>INE Product Finder</strong><span>Explore the mock store</span></div>
        <span className="header-tag">1,000 products</span>
      </header>

      <main className="main-content">
        <section className="intro">
          <p className="eyebrow">PRODUCT SEARCH</p>
          <h1>Find the product you want to track.</h1>
          <p>Search by any part of its name. Select a result to see its details and check the latest price and stock.</p>
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <span className="sr-only">Search product names</span>
            <input
              type="search" placeholder="Try fitness band, doorbell, or monitor"
              value={query} onChange={(event) => changeQuery(event.target.value)}
              autoComplete="off"
            />
            {query && <button type="button" onClick={() => changeQuery('')} aria-label="Clear search">×</button>}
          </label>
          {trackedProducts.length > 0 && <div className="tracked-strip"><span>TRACKING</span>{trackedProducts.map((item) => <button type="button" key={item.productId} onClick={() => selectProduct(item.productId)}>{item.name}</button>)}</div>}
        </section>

        <div className="content-grid">
          <section className="results-panel" aria-label="Search results">
            <div className="panel-heading">
              <div><p className="eyebrow">CATALOG</p><h2>Matching products</h2></div>
              <span className="count-badge">{query.trim() ? matches.length : '—'}</span>
            </div>
            <div className="results-list" aria-live="polite">
              {!query.trim() && <div className="panel-empty"><span>⌕</span><h3>Start with a product name</h3><p>Every matching product will appear here.</p></div>}
              {query.trim() && searching && <div className="panel-message">Searching the catalog…</div>}
              {searchError && <div className="error-message">{searchError}</div>}
              {query.trim() && !searching && !searchError && matches.length === 0 &&
                <div className="panel-empty"><span>∅</span><h3>No matches found</h3><p>Try a shorter part of the name.</p></div>}
              {!searching && !searchError && matches.map((item) => (
                <button
                  type="button" key={item.id}
                  className={`result-item ${selectedId === item.id ? 'selected' : ''}`}
                  onClick={() => selectProduct(item.id)}
                  aria-pressed={selectedId === item.id}
                >
                  <span className="item-icon" aria-hidden="true">{item.category?.slice(0, 1) || 'P'}</span>
                  <span className="item-text"><strong>{item.name}</strong><small>{item.brand} · {item.category} · {item.sku}</small></span>
                  <span className="item-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>

          <section className="detail-panel" aria-label="Product details" aria-live="polite">
            {!selectedId && <div className="detail-placeholder"><div className="placeholder-art" aria-hidden="true">◎</div><p className="eyebrow">PRODUCT DETAILS</p><h2>Pick a product</h2><p>Its description, specifications, reviews, current price, and stock will appear here.</p></div>}
            {selectedId && detailsLoading && <div className="panel-message">Loading product details…</div>}
            {detailError && <div className="error-message">{detailError}</div>}
            {product && <>
              <div className="detail-top"><span className="category-pill">{product.category}</span><span className="sku">{product.sku}</span></div>
              <h2 className="product-title">{product.name}</h2>
              <p className="product-brand">by {product.brand}</p>
              <p className="product-description">{product.description}</p>

              <div className="price-card">
                <div><p className="eyebrow">CURRENT STORE READING</p>
                  {reading ? <><strong className="price-text">{formatPrice(reading.price, reading.currency)}</strong><p className={reading.stock === 0 ? 'stock-out' : 'stock-in'}>{reading.stock === 0 ? 'Out of stock' : `${reading.stock} in stock`}</p><small>Checked {new Date(reading.scrapedAt).toLocaleString()}</small></>
                    : <p className="price-prompt">Check the latest price and availability.</p>}
                </div>
                <button className="primary-button" type="button" onClick={checkPrice} disabled={checking}>{checking ? 'Checking…' : reading ? 'Check again' : 'Check live price'}</button>
              </div>
              {checking && <p className="helper-text">The store may load slowly; retries can take over a minute.</p>}
              {checkError && <p className="error-message">{checkError}</p>}

              <div className="tracking-card">
                <div><strong>{selectedTracked ? 'Tracking this product' : 'Track this product'}</strong><p>{selectedTracked ? 'New readings and scrape attempts are saved in Supabase.' : 'Save its future price, stock, and scrape log.'}</p></div>
                {selectedTracked ? <span className="tracking-badge">● Tracking</span> :
                  <button className="secondary-button" type="button" onClick={trackProduct} disabled={tracking || trackingAvailable !== true}>{tracking ? 'Adding…' : 'Track product'}</button>}
              </div>
              {trackingAvailable === false && <p className="helper-text">Set DATABASE_URL in backend/.env and run the database migration to enable tracking.</p>}
              {trackingError && trackingAvailable === true && <p className="error-message">{trackingError}</p>}

              {selectedTracked && <>
                <div className="detail-section"><h3>Price and stock history <span>({history.length})</span></h3>
                  {historyError && <p className="error-message">{historyError}</p>}
                  {history.length === 0 ? <p className="helper-text">No saved readings yet. Use “Check live price” or wait for the next scheduled run.</p> :
                    <div className="table-wrap"><table><thead><tr><th>Checked</th><th>Price</th><th>Stock</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{new Date(item.scrapedAt).toLocaleString()}</td><td>{formatPrice(item.price, item.currency)}</td><td>{item.stock === 0 ? 'Out' : item.stock}</td></tr>)}</tbody></table></div>}
                </div>
                <div className="detail-section"><h3>Scrape log <span>({scrapeLog.length})</span></h3>
                  {scrapeLog.length === 0 ? <p className="helper-text">No scrape attempts have been recorded yet.</p> :
                    <div className="table-wrap"><table><thead><tr><th>Time</th><th>Attempt</th><th>Outcome</th></tr></thead><tbody>{scrapeLog.map((entry) => <tr key={entry.id}><td>{new Date(entry.startedAt).toLocaleString()}</td><td>{entry.attempt}</td><td><span className={`log-status ${entry.outcome}`}>{entry.outcome}</span>{entry.error && <small className="log-error">{entry.error}</small>}</td></tr>)}</tbody></table></div>}
                </div>
              </>}

              <div className="detail-section"><h3>Specifications</h3><dl className="spec-grid">{Object.entries(product.specs || {}).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{specValue(key, value)}</dd></div>)}</dl></div>
              <div className="detail-section"><h3>Customer reviews <span>({product.reviews?.length || 0})</span></h3><div className="reviews">{(product.reviews || []).map((review) => <article className="review" key={review.id}><div><strong>{review.title}</strong><span className="stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><small>{review.author} · {review.date}</small><p>{review.body}</p></article>)}</div></div>
              <a className="store-link" href={detail.storeUrl} target="_blank" rel="noreferrer">View on INE mock store ↗</a>
            </>}
          </section>
        </div>
      </main>
      <footer>Data comes only from INE’s assignment mock storefront. Prices and availability can change.</footer>
    </div>
  );
}
