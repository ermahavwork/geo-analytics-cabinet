import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { type Actor, CurrentActor } from '../auth/actor.js';
import { resolveScope } from '../auth/scope.js';
import { Review, REVIEW_STATUSES } from '../db/entities/review.entity.js';
import { TenantDb } from '../db/tenant-db.js';
import { offset, pagedScopeSchema } from '../shared/schemas.js';

const status = z.enum(REVIEW_STATUSES);

const listSchema = pagedScopeSchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  status: status.optional(),
});
const updateSchema = z.object({ status });

const toDto = (review: Review) => ({
  id: review.id,
  branch: { id: review.branch.id, name: review.branch.name },
  authorName: review.authorName,
  rating: review.rating,
  text: review.text,
  status: review.status,
  publishedAt: review.publishedAt,
});

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly tenantDb: TenantDb) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Query({ schema: listSchema }) query: z.infer<typeof listSchema>,
  ) {
    return this.tenantDb.run(actor, async (em) => {
      const scope = await resolveScope(em, actor, query);
      const [reviews, total] = await em.getRepository(Review).findAndCount({
        where: {
          ...(scope.companyId && { companyId: scope.companyId }),
          ...(scope.branchId && { branchId: scope.branchId }),
          ...(query.rating && { rating: query.rating }),
          ...(query.status && { status: query.status }),
        },
        relations: { branch: true },
        order: { publishedAt: 'DESC', id: 'DESC' },
        skip: offset(query),
        take: query.limit,
      });
      return { items: reviews.map(toDto), total };
    });
  }

  @Patch(':id')
  setStatus(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>,
  ) {
    return this.tenantDb.run(actor, async (em) => {
      const review = await em.getRepository(Review).findOne({
        where: { id, ...(actor.companyId && { companyId: actor.companyId }) },
        relations: { branch: true },
      });
      if (!review) throw new NotFoundException('Отзыв не найден');
      await em.query(
        `UPDATE reviews SET status = $1, updated_at = now() WHERE id = $2`,
        [body.status, id],
      );
      review.status = body.status;
      return toDto(review);
    });
  }
}
