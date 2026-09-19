import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import SearchPanel from './components/SearchPanel.jsx';
import SearchResults from './components/SearchResults.jsx';
import ProductDetails from './components/ProductDetails.jsx';

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
  const [stats, setStats] = useState(null);

  async function refreshStats() {
    try {
      setStats(await api('/api/stats'));
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    api('/api/tracked')
      .then(({ products }) => { setTrackedProducts(products); setTrackingAvailable(true); })
      .catch((error) => { setTrackingAvailable(false); setTrackingError(error.message); });
    refreshStats();
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
    setHistory([]);
    setScrapeLog([]);
    setHistoryError('');
    if (selectedId !== null && trackingAvailable === true) loadSavedData(selectedId);
  }, [selectedId, trackingAvailable]);

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

  async function checkPrice() {
    const request = ++priceRequest.current;
    const id = selectedId;
    setChecking(true);
    setCheckError('');
    try {
      const data = await api(`/api/products/${id}/price-check`, { method: 'POST' });
      if (priceRequest.current === request) {
        setReading(data.reading);
        if (data.saved) {
          await loadSavedData(id);
          refreshStats();
        }
      }
    } catch (error) {
      if (priceRequest.current === request) setCheckError(error.message);
    } finally {
      if (priceRequest.current === request) setChecking(false);
    }
  }

  async function trackProduct() {
    setTracking(true);
    setTrackingError('');
    try {
      const { product } = await api(`/api/tracked/${selectedId}`, { method: 'POST' });
      setTrackedProducts((items) => [product, ...items.filter((item) => item.productId !== product.productId)]);
      refreshStats();
    } catch (error) {
      setTrackingError(error.message);
    } finally {
      setTracking(false);
    }
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="brand-mark" aria-hidden="true">◫</div>
      <div className="brand-copy"><strong>INE Price Tracker</strong><span>Explore the mock store</span></div>
      <span className="header-tag">1,000 products</span>
    </header>

    <main className="main-content">
      <SearchPanel query={query} onQueryChange={changeQuery} stats={stats}
        trackedProducts={trackedProducts} onSelectProduct={selectProduct} />
      <div className="content-grid">
        <SearchResults query={query} matches={matches} searching={searching}
          error={searchError} selectedId={selectedId} onSelectProduct={selectProduct} />
        <ProductDetails selectedId={selectedId} detail={detail} loading={detailsLoading}
          error={detailError} reading={reading} checking={checking} checkError={checkError}
          onCheckPrice={checkPrice} selectedTracked={trackedProducts.some((item) => item.productId === selectedId)}
          trackingAvailable={trackingAvailable} tracking={tracking} trackingError={trackingError}
          onTrack={trackProduct} history={history} historyError={historyError} scrapeLog={scrapeLog} />
      </div>
    </main>
    <footer>Data comes only from INE’s assignment mock storefront. Prices and availability can change.</footer>
  </div>;
}
