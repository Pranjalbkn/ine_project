export default function SearchPanel({
  query, onQueryChange, stats, trackedProducts, recentProducts, onSelectProduct,
}) {
  return (
    <section className="intro">
      <h1>Search products</h1>

      <label className="search-box">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <span className="sr-only">Search product names</span>
        <input
          type="search"
          placeholder="Search by product name"
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
        </div>
        <div>
          <span>Tracked products</span>
          <strong>{stats?.trackedProducts ?? '—'}</strong>
        </div>
        <div>
          <span>Saved prices</span>
          <strong>{stats?.savedPrices ?? '—'}</strong>
        </div>
      </div>

      {recentProducts.length > 0 && (
        <div className="recent-strip" aria-label="Recent products">
          <span>RECENT</span>
          {recentProducts.map((product) => (
            <button
              type="button"
              key={product.id}
              onClick={() => onSelectProduct(product.id, product.name)}
            >
              {product.name}
            </button>
          ))}
        </div>
      )}

      {trackedProducts.length > 0 && (
        <div className="tracked-strip" aria-label="Tracked products">
          <span>TRACKED</span>
          {trackedProducts.map((product) => (
            <button
              type="button"
              key={product.productId}
              onClick={() => onSelectProduct(product.productId, product.name)}
            >
              {product.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
