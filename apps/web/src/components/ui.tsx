import {
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useId,
} from "react";

export const fieldClass =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

export const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-lg bg-route px-4 text-sm font-medium text-white transition-colors hover:bg-[#1d47a8] disabled:cursor-not-allowed disabled:opacity-60";

export const ghostButtonClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-50";

export function Select({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <select
        {...props}
        id={id}
        className={`${fieldClass} min-w-40 max-w-full ${className}`}
      >
        {children}
      </select>
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface ${className}`}
    >
      {children}
    </section>
  );
}

/** Сообщение на месте данных: ошибка с повтором или пустой результат с подсказкой. */
export function Notice({
  tone = "empty",
  title,
  children,
  action,
}: {
  tone?: "empty" | "error";
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex flex-col items-start gap-2 px-5 py-8 text-sm"
    >
      <p
        className={`font-medium ${tone === "error" ? "text-down" : "text-ink"}`}
      >
        {title}
      </p>
      {children && <p className="max-w-prose text-muted">{children}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`${ghostButtonClass} mt-1`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-canvas ${className}`}
    />
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.ceil(total / limit);
  // Список стал короче (сменили статус, устарела ссылка) — возвращаем на последнюю страницу.
  const beyond = pages > 0 && page > pages;
  useEffect(() => {
    if (beyond) onPage(pages);
  }, [beyond, pages, onPage]);
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Страницы"
      className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
    >
      <span className="tabular text-muted">
        Страница {page} из {pages}
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          className={ghostButtonClass}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Назад
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Вперёд
        </button>
      </span>
    </nav>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`Оценка ${rating} из 5`}
      className="whitespace-nowrap text-base leading-none"
    >
      <span className="text-[#e0a100]">{"★".repeat(rating)}</span>
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
