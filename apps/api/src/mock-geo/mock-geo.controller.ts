import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { z } from 'zod';
import { Public } from '../auth/auth.decorators.js';
import { CONFIG, type Config } from '../config.js';
import { periodSchema } from '../shared/schemas.js';
import { generateRange } from './generator.js';

/**
 * Имитация API геосервиса. Стоит в том же процессе только ради простоты запуска:
 * кабинет ходит к ней по HTTP через GEO_API_URL, как к настоящему внешнему сервису.
 */
@Public()
@Controller('mock-geo/v1')
export class MockGeoController {
  private requests = 0;

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  @Get('locations/:externalId/insights')
  insights(
    @Headers('x-api-key') apiKey: string | undefined,
    @Param('externalId') externalId: string,
    @Query({ schema: periodSchema }) query: z.infer<typeof periodSchema>,
  ) {
    if (apiKey !== this.config.GEO_API_KEY) {
      throw new UnauthorizedException('Неверный ключ API');
    }
    const failEvery = this.config.MOCK_GEO_FAIL_EVERY;
    if (failEvery && ++this.requests % failEvery === 0) {
      throw new ServiceUnavailableException('Сервис временно недоступен');
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      locationId: externalId,
      days: generateRange(externalId, query.from, query.to).filter(
        (day) => day.date <= today,
      ),
    };
  }
}
