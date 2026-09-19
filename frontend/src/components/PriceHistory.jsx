import { formatPrice } from '../format.js';

export default function PriceHistory({ history }) {
  return (
    <div className="detail-section">
      <h3>Price and stock history <span>({history.length})</span></h3>

      {history.length === 0 ? (
        <p className="helper-text">No saved readings yet. Track this product and check its live price.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Checked</th><th>Price</th><th>Stock</th></tr>
            </thead>
            <tbody>
              {history.map((reading) => (
                <tr key={reading.id}>
                  <td>{new Date(reading.scrapedAt).toLocaleString()}</td>
                  <td>{formatPrice(reading.price, reading.currency)}</td>
                  <td>{reading.stock === 0 ? 'Out' : reading.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
