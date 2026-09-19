import { useEffect, useRef, useState } from 'react';
import SearchResults from './SearchResults.jsx';

export default function SearchPanel({
  query, onQueryChange, matches, searching, error, stats, onSelectProduct,
}) {
  const searchArea = useRef(null);
  const searchInput = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const showDropdown = isOpen && Boolean(query.trim());

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!searchArea.current?.contains(event.target)) setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const activeProduct = matches[highlightedIndex];
    if (showDropdown && activeProduct) {
      searchArea.current?.querySelector(`#product-option-${activeProduct.id}`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, matches, showDropdown]);

  function updateQuery(value) {
    onQueryChange(value);
    setIsOpen(Boolean(value.trim()));
    setHighlightedIndex(-1);
  }

  function chooseProduct(product) {
    onSelectProduct(product.id);
    setIsOpen(false);
    setHighlightedIndex(-1);
    searchInput.current?.blur();
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (!query.trim()) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      if (!matches.length) return;
      setHighlightedIndex((index) => (
        event.key === 'ArrowDown'
          ? Math.min(index + 1, matches.length - 1)
          : Math.max(index - 1, 0)
      ));
    }

    if (event.key === 'Enter' && showDropdown && matches.length && !searching && !error) {
      event.preventDefault();
      chooseProduct(matches[Math.max(highlightedIndex, 0)]);
    }
  }

  return (
    <section className="intro">
      <h1>Search products</h1>

      <div className="search-area" ref={searchArea}>
        <div className="search-box">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            ref={searchInput}
            type="text"
            inputMode="search"
            role="combobox"
            aria-label="Search product names"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? 'product-suggestions' : undefined}
            aria-activedescendant={showDropdown && matches[highlightedIndex]
              ? `product-option-${matches[highlightedIndex].id}` : undefined}
            placeholder="Search by product name"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onFocus={() => { if (query.trim()) setIsOpen(true); }}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => updateQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>

        {showDropdown && (
          <SearchResults
            matches={matches}
            searching={searching}
            error={error}
            highlightedIndex={highlightedIndex}
            onHighlight={setHighlightedIndex}
            onSelectProduct={chooseProduct}
          />
        )}
      </div>

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
    </section>
  );
}
