export default function SearchResults({ query, matches, searching, error, selectedId, onSelectProduct }) {
  const hasQuery = Boolean(query.trim());
  return <section className="results-panel" aria-label="Search results">
    <div className="panel-heading">
      <div><p className="eyebrow">CATALOG</p><h2>Matching products</h2></div>
      <span className="count-badge">{hasQuery ? matches.length : '—'}</span>
    </div>
    <div className="results-list" aria-live="polite">
      {!hasQuery && <div className="panel-empty"><span>⌕</span><h3>Start with a product name</h3><p>Every matching product will appear here.</p></div>}
      {hasQuery && searching && <div className="panel-message">Searching the catalog…</div>}
      {error && <div className="error-message">{error}</div>}
      {hasQuery && !searching && !error && matches.length === 0 &&
        <div className="panel-empty"><span>∅</span><h3>No matches found</h3><p>Try a shorter part of the name.</p></div>}
      {!searching && !error && matches.map((item) => <button
        type="button" key={item.id}
        className={`result-item ${selectedId === item.id ? 'selected' : ''}`}
        onClick={() => onSelectProduct(item.id)}
        aria-pressed={selectedId === item.id}
      >
        <span className="item-icon" aria-hidden="true">{item.category?.slice(0, 1) || 'P'}</span>
        <span className="item-text"><strong>{item.name}</strong><small>{item.brand} · {item.category} · {item.sku}</small></span>
        <span className="item-arrow" aria-hidden="true">→</span>
      </button>)}
    </div>
  </section>;
}
