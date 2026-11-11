import type { Metric, ReviewStatus } from "./api";

const integer = new Intl.NumberFormat("ru-RU");
const compact = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const decimal = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const dayMonth = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatInt = (value: number) => integer.format(value);
export const formatCompact = (value: number) => compact.format(value);
export const formatRating = (value: number | null) =>
  value === null ? "—" : decimal.format(value);
/** Дата YYYY-MM-DD → «5 мар.» / «5 марта 2026 г.» без сдвига по часовому поясу. */
export const formatDay = (date: string) => dayMonth.format(new Date(date));
export const formatFullDay = (date: string) => fullDate.format(new Date(date));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

export const METRIC_LABELS: Record<Metric, { short: string; full: string }> = {
  views: { short: "Просмотры", full: "Просмотры карточек" },
  siteClicks: { short: "Переходы", full: "Переходы на сайт" },
  calls: { short: "Звонки", full: "Звонки" },
  routes: { short: "Маршруты", full: "Построено маршрутов" },
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  processed: "Обработан",
};
