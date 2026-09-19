export default function SearchResults({
  matches, searching, error, highlightedIndex, onHighlight, onSelectProduct,
}) {
  return (
    <div id="product-suggestions" className="search-dropdown" role="listbox" aria-label="Matching products">
      {searching && <p className="dropdown-message">Searching products…</p>}
      {!searching && error && <p className="dropdown-message">{error}</p>}
      {!searching && !error && matches.length === 0 && (
        <p className="dropdown-message">No matching products</p>
      )}
      {!searching && !error && matches.map((product, index) => (
        <button
          type="button"
          role="option"
          id={`product-option-${product.id}`}
          key={product.id}
          className={`dropdown-item ${highlightedIndex === index ? 'active' : ''}`}
          aria-selected={highlightedIndex === index}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onSelectProduct(product)}
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
  );
}
