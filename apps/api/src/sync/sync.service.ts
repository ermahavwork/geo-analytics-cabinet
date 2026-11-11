import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Actor } from '../auth/actor.js';
import { Branch } from '../db/entities/branch.entity.js';
import { SyncRun } from '../db/entities/sync-run.entity.js';
import { TenantDb } from '../db/tenant-db.js';
import { GeoClient } from './geo-client.js';

const CONCURRENCY = 5;
const STALE_AFTER = '15 minutes';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantDb: TenantDb,
    private readonly geo: GeoClient,
  ) {}

  /**
   * Загружает статистику всех филиалов за период.
   *
   * Повторы безопасны на трёх уровнях: тот же Idempotency-Key возвращает уже
   * записанный результат; параллельный запуск отсекается уникальным индексом
   * в БД; а сами данные пишутся через upsert по (филиал, дата), так что повторная
   * загрузка не создаёт дублей и не трогает строки, которые не изменились.
   */
  async run(
    actor: Actor,
    from: string,
    to: string,
    idempotencyKey?: string,
  ): Promise<SyncRun> {
    const runs = this.dataSource.getRepository(SyncRun);

    if (idempotencyKey) {
      const previous = await runs.findOneBy({ idempotencyKey });
      if (previous) {
        if (previous.dateFrom !== from || previous.dateTo !== to) {
          throw new ConflictException(
            'Этот Idempotency-Key уже использован для другого периода',
          );
        }
        if (previous.status === 'running') {
          throw new ConflictException('Синхронизация уже выполняется');
        }
        return previous;
      }
    }

    // Запуск, оборванный падением процесса, не должен блокировать синхронизацию навсегда.
    await this.dataSource.query(
      `UPDATE sync_runs SET status = 'failed', finished_at = now(),
              error = 'Запуск прерван: превышено время ожидания'
        WHERE status = 'running' AND started_at < now() - interval '${STALE_AFTER}'`,
    );

    const run = await runs
      .save(
        runs.create({
          idempotencyKey: idempotencyKey ?? null,
          requestedBy: actor.userId,
          dateFrom: from,
          dateTo: to,
        }),
      )
      .catch((error) => {
        if (error.driverError?.code === '23505') {
          throw new ConflictException('Синхронизация уже выполняется');
        }
        throw error;
      });

    const outcome = await this.load(actor, from, to).catch((error) => {
      this.logger.error('Синхронизация завершилась ошибкой', error);
      return {
        status: 'failed' as const,
        error: 'Внутренняя ошибка синхронизации',
      };
    });
    // Условие по статусу: если запуск уже списан как зависший, его итог не
    // затирает запись и не выдаёт прерванный запуск за успешный.
    await runs.update(
      { id: run.id, status: 'running' },
      { ...outcome, finishedAt: new Date() },
    );
    return runs.findOneByOrFail({ id: run.id });
  }

  history(): Promise<SyncRun[]> {
    return this.dataSource
      .getRepository(SyncRun)
      .find({ order: { startedAt: 'DESC' }, take: 20 });
  }

  private async load(actor: Actor, from: string, to: string) {
    const branches = await this.tenantDb.run(actor, (em) =>
      em.getRepository(Branch).find({ order: { id: 'ASC' } }),
    );
    const result = { rowsReceived: 0, rowsChanged: 0 };
    const errors: string[] = [];

    // Запросы наружу идут вне транзакции и ограниченной пачкой; в базу пишет
    // короткая транзакция на филиал, поэтому сбой одного не откатывает остальные.
    const queue = [...branches];
    const worker = async () => {
      for (let branch = queue.shift(); branch; branch = queue.shift()) {
        try {
          const days = await this.geo.insights(branch.externalId, from, to);
          // Сумма прибавляется после await: иначе параллельные обработчики
          // затирали бы счётчик друг друга.
          const changed = await this.upsert(actor, branch, days);
          result.rowsChanged += changed;
          result.rowsReceived += days.length;
        } catch (error) {
          errors.push(`${branch.name}: ${(error as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return {
      ...result,
      branchesTotal: branches.length,
      branchesFailed: errors.length,
      status: !errors.length
        ? 'success'
        : errors.length === branches.length
          ? 'failed'
          : 'partial',
      error: errors.length ? errors.slice(0, 5).join('; ').slice(0, 500) : null,
    } as const;
  }

  /** Возвращает число строк, которые действительно появились или изменились. */
  private async upsert(
    actor: Actor,
    branch: Branch,
    days: object[],
  ): Promise<number> {
    const [{ changed }] = await this.tenantDb.run(actor, (em) =>
      em.query(
        `WITH written AS (
           INSERT INTO daily_metrics (branch_id, company_id, date, views, site_clicks, calls, routes)
           SELECT $1, $2, d.date, d.views, d."siteClicks", d.calls, d.routes
             FROM jsonb_to_recordset($3::jsonb)
               AS d(date date, views int, "siteClicks" int, calls int, routes int)
           ON CONFLICT (branch_id, date) DO UPDATE
             SET views = excluded.views, site_clicks = excluded.site_clicks,
                 calls = excluded.calls, routes = excluded.routes, updated_at = now()
             WHERE (daily_metrics.views, daily_metrics.site_clicks, daily_metrics.calls, daily_metrics.routes)
                   IS DISTINCT FROM (excluded.views, excluded.site_clicks, excluded.calls, excluded.routes)
           RETURNING 1
         )
         SELECT count(*)::int AS changed FROM written`,
        [branch.id, branch.companyId, JSON.stringify(days)],
      ),
    );
    return changed;
  }
}
