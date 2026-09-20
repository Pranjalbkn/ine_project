import { formatIndiaDateTime } from '../format.js';

export default function RecentScrapes({ entries, loading, error, onRefresh }) {
  return (
    <section className="dashboard-card recent-scrapes" aria-labelledby="recent-scrapes-title" aria-busy={loading}>
      <div className="recent-scrapes-header">
        <div>
          <p className="eyebrow">ACTIVITY ACROSS ALL PRODUCTS</p>
          <h2 id="recent-scrapes-title">Recent scrape history</h2>
          <p className="recent-scrapes-description">The latest eight attempts, including retries and failures.</p>
        </div>
        <button type="button" className="recent-scrapes-refresh" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh history'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {!error && loading && entries.length === 0 && (
        <p className="recent-scrapes-empty">Loading scrape history…</p>
      )}
      {!error && !loading && entries.length === 0 && (
        <p className="recent-scrapes-empty">No scrape attempts yet. Track a product and check its live price to start the history.</p>
      )}

      {entries.length > 0 && (
        <ol className="recent-scrapes-list">
          {entries.map((entry) => (
            <li className="recent-scrapes-item" key={entry.id}>
              <span className={`recent-scrapes-marker ${entry.outcome}`} aria-hidden="true" />
              <div className="recent-scrapes-details">
                <strong>{entry.productName}</strong>
                <span>Product #{entry.productId} · Attempt {entry.attempt} · {formatIndiaDateTime(entry.startedAt)}</span>
                {entry.error && <small>{entry.error}</small>}
              </div>
              <span className={`recent-scrapes-outcome ${entry.outcome}`}>{entry.outcome}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
