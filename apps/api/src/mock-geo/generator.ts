import { daysBetween } from '../shared/period.js';

export interface DayStats {
  date: string;
  views: number;
  siteClicks: number;
  calls: number;
  routes: number;
}

/** FNV-1a: строка → 32-битное число. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** Генератор псевдослучайных чисел [0, 1) с заданным зерном (mulberry32). */
export function seededRandom(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Вымышленная статистика карточки за день. Зависит только от идентификатора и
 * даты, поэтому повторный запрос к «внешнему API» возвращает те же числа.
 */
export function generateDay(externalId: string, date: string): DayStats {
  const random = seededRandom(`${externalId}:${date}`);
  const size = 150 + (hash(externalId) % 700);
  const weekday = new Date(date).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 1.25 : 1;
  const growth = 1 + 0.0015 * daysBetween('2026-01-01', date);
  const views = Math.round(size * weekend * growth * (0.8 + random() * 0.4));
  return {
    date,
    views,
    siteClicks: Math.round(views * (0.06 + random() * 0.04)),
    calls: Math.round(views * (0.02 + random() * 0.02)),
    routes: Math.round(views * (0.03 + random() * 0.03)),
  };
}

/** Статистика за каждый день периода включительно. */
export function generateRange(
  externalId: string,
  from: string,
  to: string,
): DayStats[] {
  const days: DayStats[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) {
    days.push(generateDay(externalId, new Date(t).toISOString().slice(0, 10)));
  }
  return days;
}
