import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { type Scope, scopeSql } from '../auth/scope.js';
import { CONFIG, type Config } from '../config.js';
import { previousPeriod } from '../shared/period.js';

/** Показатель из запроса → столбец. Имя столбца никогда не берётся из запроса напрямую. */
export const METRIC_COLUMNS = {
  views: 'views',
  siteClicks: 'site_clicks',
  calls: 'calls',
  routes: 'routes',
} as const;
export type Metric = keyof typeof METRIC_COLUMNS;

const METRIC_SUMS = Object.entries(METRIC_COLUMNS)
  .map(([key, column]) => `coalesce(sum(${column}), 0)::float8 AS "${key}"`)
  .join(', ');

/** Границы периода для отзывов: дни считаются в часовом поясе отчёта ($1, $2 — даты, $3 — пояс). */
const REVIEW_PERIOD = `published_at >= ($1::date)::timestamp AT TIME ZONE $3
   AND published_at < ($2::date + 1)::timestamp AT TIME ZONE $3`;
const REVIEW_AGGREGATES = `count(*)::int AS "reviewsCount", round(avg(rating), 2)::float8 AS "avgRating"`;

@Injectable()
export class AnalyticsService {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  async summary(em: EntityManager, scope: Scope, from: string, to: string) {
    const previous = previousPeriod(from, to);
    return {
      period: { from, to },
      current: await this.totals(em, scope, from, to),
      previousPeriod: previous,
      previous: await this.totals(em, scope, previous.from, previous.to),
    };
  }

  private async totals(
    em: EntityManager,
    scope: Scope,
    from: string,
    to: string,
  ) {
    const params: unknown[] = [from, to, this.config.REPORT_TIMEZONE];
    const [row] = await em.query(
      `SELECT m.*, r.*
         FROM (SELECT ${METRIC_SUMS} FROM daily_metrics m
                WHERE m.date BETWEEN $1 AND $2 ${scopeSql(scope, 'm', params)}) m,
              (SELECT ${REVIEW_AGGREGATES} FROM reviews r
                WHERE ${REVIEW_PERIOD} ${scopeSql(scope, 'r', params)}) r`,
      params,
    );
    return row;
  }

  /**
   * Ряд по дням без пропусков: дни без данных приходят нулями. Агрегат считается
   * по явному диапазону дат (он попадает в индекс) и только потом ложится на календарь.
   */
  async timeseries(
    em: EntityManager,
    scope: Scope,
    metric: Metric,
    from: string,
    to: string,
  ) {
    const params: unknown[] = [from, to];
    const points = await em.query(
      `SELECT d::date::text AS date, coalesce(a.value, 0)::float8 AS value
         FROM generate_series($1::date, $2::date, interval '1 day') AS d
         LEFT JOIN (
           SELECT m.date, sum(m.${METRIC_COLUMNS[metric]}) AS value
             FROM daily_metrics m
            WHERE m.date BETWEEN $1 AND $2 ${scopeSql(scope, 'm', params)}
            GROUP BY m.date) a ON a.date = d::date
        ORDER BY d`,
      params,
    );
    return { metric, points };
  }

  /**
   * Показатели по каждому филиалу. Сначала выбирается страница филиалов, затем
   * агрегаты считаются только для неё — стоимость не растёт с числом филиалов.
   */
  async byBranch(
    em: EntityManager,
    scope: Scope,
    from: string,
    to: string,
    page: { limit: number; offset: number },
  ) {
    const countParams: unknown[] = [];
    const [{ total }] = await em.query(
      `SELECT count(*)::int AS total FROM branches b
        WHERE true ${scopeSql(scope, 'b', countParams, 'id')}`,
      countParams,
    );

    const params: unknown[] = [from, to, this.config.REPORT_TIMEZONE];
    const where = scopeSql(scope, 'b', params, 'id');
    params.push(page.limit, page.offset);
    const rows = await em.query(
      `WITH page AS (
         SELECT b.id, b.company_id AS "companyId", b.name, b.city, b.address, c.name AS "companyName"
           FROM branches b JOIN companies c ON c.id = b.company_id
          WHERE true ${where}
          ORDER BY b.name, b.id
          LIMIT $${params.length - 1} OFFSET $${params.length}
       )
       SELECT page.*, m.*, r.*
         FROM page
         LEFT JOIN LATERAL (
           SELECT ${METRIC_SUMS} FROM daily_metrics
            WHERE branch_id = page.id AND date BETWEEN $1 AND $2) m ON true
         LEFT JOIN LATERAL (
           SELECT ${REVIEW_AGGREGATES} FROM reviews
            WHERE branch_id = page.id AND ${REVIEW_PERIOD}) r ON true
        ORDER BY page.name, page.id`,
      params,
    );
    const items = rows.map(
      ({
        id,
        companyId,
        name,
        city,
        address,
        companyName,
        ...metrics
      }: any) => ({
        branch: { id, companyId, name, city, address, companyName },
        ...metrics,
      }),
    );
    return { items, total };
  }
}
