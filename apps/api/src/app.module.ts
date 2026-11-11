import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller.js';
import { AnalyticsService } from './analytics/analytics.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BranchesController } from './branches/branches.controller.js';
import { CoreModule } from './core.module.js';
import { HealthController } from './health/health.controller.js';
import { MockGeoController } from './mock-geo/mock-geo.controller.js';
import { ReviewsController } from './reviews/reviews.controller.js';
import { GeoClient } from './sync/geo-client.js';
import { SyncController } from './sync/sync.controller.js';
import { SyncService } from './sync/sync.service.js';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [
    HealthController,
    BranchesController,
    AnalyticsController,
    ReviewsController,
    SyncController,
    MockGeoController,
  ],
  providers: [AnalyticsService, SyncService, GeoClient],
})
export class AppModule {}
