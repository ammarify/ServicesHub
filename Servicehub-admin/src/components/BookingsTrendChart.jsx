import clsx from "clsx";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  formatCompactNumber,
  formatCompactUSD,
  formatDateKey,
  formatNumber,
  formatShortWeekdayDate,
  formatUSD,
  parseDateKey,
} from "../lib/formatters";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

const METRICS = {
  count: {
    label: "Bookings",
    format: (value) => `${formatNumber(value)} booking${value === 1 ? "" : "s"}`,
    tick: formatCompactNumber,
  },
  revenue: {
    label: "Revenue",
    format: (value) => formatUSD(value),
    tick: formatCompactUSD,
  },
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2 shadow-pop">
      <div className="text-[12px] text-text-secondary">{formatShortWeekdayDate(parseDateKey(label))}</div>
      <div className="font-data mt-1 text-[13px] font-semibold text-text-primary">{METRICS.count.format(point.count)}</div>
      <div className="font-data text-[12px] text-text-secondary">{formatUSD(point.revenue ?? 0)} completed</div>
    </div>
  );
}

// Last label reads "Today" so the newest bar is easy to find.
function DayTick({ x, y, payload, lastDate }) {
  const isToday = payload.value === lastDate;
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={11}
      fontWeight={isToday ? 600 : 400}
      fill={isToday ? "var(--color-text-primary)" : "var(--color-text-secondary)"}
    >
      {isToday ? "Today" : formatDateKey(payload.value)}
    </text>
  );
}

// `data` is [{ date: "YYYY-MM-DD", count, revenue }], one entry per day in
// the viewer's time zone, oldest first.
export function BookingsTrendChart({ data, isLoading }) {
  const [metric, setMetric] = useState("count");
  const [activeIndex, setActiveIndex] = useState(null);
  const config = METRICS[metric];
  const total = data.reduce((sum, day) => sum + (day[metric] ?? 0), 0);
  const lastDate = data.at(-1)?.date;

  return (
    <Card className="relative flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">
            {config.label}, last {data.length || 14} days
          </h2>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            {isLoading ? "Loading…" : `${metric === "revenue" ? formatUSD(total) : formatNumber(total)} in total`}
            {metric === "revenue" && " from completed jobs"}
          </p>
        </div>

        <div className="inline-flex rounded-btn border border-border bg-canvas p-0.5" role="group" aria-label="Chart metric">
          {Object.entries(METRICS).map(([key, value]) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
              className={clsx(
                "rounded-btn px-2.5 py-1 text-[12px] transition-colors",
                metric === key ? "bg-surface font-medium text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {value.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="mt-5 h-60 w-full" />
      ) : (
        <>
          <div className="mt-5 h-60" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} onMouseLeave={() => setActiveIndex(null)} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={<DayTick lastDate={lastDate} />}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  // Recharts thins labels so they never overlap, always
                  // keeping the last one ("Today").
                  interval="preserveEnd"
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={config.tick}
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-canvas)" }} />
                <Bar
                  dataKey={metric}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.date}
                      fill="var(--color-accent)"
                      fillOpacity={activeIndex === null ? (entry.date === lastDate ? 1 : 0.8) : index === activeIndex ? 1 : 0.55}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The same numbers for screen readers. The wrapper does the hiding:
              a table ignores the height and overflow sr-only sets, so a long
              one (a month of days) would stretch the page and add a second
              scrollbar. */}
          <div className="sr-only">
            <table>
              <caption>
                {config.label} per day, last {data.length} days
              </caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Bookings</th>
                  <th scope="col">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{formatShortWeekdayDate(parseDateKey(day.date))}</th>
                    <td>{day.count}</td>
                    <td>{formatUSD(day.revenue ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
