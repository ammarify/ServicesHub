const WIDTH = 96;
const HEIGHT = 32;
const PAD = 3;

// A small trend line for a stat tile: a soft wash under the line and a dot on
// the latest value. The numbers themselves live in the chart below.
export function Sparkline({ values, label }) {
  if (!values || values.length < 2) return null;

  const max = Math.max(...values, 1);
  const x = (i) => PAD + (i * (WIDTH - PAD * 2)) / (values.length - 1);
  const y = (v) => HEIGHT - PAD - (v / max) * (HEIGHT - PAD * 2);
  const points = values.map((v, i) => [x(i), y(v)]);
  const line = points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `M${x(0)},${HEIGHT - PAD} L${line.replaceAll(" ", " L")} L${x(values.length - 1)},${HEIGHT - PAD} Z`;
  const [lastX, lastY] = points.at(-1);

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="shrink-0">
      <path d={area} fill="var(--color-accent)" fillOpacity="0.1" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="3" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  );
}
