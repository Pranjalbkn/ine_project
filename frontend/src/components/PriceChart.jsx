import { formatIndiaChartDate, formatIndiaDateTime, formatPrice } from '../format.js';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 240;
const LEFT_MARGIN = 72;
const RIGHT_MARGIN = 20;
const TOP_MARGIN = 18;
const BOTTOM_MARGIN = 42;

export default function PriceChart({ history }) {
  const readings = [...history]
    .filter((reading) => (
      Number.isFinite(Number(reading.price))
      && Number.isFinite(Date.parse(reading.scrapedAt))
    ))
    .sort((first, second) => Date.parse(first.scrapedAt) - Date.parse(second.scrapedAt));

  if (readings.length === 0) {
    return (
      <div className="chart-empty">
        No price history yet.
      </div>
    );
  }

  const prices = readings.map((reading) => Number(reading.price));
  const times = readings.map((reading) => Date.parse(reading.scrapedAt));
  const firstTime = times[0];
  const lastTime = times[times.length - 1];
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);

  // Give a flat price line some space above and below it.
  const pricePadding = Math.max(
    10,
    (highestPrice - lowestPrice) * 0.12,
    highestPrice === lowestPrice ? highestPrice * 0.05 : 0,
  );
  const chartMinPrice = Math.max(0, lowestPrice - pricePadding);
  const chartMaxPrice = highestPrice + pricePadding;
  const plotWidth = CHART_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  const plotHeight = CHART_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;

  function xPosition(time) {
    if (firstTime === lastTime) return LEFT_MARGIN + plotWidth / 2;
    return LEFT_MARGIN + ((time - firstTime) / (lastTime - firstTime)) * plotWidth;
  }

  function yPosition(price) {
    return TOP_MARGIN + ((chartMaxPrice - price) / (chartMaxPrice - chartMinPrice)) * plotHeight;
  }

  const points = readings.map((reading, index) => ({
    x: xPosition(times[index]),
    y: yPosition(prices[index]),
    reading,
  }));
  const linePoints = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const priceLabels = [
    chartMaxPrice,
    (chartMaxPrice + chartMinPrice) / 2,
    chartMinPrice,
  ];

  return (
    <div className="chart-wrap">
      <svg
        className="price-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Price over scrape time for ${readings.length} saved readings`}
      >
        <title>Price history over scrape time</title>

        {priceLabels.map((price, index) => (
          <g key={index}>
            <line
              className="chart-grid-line"
              x1={LEFT_MARGIN}
              x2={CHART_WIDTH - RIGHT_MARGIN}
              y1={yPosition(price)}
              y2={yPosition(price)}
            />
            <text
              className="chart-axis-label"
              x={LEFT_MARGIN - 10}
              y={yPosition(price) + 4}
              textAnchor="end"
            >
              {formatPrice(Math.round(price), readings[0].currency)}
            </text>
          </g>
        ))}

        {points.length > 1 && <polyline className="chart-line" points={linePoints} />}
        {points.map((point) => (
          <circle
            className="chart-point"
            key={point.reading.id}
            cx={point.x}
            cy={point.y}
            r="5"
          >
            <title>
              {`${formatPrice(point.reading.price, point.reading.currency)} on ${formatIndiaDateTime(point.reading.scrapedAt)}`}
            </title>
          </circle>
        ))}

        <text
          className="chart-axis-label"
          x={points[0].x}
          y={CHART_HEIGHT - 13}
          textAnchor={points.length === 1 ? 'middle' : 'start'}
        >
          {formatIndiaChartDate(readings[0].scrapedAt)}
        </text>
        {points.length > 1 && (
          <text
            className="chart-axis-label"
            x={points[points.length - 1].x}
            y={CHART_HEIGHT - 13}
            textAnchor="end"
          >
            {formatIndiaChartDate(readings[readings.length - 1].scrapedAt)}
          </text>
        )}
      </svg>

    </div>
  );
}
