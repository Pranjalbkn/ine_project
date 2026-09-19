export default function SearchResults({ query, matches, searching, error, selectedId, onSelectProduct }) {
  const hasSearchText = Boolean(query.trim());

  return (
    <section className="results-panel" aria-label="Search results">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h2>Matching products</h2>
        </div>
        <span className="count-badge">{hasSearchText ? matches.length : '—'}</span>
      </div>

      <div className="results-list" aria-live="polite">
        {!hasSearchText && (
          <div className="panel-empty">
            <span>⌕</span>
            <h3>Start with a product name</h3>
            <p>Every matching product will appear here.</p>
          </div>
        )}
        {hasSearchText && searching && <div className="panel-message">Searching the catalog…</div>}
        {error && <div className="error-message">{error}</div>}
        {hasSearchText && !searching && !error && matches.length === 0 && (
          <div className="panel-empty">
            <span>∅</span>
            <h3>No matches found</h3>
            <p>Try a shorter part of the name.</p>
          </div>
        )}
        {!searching && !error && matches.map((product) => (
          <button
            type="button"
            key={product.id}
            className={`result-item ${selectedId === product.id ? 'selected' : ''}`}
            onClick={() => onSelectProduct(product.id)}
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
