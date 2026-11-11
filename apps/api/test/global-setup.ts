import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/db/data-source.js';
import { provisionAppRole } from '../src/db/provision.js';

/**
 * Поднимает чистый PostgreSQL в контейнере и накатывает миграции.
 * Если Docker недоступен, можно передать пустую базу в TEST_DATABASE_URL
 * (подключение владельцем: тестам нужно создавать роли и таблицы).
 */
export default async function setup() {
  const container = process.env.TEST_DATABASE_URL
    ? null
    : await new PostgreSqlContainer('postgres:18-alpine').start();

  const ownerUrl =
    process.env.TEST_DATABASE_URL ?? container!.getConnectionUri();
  const appUrl = new URL(ownerUrl);
  appUrl.username = 'cabinet_app';
  appUrl.password = 'app-test-password';
  process.env.DATABASE_OWNER_URL = ownerUrl;
  process.env.DATABASE_URL = appUrl.toString();
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
  process.env.GEO_API_URL = 'http://geo.invalid';
  process.env.GEO_API_KEY = 'test-geo-key';

  const dataSource = new DataSource(dataSourceOptions(ownerUrl));
  await dataSource.initialize();
  await dataSource.runMigrations();
  await provisionAppRole(dataSource, process.env.DATABASE_URL);
  await dataSource.destroy();

  return async () => {
    await container?.stop();
  };
}
