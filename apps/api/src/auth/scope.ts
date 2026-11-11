import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Branch } from '../db/entities/branch.entity.js';
import type { Actor } from './actor.js';

/** Границы выборки, уже проверенные на права пользователя. */
export interface Scope {
  companyId: string | null;
  branchId: string | null;
}

/**
 * Единственное место, где фильтры из запроса превращаются в границы выборки.
 * Клиенту компания подставляется из его учётной записи; чужая компания в
 * фильтре — 403, чужой или несуществующий филиал — 404 (не выдаём, что он есть).
 */
export async function resolveScope(
  em: EntityManager,
  actor: Actor,
  filter: { companyId?: string; branchId?: string },
): Promise<Scope> {
  if (
    actor.role === 'client' &&
    filter.companyId &&
    filter.companyId !== actor.companyId
  ) {
    throw new ForbiddenException('Нет доступа к данным этой компании');
  }
  const companyId =
    actor.role === 'client' ? actor.companyId : (filter.companyId ?? null);

  if (filter.branchId) {
    const branch = await em.getRepository(Branch).findOneBy({
      id: filter.branchId,
      ...(companyId && { companyId }),
    });
    if (!branch) throw new NotFoundException('Филиал не найден');
  }
  return { companyId, branchId: filter.branchId ?? null };
}

/** Дописывает к SQL условия границ выборки, пополняя список параметров. */
export function scopeSql(
  scope: Scope,
  alias: string,
  params: unknown[],
  branchColumn = 'branch_id',
): string {
  let sql = '';
  if (scope.companyId) {
    params.push(scope.companyId);
    sql += ` AND ${alias}.company_id = $${params.length}`;
  }
  if (scope.branchId) {
    params.push(scope.branchId);
    sql += ` AND ${alias}.${branchColumn} = $${params.length}`;
  }
  return sql;
}
