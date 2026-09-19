const WIDTH = 640;
const HEIGHT = 240;
const LEFT = 72;
const RIGHT = 20;
const TOP = 18;
const BOTTOM = 42;

function timeLabel(value) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

export default function PriceChart({ history, formatPrice }) {
  const readings = [...history]
    .filter((item) => Number.isFinite(Number(item.price)) && Number.isFinite(Date.parse(item.scrapedAt)))
    .sort((a, b) => Date.parse(a.scrapedAt) - Date.parse(b.scrapedAt));

  if (readings.length === 0) {
    return <div className="chart-empty">No saved prices yet. Track this product and check its live price to start the graph.</div>;
  }

  const prices = readings.map((item) => Number(item.price));
  const times = readings.map((item) => Date.parse(item.scrapedAt));
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const pricePadding = Math.max(10, (highest - lowest) * 0.12, highest === lowest ? highest * 0.05 : 0);
  const minPrice = Math.max(0, lowest - pricePadding);
  const maxPrice = highest + pricePadding;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const x = (time) => maxTime === minTime ? LEFT + plotWidth / 2 : LEFT + ((time - minTime) / (maxTime - minTime)) * plotWidth;
  const y = (price) => TOP + ((maxPrice - price) / (maxPrice - minPrice)) * plotHeight;
  const points = readings.map((item, index) => ({
    x: x(times[index]), y: y(prices[index]), item,
  }));
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const ticks = [maxPrice, (maxPrice + minPrice) / 2, minPrice];

  return <div className="chart-wrap">
    <svg className="price-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Price over scrape time for ${readings.length} saved readings`}>
      <title>Price history over scrape time</title>
      {ticks.map((value, index) => <g key={index}>
        <line className="chart-grid-line" x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} />
        <text className="chart-axis-label" x={LEFT - 10} y={y(value) + 4} textAnchor="end">{formatPrice(Math.round(value), readings[0].currency)}</text>
      </g>)}
      {points.length > 1 && <polyline className="chart-line" points={line} />}
      {points.map((point) => <circle className="chart-point" key={point.item.id} cx={point.x} cy={point.y} r="5">
        <title>{`${formatPrice(point.item.price, point.item.currency)} on ${new Date(point.item.scrapedAt).toLocaleString()}`}</title>
      </circle>)}
      <text className="chart-axis-label" x={points[0].x} y={HEIGHT - 13} textAnchor={points.length === 1 ? 'middle' : 'start'}>{timeLabel(readings[0].scrapedAt)}</text>
      {points.length > 1 && <text className="chart-axis-label" x={points[points.length - 1].x} y={HEIGHT - 13} textAnchor="end">{timeLabel(readings[readings.length - 1].scrapedAt)}</text>}
    </svg>
    {readings.length === 1 && <p className="helper-text">One reading so far. The line appears after the next saved scrape.</p>}
  </div>;
}
