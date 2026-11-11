"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Timeseries } from "@/lib/api";
import {
  formatCompact,
  formatDay,
  formatFullDay,
  formatInt,
  METRIC_LABELS,
} from "@/lib/format";

const AXIS_TICK = { fontSize: 12, fill: "var(--color-muted)" };

export function TrendChart({ series }: { series: Timeseries }) {
  const label = METRIC_LABELS[series.metric].full;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={series.points}
        margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-line)" }}
          minTickGap={40}
        />
        <YAxis
          width={64}
          tickFormatter={formatCompact}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-muted)", strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-[0_4px_16px_rgba(21,35,45,0.12)]">
                <p className="text-muted">
                  {formatFullDay(payload[0].payload.date)}
                </p>
                <p className="tabular font-medium text-ink">
                  {label}: {formatInt(payload[0].payload.value)}
                </p>
              </div>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          name={label}
          stroke="var(--color-route)"
          strokeWidth={2}
          fill="var(--color-route)"
          fillOpacity={0.08}
          dot={false}
          activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
