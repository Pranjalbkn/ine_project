import { formatIndiaDateTime } from '../format.js';

export default function ScrapeLog({ entries }) {
  return (
    <div className="detail-section">
      <h3>Scrape log <span>({entries.length})</span></h3>

      {entries.length === 0 ? (
        <p className="helper-text">No scrape attempts yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time (IST)</th><th>Attempt</th><th>Outcome</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatIndiaDateTime(entry.startedAt)}</td>
                  <td>{entry.attempt}</td>
                  <td>
                    <span className={`log-status ${entry.outcome}`}>{entry.outcome}</span>
                    {entry.error && <small className="log-error">{entry.error}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
