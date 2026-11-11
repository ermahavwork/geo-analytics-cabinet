import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import type { z } from 'zod';
import { type Actor, CurrentActor } from '../auth/actor.js';
import { Roles } from '../auth/auth.decorators.js';
import { daysBetween } from '../shared/period.js';
import { periodSchema } from '../shared/schemas.js';
import { SyncService } from './sync.service.js';

const MAX_SYNC_DAYS = 31;

const syncSchema = periodSchema.refine(
  (v) => daysBetween(v.from, v.to) < MAX_SYNC_DAYS,
  {
    path: ['to'],
    message: `За один запуск можно загрузить не более ${MAX_SYNC_DAYS} дня`,
  },
);

@Roles(['admin'])
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('metrics')
  @HttpCode(200)
  run(
    @CurrentActor() actor: Actor,
    @Body({ schema: syncSchema }) body: z.infer<typeof syncSchema>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey && idempotencyKey.length > 100) {
      throw new BadRequestException('Idempotency-Key длиннее 100 символов');
    }
    return this.sync.run(actor, body.from, body.to, idempotencyKey);
  }

  @Get('runs')
  history() {
    return this.sync.history();
  }
}
