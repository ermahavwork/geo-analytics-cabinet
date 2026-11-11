import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { APP_OPTIONS, configureApp } from '../src/app.setup.js';
import { dataSourceOptions } from '../src/db/data-source.js';

export const PASSWORD = 'correct-horse-battery';

/** Фиксированные идентификаторы — чтобы тесты читались без поиска по базе. */
export const ids = {
  companyA: '01900000-0000-7000-8000-00000000000a',
  companyB: '01900000-0000-7000-8000-00000000000b',
  branchA1: '01900000-0000-7000-8000-0000000000a1',
  branchA2: '01900000-0000-7000-8000-0000000000a2',
  branchB1: '01900000-0000-7000-8000-0000000000b1',
  reviewA1: '01900000-0000-7000-8000-000000000ca1',
  reviewB1: '01900000-0000-7000-8000-000000000cb1',
};

/** Подключение владельцем БД: только для подготовки и проверки данных в тестах. */
export const owner = new DataSource(
  dataSourceOptions(process.env.DATABASE_OWNER_URL!),
);

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app =
    moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS);
  configureApp(app);
  await app.init();
  if (!owner.isInitialized) await owner.initialize();
  return app;
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
  await owner.destroy();
}

/** Две компании, три филиала, три пользователя и известные числа метрик. */
export async function resetDb(): Promise<void> {
  const hash = await bcrypt.hash(PASSWORD, 4);
  await owner.query(
    `TRUNCATE sync_runs, reviews, daily_metrics, branches, users, companies CASCADE`,
  );
  await owner.query(
    `INSERT INTO companies (id, name) VALUES ($1, 'Альфа'), ($2, 'Бета')`,
    [ids.companyA, ids.companyB],
  );
  await owner.query(
    `INSERT INTO users (id, email, password_hash, full_name, role, company_id) VALUES
       ('01900000-0000-7000-8000-0000000000f0', 'admin@test.local', $1, 'Админ', 'admin', NULL),
       ('01900000-0000-7000-8000-0000000000fa', 'a@test.local', $1, 'Клиент А', 'client', $2),
       ('01900000-0000-7000-8000-0000000000fb', 'b@test.local', $1, 'Клиент Б', 'client', $3)`,
    [hash, ids.companyA, ids.companyB],
  );
  await owner.query(
    `INSERT INTO branches (id, company_id, name, city, address, external_id) VALUES
       ($1, $4, 'Альфа — Центр', 'Москва', 'ул. Первая, 1', 'ext-a1'),
       ($2, $4, 'Альфа — Север', 'Москва', 'ул. Вторая, 2', 'ext-a2'),
       ($3, $5, 'Бета — Главный', 'Казань', 'ул. Третья, 3', 'ext-b1')`,
    [ids.branchA1, ids.branchA2, ids.branchB1, ids.companyA, ids.companyB],
  );
  await owner.query(
    `INSERT INTO daily_metrics (branch_id, company_id, date, views, site_clicks, calls, routes) VALUES
       ($1, $4, '2026-03-01', 100, 10, 5, 7),
       ($1, $4, '2026-03-03', 200, 20, 6, 8),
       ($2, $4, '2026-03-01',  50,  4, 1, 2),
       ($1, $4, '2026-02-27',  40,  3, 2, 1),
       ($3, $5, '2026-03-01', 9000, 900, 90, 99)`,
    [ids.branchA1, ids.branchA2, ids.branchB1, ids.companyA, ids.companyB],
  );
  await owner.query(
    `INSERT INTO reviews (id, branch_id, company_id, external_id, author_name, rating, text, status, published_at) VALUES
       ($1, $3, $6, 'r-a1', 'Анна',  5, 'Отлично',  'new',         '2026-03-01T10:00:00+03:00'),
       (uuidv7(), $3, $6, 'r-a2', 'Борис', 2, 'Долго ждал', 'in_progress', '2026-03-02T10:00:00+03:00'),
       (uuidv7(), $4, $6, 'r-a3', 'Вера',  4, 'Хорошо',    'processed',   '2026-03-01T00:30:00+03:00'),
       ($2, $5, $7, 'r-b1', 'Глеб',  1, 'Ужасно',    'new',         '2026-03-01T10:00:00+03:00')`,
    [
      ids.reviewA1,
      ids.reviewB1,
      ids.branchA1,
      ids.branchA2,
      ids.branchB1,
      ids.companyA,
      ids.companyB,
    ],
  );
}

/** Входит и возвращает заголовок Authorization для прямых запросов к API. */
export async function loginAs(
  app: INestApplication<App>,
  email: string,
): Promise<{ Authorization: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return { Authorization: `Bearer ${res.body.accessToken}` };
}
