"use client";

import Link from "next/link";
import { METRICS, type Metric, type Summary } from "@/lib/api";
import {
  formatDay,
  formatInt,
  formatRating,
  METRIC_LABELS,
} from "@/lib/format";
import { Skeleton } from "./ui";

/** Изменение к предыдущему периоду: стрелка и текст, чтобы смысл не держался на одном цвете. */
function Delta({
  current,
  previous,
  absolute = false,
}: {
  current: number | null;
  previous: number | null;
  absolute?: boolean;
}) {
  if (current === null || previous === null || (!absolute && previous === 0)) {
    return <span className="text-xs text-muted">не с чем сравнить</span>;
  }
  const change = absolute
    ? current - previous
    : ((current - previous) / previous) * 100;
  const rounded =
    Math.round(change * (absolute ? 100 : 10)) / (absolute ? 100 : 10);
  if (rounded === 0)
    return <span className="text-xs text-muted">без изменений</span>;
  const text =
    Math.abs(rounded).toLocaleString("ru-RU") + (absolute ? "" : " %");
  return (
    <span
      className={`tabular text-xs font-medium ${rounded > 0 ? "text-up" : "text-down"}`}
    >
      {rounded > 0 ? "▲" : "▼"} {text}
    </span>
  );
}

const cellClass = "flex min-w-0 flex-col gap-1.5 px-5 py-4 text-left";
const valueClass =
  "font-display tabular text-[1.75rem] font-semibold leading-none tracking-tight";

/**
 * Шесть показателей одной полосой. Четыре счётчика — кнопки: нажатие выбирает,
 * что показывает график ниже, так что сводка служит ему и подписью, и переключателем.
 */
export function KpiStrip({
  summary,
  metric,
  onMetric,
  reviewsHref,
}: {
  summary: Summary | undefined;
  metric: Metric;
  onMetric: (metric: Metric) => void;
  reviewsHref: string;
}) {
  const value = (content: string) =>
    summary ? (
      <span className={valueClass}>{content}</span>
    ) : (
      <Skeleton className="h-7 w-24" />
    );

  return (
    <div>
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-line gap-px md:grid-cols-3 xl:grid-cols-6">
        {METRICS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={metric === key}
            onClick={() => onMetric(key)}
            className={`${cellClass} relative transition-colors ${
              metric === key ? "bg-route-soft" : "bg-surface hover:bg-canvas"
            }`}
          >
            {metric === key && (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-route"
              />
            )}
            <span className="text-sm text-muted">
              {METRIC_LABELS[key].full}
            </span>
            {value(summary ? formatInt(summary.current[key]) : "")}
            {summary && (
              <Delta
                current={summary.current[key]}
                previous={summary.previous[key]}
              />
            )}
          </button>
        ))}
        <Link
          href={reviewsHref}
          className={`${cellClass} bg-surface transition-colors hover:bg-canvas`}
        >
          <span className="text-sm text-muted">Средний рейтинг</span>
          {value(summary ? formatRating(summary.current.avgRating) : "")}
          {summary && (
            <Delta
              absolute
              current={summary.current.avgRating}
              previous={summary.previous.avgRating}
            />
          )}
        </Link>
        <Link
          href={reviewsHref}
          className={`${cellClass} bg-surface transition-colors hover:bg-canvas`}
        >
          <span className="text-sm text-muted">Отзывы</span>
          {value(summary ? formatInt(summary.current.reviewsCount) : "")}
          {summary && (
            <Delta
              current={summary.current.reviewsCount}
              previous={summary.previous.reviewsCount}
            />
          )}
        </Link>
      </div>
      {summary && (
        <p className="mt-2 px-1 text-xs text-muted">
          Стрелки показывают изменение к предыдущему периоду той же длины:{" "}
          {formatDay(summary.previousPeriod.from)} —{" "}
          {formatDay(summary.previousPeriod.to)}
        </p>
      )}
    </div>
  );
}
