export default function SearchPanel({ query, onQueryChange, stats, trackedProducts, onSelectProduct }) {
  return (
    <section className="intro">
      <p className="eyebrow">PRODUCT SEARCH</p>
      <h1>Find the product you want to track.</h1>
      <p>Search by any part of its name. Select a result to see its details, scrape count, and price history.</p>

      <label className="search-box">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <span className="sr-only">Search product names</span>
        <input
          type="search"
          placeholder="Try fitness band, doorbell, or monitor"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search">
            ×
          </button>
        )}
      </label>

      <div className="overview-stats" aria-label="Tracking summary">
        <div>
          <span>Total scrape attempts</span>
          <strong>{stats?.totalScrapes ?? '—'}</strong>
          <small>Includes retries</small>
        </div>
        <div>
          <span>Tracked products</span>
          <strong>{stats?.trackedProducts ?? '—'}</strong>
          <small>Selected for regular checks</small>
        </div>
        <div>
          <span>Saved prices</span>
          <strong>{stats?.savedPrices ?? '—'}</strong>
          <small>Valid readings</small>
        </div>
      </div>

      {trackedProducts.length > 0 && (
        <div className="tracked-strip">
          <span>TRACKING</span>
          {trackedProducts.map((product) => (
            <button
              type="button"
              key={product.productId}
              onClick={() => onSelectProduct(product.productId)}
            >
              {product.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
