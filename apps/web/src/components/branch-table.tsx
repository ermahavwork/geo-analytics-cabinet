"use client";

import type { BranchStats } from "@/lib/api";
import { formatInt, formatRating, METRIC_LABELS } from "@/lib/format";
import { METRICS } from "@/lib/api";

const numberCell = "tabular whitespace-nowrap px-3 py-3 text-right";

/** Показатели по филиалам. Строка — кнопка: выбирает филиал для всей страницы. */
export function BranchTable({
  rows,
  selectedId,
  showCompany,
  onSelect,
}: {
  rows: BranchStats[];
  selectedId: string | null;
  showCompany: boolean;
  onSelect: (branchId: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th scope="col" className="min-w-64 px-5 py-3 font-normal">
              Филиал
            </th>
            {METRICS.map((metric) => (
              <th
                key={metric}
                scope="col"
                className="px-3 py-3 text-right font-normal"
              >
                {METRIC_LABELS[metric].short}
              </th>
            ))}
            <th scope="col" className="px-3 py-3 text-right font-normal">
              Рейтинг
            </th>
            <th scope="col" className="py-3 pl-3 pr-5 text-right font-normal">
              Отзывы
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ branch, ...stats }) => {
            const selected = branch.id === selectedId;
            return (
              <tr
                key={branch.id}
                className={`border-b border-line last:border-0 ${selected ? "bg-route-soft" : "hover:bg-canvas"}`}
              >
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(selected ? null : branch.id)}
                    className="flex items-start gap-2.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2.5 shrink-0 rounded-full border-2 ${
                        selected ? "border-pin bg-pin" : "border-muted"
                      }`}
                    />
                    <span>
                      <span className="block font-medium text-ink">
                        {branch.name}
                      </span>
                      <span className="block text-muted">
                        {showCompany && `${branch.companyName}, `}
                        {branch.city}, {branch.address}
                      </span>
                    </span>
                  </button>
                </th>
                {METRICS.map((metric) => (
                  <td key={metric} className={numberCell}>
                    {formatInt(stats[metric])}
                  </td>
                ))}
                <td className={numberCell}>{formatRating(stats.avgRating)}</td>
                <td className={`${numberCell} pr-5`}>
                  {formatInt(stats.reviewsCount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
