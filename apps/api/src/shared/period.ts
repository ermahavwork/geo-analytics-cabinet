const DAY_MS = 86_400_000;

const shift = (date: string, days: number): string =>
  new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

/** Число дней между датами YYYY-MM-DD (0 для одного и того же дня). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Период той же длины, идущий сразу перед заданным. */
export function previousPeriod(from: string, to: string) {
  return { from: shift(from, -daysBetween(from, to) - 1), to: shift(from, -1) };
}
