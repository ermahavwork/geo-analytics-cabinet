import type { DataSourceOptions } from 'typeorm';
import { Branch } from './entities/branch.entity.js';
import { Company } from './entities/company.entity.js';
import { Review } from './entities/review.entity.js';
import { SyncRun } from './entities/sync-run.entity.js';
import { User } from './entities/user.entity.js';
import { Init1762819200000 } from './migrations/1762819200000-init.js';

export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [Company, User, Branch, Review, SyncRun],
    migrations: [Init1762819200000],
  };
}
