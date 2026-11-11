export const PRESETS = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;
/** Предел API: запрос за больший период вернёт ошибку. */
export const MAX_PERIOD_DAYS = 366;

export interface Period {
  from: string;
  to: string;
  /** Число дней пресета; null — период задан вручную. */
  days: number | null;
}

/** Локальная дата пользователя в формате YYYY-MM-DD. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Период из адресной строки: ручные даты, пресет или 30 дней по умолчанию. */
export function readPeriod(params: URLSearchParams): Period {
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && ISO_DAY.test(from) && ISO_DAY.test(to)) {
    return { from, to, days: null };
  }
  const requested = Number(params.get("days"));
  const days = (PRESETS as readonly number[]).includes(requested)
    ? requested
    : DEFAULT_DAYS;
  return { from: daysAgo(days - 1), to: isoDay(new Date()), days };
}
