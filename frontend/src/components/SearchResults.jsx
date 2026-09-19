export default function SearchResults({ query, matches, searching, error, selectedId, onSelectProduct }) {
  const hasSearchText = Boolean(query.trim());

  return (
    <section className="results-panel" aria-label="Search results">
      <div className="panel-heading">
        <div>
          <h2>Results</h2>
        </div>
        <span className="count-badge">{hasSearchText ? matches.length : '—'}</span>
      </div>

      <div className="results-list" aria-live="polite">
        {!hasSearchText && (
          <div className="panel-empty">
            <h3>Search for a product</h3>
          </div>
        )}
        {hasSearchText && searching && <div className="panel-message">Searching the catalog…</div>}
        {error && <div className="error-message">{error}</div>}
        {hasSearchText && !searching && !error && matches.length === 0 && (
          <div className="panel-empty">
            <h3>No products found</h3>
          </div>
        )}
        {!searching && !error && matches.map((product) => (
          <button
            type="button"
            key={product.id}
            className={`result-item ${selectedId === product.id ? 'selected' : ''}`}
            onClick={() => onSelectProduct(product.id, product.name)}
            aria-pressed={selectedId === product.id}
          >
            <span className="item-icon" aria-hidden="true">
              {product.category?.slice(0, 1) || 'P'}
            </span>
            <span className="item-text">
              <strong>{product.name}</strong>
              <small>{product.brand} · {product.category} · {product.sku}</small>
            </span>
            <span className="item-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </section>
  );
}
