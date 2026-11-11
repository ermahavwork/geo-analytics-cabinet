import { Controller, Get, Query } from '@nestjs/common';
import type { z } from 'zod';
import { type Actor, CurrentActor } from '../auth/actor.js';
import { resolveScope } from '../auth/scope.js';
import { Branch } from '../db/entities/branch.entity.js';
import { Company } from '../db/entities/company.entity.js';
import { TenantDb } from '../db/tenant-db.js';
import { offset, pagedScopeSchema } from '../shared/schemas.js';

@Controller()
export class BranchesController {
  constructor(private readonly tenantDb: TenantDb) {}

  @Get('companies')
  companies(@CurrentActor() actor: Actor) {
    return this.tenantDb.run(actor, (em) =>
      em.getRepository(Company).find({
        where: actor.companyId ? { id: actor.companyId } : {},
        order: { name: 'ASC' },
      }),
    );
  }

  @Get('branches')
  list(
    @CurrentActor() actor: Actor,
    @Query({ schema: pagedScopeSchema })
    query: z.infer<typeof pagedScopeSchema>,
  ) {
    return this.tenantDb.run(actor, async (em) => {
      const { companyId } = await resolveScope(em, actor, query);
      const [items, total] = await em.getRepository(Branch).findAndCount({
        select: {
          id: true,
          companyId: true,
          name: true,
          city: true,
          address: true,
        },
        where: companyId ? { companyId } : {},
        order: { name: 'ASC', id: 'ASC' },
        skip: offset(query),
        take: query.limit,
      });
      return { items, total };
    });
  }
}
