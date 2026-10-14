import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "../lib/formatters";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2 shadow-card">
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">
        {formatShortDate(label)}
      </div>
      <div className="font-data mt-0.5 text-[13px] font-semibold text-text-primary">
        {payload[0].value} booking{payload[0].value === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export function BookingsTrendChart({ data, isLoading }) {
  const [activeIndex, setActiveIndex] = useState(null);

  return (
    <Card className="flex flex-col">
      <div className="text-[15px] font-semibold text-text-primary">
        Bookings — last 14 days
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              onMouseLeave={() => setActiveIndex(null)}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatShortDate(value)}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                interval={1}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-canvas)" }} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.date}
                    fill="var(--color-accent)"
                    fillOpacity={index === activeIndex ? 1 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
