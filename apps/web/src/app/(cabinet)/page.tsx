"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BranchTable } from "@/components/branch-table";
import { KpiStrip } from "@/components/kpi-strip";
import { PeriodFilter } from "@/components/period-filter";
import {
  ScopeFilters,
  useBranches,
  useScope,
} from "@/components/scope-filters";
import { TrendChart } from "@/components/trend-chart";
import { Notice, Pagination, Panel, Skeleton } from "@/components/ui";
import {
  api,
  type BranchStats,
  METRICS,
  type Metric,
  type Paged,
  query,
  type Summary,
  type Timeseries,
} from "@/lib/api";
import { formatFullDay, METRIC_LABELS } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { useUser } from "@/lib/session";
import { useFilters } from "@/lib/use-filters";

const BRANCHES_PER_PAGE = 10;

export default function DashboardPage() {
  const user = useUser();
  const { params, set } = useFilters();
  const { companyId, branchId } = useScope();
  const period = readPeriod(params);
  const requestedMetric = params.get("metric") as Metric;
  const metric = METRICS.includes(requestedMetric) ? requestedMetric : "views";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const range = { from: period.from, to: period.to };
  const scope = {
    ...range,
    companyId: user.role === "admin" ? companyId : null,
    branchId,
  };

  const summary = useQuery({
    queryKey: ["summary", scope],
    queryFn: () => api<Summary>(`/analytics/summary?${query(scope)}`),
    placeholderData: keepPreviousData,
  });
  const series = useQuery({
    queryKey: ["timeseries", scope, metric],
    queryFn: () =>
      api<Timeseries>(`/analytics/timeseries?${query({ ...scope, metric })}`),
    placeholderData: keepPreviousData,
  });
  const branchStats = useQuery({
    queryKey: ["branch-stats", range, scope.companyId, page],
    queryFn: () =>
      api<Paged<BranchStats>>(
        `/analytics/branches?${query({ ...range, companyId: scope.companyId, page, limit: BRANCHES_PER_PAGE })}`,
      ),
    placeholderData: keepPreviousData,
  });
  const branches = useBranches(companyId);

  const selectedBranch = branches.data?.items.find(
    (branch) => branch.id === branchId,
  );
  const scopeTitle = selectedBranch
    ? `${selectedBranch.name}, ${selectedBranch.city}`
    : companyId
      ? "Все филиалы компании"
      : "Все компании и филиалы";

  // Устаревшая ссылка, недоступный филиал, слишком длинный период: объясняем и даём сбросить.
  const scopeError = summary.error ?? series.error;
  const filtered = ["company", "branch", "from", "days"].some((key) =>
    params.has(key),
  );
  const hasPoints = series.data?.points.some((point) => point.value > 0);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold">{scopeTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatFullDay(period.from)} — {formatFullDay(period.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ScopeFilters />
          <PeriodFilter period={period} />
        </div>
      </div>

      {scopeError ? (
        <Panel>
          <Notice
            tone="error"
            title="Не удалось загрузить показатели"
            action={
              filtered
                ? {
                    label: "Сбросить фильтры",
                    onClick: () =>
                      set({
                        company: null,
                        branch: null,
                        days: null,
                        from: null,
                        to: null,
                        page: null,
                      }),
                  }
                : {
                    label: "Повторить",
                    onClick: () => {
                      void summary.refetch();
                      void series.refetch();
                    },
                  }
            }
          >
            {scopeError.message}
          </Notice>
        </Panel>
      ) : (
        <>
          <div
            className={
              summary.isPlaceholderData ? "opacity-60 transition-opacity" : ""
            }
          >
            <KpiStrip
              summary={summary.data}
              metric={metric}
              onMetric={(next) =>
                set({ metric: next === "views" ? null : next })
              }
              reviewsHref={`/reviews?${query({ company: scope.companyId, branch: branchId })}`}
            />
          </div>

          <Panel>
            <h2 className="px-5 pt-4 font-display text-lg font-semibold">
              {METRIC_LABELS[metric].full} по дням
            </h2>
            <div
              className={`h-72 px-2 pb-3 pt-2 ${series.isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}
            >
              {!series.data ? (
                <Skeleton className="mx-3 h-full" />
              ) : hasPoints ? (
                <TrendChart series={series.data} />
              ) : (
                <Notice title="За этот период данных нет">
                  Выберите другой период или филиал. Новые данные появляются
                  после синхронизации с геосервисом.
                </Notice>
              )}
            </div>
          </Panel>
        </>
      )}

      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
          <h2 className="font-display text-lg font-semibold">Филиалы</h2>
          <p className="text-sm text-muted">
            Нажмите на филиал, чтобы посмотреть только его показатели
          </p>
        </div>
        {branchStats.isError ? (
          <Notice
            tone="error"
            title="Не удалось загрузить филиалы"
            action={{
              label: "Повторить",
              onClick: () => void branchStats.refetch(),
            }}
          >
            {branchStats.error.message}
          </Notice>
        ) : !branchStats.data ? (
          <div className="flex flex-col gap-2 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : branchStats.data.total === 0 ? (
          <Notice title="Филиалов пока нет">
            У этой компании ещё не добавлено ни одного филиала.
          </Notice>
        ) : (
          <>
            <BranchTable
              rows={branchStats.data.items}
              selectedId={branchId}
              showCompany={!companyId}
              onSelect={(id) => {
                // Администратору без выбранной компании подставляем компанию филиала,
                // чтобы список филиалов в фильтре сразу стал доступен.
                const row = branchStats.data.items.find(
                  (item) => item.branch.id === id,
                );
                set({
                  branch: id,
                  page: null,
                  ...(user.role === "admin" &&
                    row && { company: row.branch.companyId }),
                });
              }}
            />
            <Pagination
              page={page}
              limit={BRANCHES_PER_PAGE}
              total={branchStats.data.total}
              onPage={(next) => set({ page: next === 1 ? null : String(next) })}
            />
          </>
        )}
      </Panel>
    </>
  );
}
