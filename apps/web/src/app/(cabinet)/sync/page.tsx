"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { buttonClass, Notice, Panel, Select, Skeleton } from "@/components/ui";
import { api, type SyncRun } from "@/lib/api";
import { formatDateTime, formatFullDay, formatInt } from "@/lib/format";
import { daysAgo, isoDay } from "@/lib/period";
import { useUser } from "@/lib/session";

const STATUS: Record<SyncRun["status"], { label: string; tone: string }> = {
  running: { label: "Выполняется", tone: "text-route" },
  success: { label: "Успешно", tone: "text-up" },
  partial: { label: "Частично", tone: "text-down" },
  failed: { label: "Ошибка", tone: "text-down" },
};

/** Случайный ключ запроса. crypto.randomUUID не подходит: по HTTP вне localhost его нет. */
const newKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export default function SyncPage() {
  const user = useUser();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(7);
  const isAdmin = user.role === "admin";

  const runs = useQuery({
    queryKey: ["sync-runs"],
    queryFn: () => api<SyncRun[]>("/sync/runs"),
    enabled: isAdmin,
  });

  const sync = useMutation({
    // Ключ создаётся один раз на нажатие и повторяется при автоповторе запроса:
    // если ответ потерялся в сети, сервер вернёт уже записанный результат,
    // а не запустит загрузку второй раз.
    mutationFn: (idempotencyKey: string) =>
      api<SyncRun>("/sync/metrics", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          from: daysAgo(days - 1),
          to: isoDay(new Date()),
        }),
      }),
    retry: (failures, error) =>
      failures < 2 &&
      "status" in error &&
      (error.status === 0 || error.status === 502),
    onSettled: () => queryClient.invalidateQueries(),
  });

  if (!isAdmin) {
    return (
      <Panel>
        <Notice title="Раздел доступен только администратору">
          Синхронизацию с геосервисом запускает администратор. Ваши показатели
          обновляются автоматически после неё.
        </Notice>
      </Panel>
    );
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">
          Синхронизация с геосервисом
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Кабинет запрашивает статистику карточек у внешнего сервиса и сохраняет
          её в базе. Повторный запуск за тот же период безопасен: дубли не
          появляются, обновляются только изменившиеся дни.
        </p>
      </div>

      <Panel className="flex flex-wrap items-end gap-3 p-5">
        <Select
          label="За какой период загрузить"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={7}>Последние 7 дней</option>
          <option value={14}>Последние 14 дней</option>
          <option value={30}>Последние 30 дней</option>
        </Select>
        <button
          type="button"
          className={buttonClass}
          disabled={sync.isPending}
          onClick={() => sync.mutate(newKey())}
        >
          {sync.isPending ? "Загружаем статистику…" : "Загрузить статистику"}
        </button>
        <div aria-live="polite" className="basis-full text-sm">
          {sync.isError && (
            <p className="text-down">
              Синхронизация не запущена: {sync.error.message}
            </p>
          )}
          {sync.data && (
            <p className={STATUS[sync.data.status].tone}>
              {sync.data.status === "success"
                ? `Готово. Получено строк: ${formatInt(sync.data.rowsReceived)}, из них новых или изменённых: ${formatInt(sync.data.rowsChanged)}.`
                : `Загрузка завершилась с ошибками по ${sync.data.branchesFailed} из ${sync.data.branchesTotal} филиалов. ${sync.data.error ?? ""}`}
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <h2 className="px-5 pt-4 font-display text-lg font-semibold">
          История запусков
        </h2>
        {runs.isError ? (
          <Notice
            tone="error"
            title="Не удалось загрузить историю"
            action={{ label: "Повторить", onClick: () => void runs.refetch() }}
          >
            {runs.error.message}
          </Notice>
        ) : !runs.data ? (
          <div className="flex flex-col gap-2 p-5">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : runs.data.length === 0 ? (
          <Notice title="Запусков ещё не было">
            Нажмите «Загрузить статистику», чтобы получить свежие данные.
          </Notice>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th scope="col" className="px-5 py-3 font-normal">
                    Запущена
                  </th>
                  <th scope="col" className="px-3 py-3 font-normal">
                    Период
                  </th>
                  <th scope="col" className="px-3 py-3 font-normal">
                    Результат
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    Филиалов
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    Получено строк
                  </th>
                  <th
                    scope="col"
                    className="py-3 pl-3 pr-5 text-right font-normal"
                  >
                    Изменено
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="tabular whitespace-nowrap px-5 py-3">
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatFullDay(run.dateFrom)} —{" "}
                      {formatFullDay(run.dateTo)}
                    </td>
                    <td
                      className={`px-3 py-3 font-medium ${STATUS[run.status].tone}`}
                      title={run.error ?? undefined}
                    >
                      {STATUS[run.status].label}
                      {run.branchesFailed > 0 && (
                        <span className="font-normal text-muted">
                          {" "}
                          — не загружено филиалов: {run.branchesFailed}
                        </span>
                      )}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {formatInt(run.branchesTotal)}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {formatInt(run.rowsReceived)}
                    </td>
                    <td className="tabular py-3 pl-3 pr-5 text-right">
                      {formatInt(run.rowsChanged)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
