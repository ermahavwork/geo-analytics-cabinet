"use client";

import { useState } from "react";
import { isoDay, MAX_PERIOD_DAYS, PRESETS, type Period } from "@/lib/period";
import { useFilters } from "@/lib/use-filters";
import { fieldClass } from "./ui";

const DAY_MS = 86_400_000;

/** Почему период нельзя применить; null — можно. */
function problem(from: string, to: string): string | null {
  if (!from || !to) return "Укажите обе даты";
  if (from > to) return "Начало периода позже окончания";
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS >= MAX_PERIOD_DAYS) {
    return `Период не может быть длиннее ${MAX_PERIOD_DAYS} дней`;
  }
  return null;
}

/**
 * Поля дат хранят черновик: пока год набирается с клавиатуры, значение бывает
 * промежуточным. В адрес и в запросы уходит только корректный период.
 */
function DateRange({ period }: { period: Period }) {
  const { set } = useFilters();
  const [draft, setDraft] = useState({ from: period.from, to: period.to });
  const today = isoDay(new Date());
  const error = problem(draft.from, draft.to);

  const change = (next: typeof draft) => {
    setDraft(next);
    if (!problem(next.from, next.to)) {
      set({ days: null, from: next.from, to: next.to, page: null });
    }
  };

  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-muted">
        С
        <input
          type="date"
          className={fieldClass}
          value={draft.from}
          max={today}
          aria-invalid={Boolean(error)}
          onChange={(event) => change({ ...draft, from: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        По
        <input
          type="date"
          className={fieldClass}
          value={draft.to}
          max={today}
          aria-invalid={Boolean(error)}
          onChange={(event) => change({ ...draft, to: event.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className="basis-full text-right text-xs text-down">
          {error}
        </p>
      )}
    </>
  );
}

export function PeriodFilter({ period }: { period: Period }) {
  const { set } = useFilters();
  return (
    <div className="flex flex-wrap items-end justify-end gap-3">
      <div className="flex flex-col gap-1 text-xs text-muted">
        Период
        <div
          role="group"
          aria-label="Период"
          className="flex h-10 overflow-hidden rounded-lg border border-line bg-surface"
        >
          {PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={period.days === days}
              onClick={() =>
                set({ days: String(days), from: null, to: null, page: null })
              }
              className={`px-3 text-sm transition-colors ${
                period.days === days
                  ? "bg-ink text-white"
                  : "text-ink hover:bg-canvas"
              }`}
            >
              {days} дней
            </button>
          ))}
        </div>
      </div>
      {/* key: при смене периода извне черновик начинается с новых дат. */}
      <DateRange key={`${period.from}:${period.to}`} period={period} />
    </div>
  );
}
