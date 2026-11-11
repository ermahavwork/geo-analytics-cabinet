import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { Actor } from '../auth/actor.js';

@Injectable()
export class TenantDb {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Выполняет работу в транзакции с контекстом пользователя, по которому
   * PostgreSQL фильтрует строки (Row-Level Security). Контекст живёт до конца
   * транзакции, поэтому не утекает в соседние запросы через пул соединений
   * и совместим с PgBouncer в режиме transaction.
   */
  run<T>(actor: Actor, work: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (em) => {
      await em.query(
        `SELECT set_config('app.company_id', $1, true),
                set_config('app.is_admin', $2, true)`,
        [actor.companyId ?? '', String(actor.role === 'admin')],
      );
      return work(em);
    });
  }
}
