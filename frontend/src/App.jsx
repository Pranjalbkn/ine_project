import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import SearchPanel from './components/SearchPanel.jsx';
import SearchResults from './components/SearchResults.jsx';
import ProductDetails from './components/ProductDetails.jsx';

const RECENT_PRODUCTS_KEY = 'ine-recent-products';
const RECENT_PRODUCTS_LIMIT = 5;

function readRecentProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((product) => Number.isSafeInteger(product.id) && typeof product.name === 'string')
      .slice(0, RECENT_PRODUCTS_LIMIT);
  } catch {
    return [];
  }
}

export default function App() {
  const latestPriceCheck = useRef(0);
  const selectedProductRef = useRef(null);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recentProducts, setRecentProducts] = useState(readRecentProducts);

  const [selectedProductId, setSelectedProductId] = useState(null);
  const [productDetails, setProductDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const [currentReading, setCurrentReading] = useState(null);
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [priceCheckError, setPriceCheckError] = useState('');

  const [trackedProducts, setTrackedProducts] = useState([]);
  const [trackingAvailable, setTrackingAvailable] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [isAddingToTracking, setIsAddingToTracking] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [scrapeLog, setScrapeLog] = useState([]);
  const [savedDataError, setSavedDataError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recentProducts));
    } catch {
      // The list still works for this visit if browser storage is unavailable.
    }
  }, [recentProducts]);

  async function refreshStats() {
    try {
      setStats(await api('/api/stats'));
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    api('/api/tracked')
      .then(({ products }) => {
        setTrackedProducts(products);
        setTrackingAvailable(true);
      })
      .catch((error) => {
        setTrackingAvailable(false);
        setTrackingError(error.message);
      });

    refreshStats();
  }, []);

  async function loadSavedData(productId) {
    try {
      const [historyResponse, logResponse] = await Promise.all([
        api(`/api/tracked/${productId}/history`),
        api(`/api/tracked/${productId}/log`),
      ]);

      // Ignore a response if the user selected another product while it loaded.
      if (selectedProductRef.current !== productId) return;
      setPriceHistory(historyResponse.history);
      setScrapeLog(logResponse.log);
      setSavedDataError('');
    } catch (error) {
      if (selectedProductRef.current === productId) {
        setSavedDataError(error.message);
      }
    }
  }

  useEffect(() => {
    setPriceHistory([]);
    setScrapeLog([]);
    setSavedDataError('');

    if (selectedProductId !== null && trackingAvailable === true) {
      loadSavedData(selectedProductId);
    }
  }, [selectedProductId, trackingAvailable]);

  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      setSearchError('');
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    // Wait until typing pauses so one search does not start for every keypress.
    const timer = setTimeout(() => {
      api(`/api/products?search=${encodeURIComponent(searchText)}`, {
        signal: controller.signal,
      })
        .then(({ products }) => {
          setSearchResults(products);
          setSearchError('');
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setSearchError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText]);

  useEffect(() => {
    if (selectedProductId === null) return;

    const controller = new AbortController();
    setIsLoadingDetails(true);
    setProductDetails(null);
    setCurrentReading(null);
    setDetailsError('');
    setPriceCheckError('');

    api(`/api/products/${selectedProductId}`, { signal: controller.signal })
      .then(setProductDetails)
      .catch((error) => {
        if (error.name !== 'AbortError') setDetailsError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingDetails(false);
      });

    return () => controller.abort();
  }, [selectedProductId]);

  function changeSearchText(value) {
    latestPriceCheck.current += 1;
    selectedProductRef.current = null;
    setSearchText(value);
    setSelectedProductId(null);
    setProductDetails(null);
    setCurrentReading(null);
    setIsCheckingPrice(false);
  }

  function selectProduct(productId, productName) {
    latestPriceCheck.current += 1;
    selectedProductRef.current = productId;
    setSelectedProductId(productId);
    setCurrentReading(null);
    setIsCheckingPrice(false);

    if (productName) {
      setRecentProducts((currentProducts) => [
        { id: productId, name: productName },
        ...currentProducts.filter((product) => product.id !== productId),
      ].slice(0, RECENT_PRODUCTS_LIMIT));
    }
  }

  async function checkPrice() {
    const requestNumber = ++latestPriceCheck.current;
    const productId = selectedProductId;
    setIsCheckingPrice(true);
    setPriceCheckError('');

    try {
      const result = await api(`/api/products/${productId}/price-check`, {
        method: 'POST',
      });

      if (latestPriceCheck.current !== requestNumber) return;
      setCurrentReading(result.reading);

      if (result.saved) {
        await loadSavedData(productId);
        refreshStats();
      }
    } catch (error) {
      if (latestPriceCheck.current === requestNumber) {
        setPriceCheckError(error.message);
      }
    } finally {
      if (latestPriceCheck.current === requestNumber) {
        setIsCheckingPrice(false);
      }
    }
  }

  async function trackProduct() {
    setIsAddingToTracking(true);
    setTrackingError('');

    try {
      const { product } = await api(`/api/tracked/${selectedProductId}`, {
        method: 'POST',
      });
      setTrackedProducts((currentProducts) => [
        product,
        ...currentProducts.filter((item) => item.productId !== product.productId),
      ]);
      refreshStats();
    } catch (error) {
      setTrackingError(error.message);
    } finally {
      setIsAddingToTracking(false);
    }
  }

  const selectedIsTracked = trackedProducts.some(
    (product) => product.productId === selectedProductId,
  );

  return (
    <div className="app-shell">
      <main className="main-content">
        <SearchPanel
          query={searchText}
          onQueryChange={changeSearchText}
          stats={stats}
          trackedProducts={trackedProducts}
          recentProducts={recentProducts}
          onSelectProduct={selectProduct}
        />

        <div className="content-grid">
          <SearchResults
            query={searchText}
            matches={searchResults}
            searching={isSearching}
            error={searchError}
            selectedId={selectedProductId}
            onSelectProduct={selectProduct}
          />
          <ProductDetails
            selectedId={selectedProductId}
            detail={productDetails}
            loading={isLoadingDetails}
            error={detailsError}
            reading={currentReading}
            checking={isCheckingPrice}
            checkError={priceCheckError}
            onCheckPrice={checkPrice}
            selectedTracked={selectedIsTracked}
            trackingAvailable={trackingAvailable}
            tracking={isAddingToTracking}
            trackingError={trackingError}
            onTrack={trackProduct}
            history={priceHistory}
            historyError={savedDataError}
            scrapeLog={scrapeLog}
          />
        </div>
      </main>

    </div>
  );
}
