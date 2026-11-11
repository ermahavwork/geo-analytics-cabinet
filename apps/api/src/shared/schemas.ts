import { z } from 'zod';
import { daysBetween } from './period.js';

const MAX_PERIOD_DAYS = 366;

const scope = {
  companyId: z.uuid().optional(),
  branchId: z.uuid().optional(),
};

const page = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
};

const period = {
  from: z.iso.date(),
  to: z.iso.date(),
};

/** Общая проверка периода: порядок дат и предел длины, чтобы запрос не стал неподъёмным. */
function checkPeriod<T extends z.ZodType<{ from: string; to: string }>>(
  schema: T,
) {
  return schema
    .refine((v) => v.from <= v.to, {
      path: ['from'],
      message: 'Дата начала периода позже даты окончания',
    })
    .refine((v) => daysBetween(v.from, v.to) < MAX_PERIOD_DAYS, {
      path: ['to'],
      message: `Период не может быть длиннее ${MAX_PERIOD_DAYS} дней`,
    });
}

export const pagedScopeSchema = z.object({ ...scope, ...page });
export const periodSchema = checkPeriod(z.object(period));
export const periodScopeSchema = checkPeriod(z.object({ ...period, ...scope }));
export const pagedPeriodSchema = checkPeriod(
  z.object({ ...period, companyId: scope.companyId, ...page }),
);

export const offset = (q: { page: number; limit: number }): number =>
  (q.page - 1) * q.limit;
