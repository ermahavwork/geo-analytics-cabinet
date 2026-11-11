import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { type Actor, CurrentActor } from '../auth/actor.js';
import { resolveScope } from '../auth/scope.js';
import { TenantDb } from '../db/tenant-db.js';
import {
  offset,
  pagedPeriodSchema,
  periodScopeSchema,
} from '../shared/schemas.js';
import {
  AnalyticsService,
  METRIC_COLUMNS,
  type Metric,
} from './analytics.service.js';

const timeseriesSchema = periodScopeSchema.and(
  z.object({
    metric: z.enum(Object.keys(METRIC_COLUMNS) as [Metric, ...Metric[]]),
  }),
);

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('summary')
  summary(
    @CurrentActor() actor: Actor,
    @Query({ schema: periodScopeSchema })
    query: z.infer<typeof periodScopeSchema>,
  ) {
    return this.tenantDb.run(actor, async (em) =>
      this.analytics.summary(
        em,
        await resolveScope(em, actor, query),
        query.from,
        query.to,
      ),
    );
  }

  @Get('timeseries')
  timeseries(
    @CurrentActor() actor: Actor,
    @Query({ schema: timeseriesSchema })
    query: z.infer<typeof timeseriesSchema>,
  ) {
    return this.tenantDb.run(actor, async (em) =>
      this.analytics.timeseries(
        em,
        await resolveScope(em, actor, query),
        query.metric,
        query.from,
        query.to,
      ),
    );
  }

  @Get('branches')
  byBranch(
    @CurrentActor() actor: Actor,
    @Query({ schema: pagedPeriodSchema })
    query: z.infer<typeof pagedPeriodSchema>,
  ) {
    return this.tenantDb.run(actor, async (em) =>
      this.analytics.byBranch(
        em,
        await resolveScope(em, actor, query),
        query.from,
        query.to,
        { limit: query.limit, offset: offset(query) },
      ),
    );
  }
}
