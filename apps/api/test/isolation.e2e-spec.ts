import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { TenantDb } from '../src/db/tenant-db.js';
import {
  closeTestApp,
  createTestApp,
  ids,
  loginAs,
  owner,
  resetDb,
} from './helpers.js';

const PERIOD = 'from=2026-03-01&to=2026-03-03';

describe('Изоляция данных разных компаний', () => {
  let app: INestApplication<App>;
  let clientA: { Authorization: string };
  let clientB: { Authorization: string };
  let admin: { Authorization: string };

  const get = (url: string, auth: { Authorization: string }) =>
    request(app.getHttpServer()).get(url).set(auth);

  beforeAll(async () => {
    app = await createTestApp();
    await resetDb();
    clientA = await loginAs(app, 'a@test.local');
    clientB = await loginAs(app, 'b@test.local');
    admin = await loginAs(app, 'admin@test.local');
  });
  afterAll(() => closeTestApp(app));

  describe('клиент видит только свою компанию', () => {
    it('в списке компаний — одна своя', async () => {
      const res = await get('/api/companies', clientA).expect(200);
      expect(res.body).toEqual([{ id: ids.companyA, name: 'Альфа' }]);
    });

    it('в списке филиалов — только свои', async () => {
      const res = await get('/api/branches', clientA).expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items.map((b: any) => b.id).sort()).toEqual([
        ids.branchA1,
        ids.branchA2,
      ]);
    });

    it('в сводке — только свои цифры, без 9000 просмотров соседа', async () => {
      const res = await get(`/api/analytics/summary?${PERIOD}`, clientA).expect(
        200,
      );
      expect(res.body.current.views).toBe(350);
    });

    it('в разбивке по филиалам и в отзывах нет чужих строк', async () => {
      const stats = await get(
        `/api/analytics/branches?${PERIOD}`,
        clientA,
      ).expect(200);
      expect(stats.body.items.map((row: any) => row.branch.id)).not.toContain(
        ids.branchB1,
      );
      const reviews = await get('/api/reviews', clientA).expect(200);
      expect(reviews.body.total).toBe(3);
      expect(reviews.body.items.map((r: any) => r.id)).not.toContain(
        ids.reviewB1,
      );
    });

    it('своя компания в фильтре допустима и даёт те же данные', async () => {
      const res = await get(
        `/api/analytics/summary?${PERIOD}&companyId=${ids.companyA}`,
        clientA,
      ).expect(200);
      expect(res.body.current.views).toBe(350);
    });

    it('второй клиент симметрично видит только свою компанию', async () => {
      const branches = await get('/api/branches', clientB).expect(200);
      expect(branches.body.items.map((b: any) => b.id)).toEqual([ids.branchB1]);
      const summary = await get(
        `/api/analytics/summary?${PERIOD}`,
        clientB,
      ).expect(200);
      expect(summary.body.current.views).toBe(9000);
    });
  });

  describe('прямые запросы с чужими идентификаторами отклоняются', () => {
    it.each([
      `/api/branches?companyId=${ids.companyB}`,
      `/api/analytics/summary?${PERIOD}&companyId=${ids.companyB}`,
      `/api/analytics/timeseries?${PERIOD}&metric=views&companyId=${ids.companyB}`,
      `/api/analytics/branches?${PERIOD}&companyId=${ids.companyB}`,
      `/api/reviews?companyId=${ids.companyB}`,
    ])('чужая компания в фильтре → 403: %s', async (url) => {
      await get(url, clientA).expect(403);
    });

    it.each([
      `/api/analytics/summary?${PERIOD}&branchId=${ids.branchB1}`,
      `/api/analytics/timeseries?${PERIOD}&metric=views&branchId=${ids.branchB1}`,
      `/api/reviews?branchId=${ids.branchB1}`,
    ])('чужой филиал → 404, как будто его нет: %s', async (url) => {
      await get(url, clientA).expect(404);
    });

    it('чужой отзыв нельзя изменить, и в базе он остаётся прежним', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reviews/${ids.reviewB1}`)
        .set(clientA)
        .send({ status: 'processed' })
        .expect(404);

      const [row] = await owner.query(
        `SELECT status FROM reviews WHERE id = $1`,
        [ids.reviewB1],
      );
      expect(row.status).toBe('new');
    });
  });

  describe('администратор видит все компании', () => {
    it('списки и сводка охватывают обе компании', async () => {
      const companies = await get('/api/companies', admin).expect(200);
      expect(companies.body).toHaveLength(2);
      const branches = await get('/api/branches', admin).expect(200);
      expect(branches.body.total).toBe(3);
      const summary = await get(
        `/api/analytics/summary?${PERIOD}`,
        admin,
      ).expect(200);
      expect(summary.body.current.views).toBe(9350);
    });

    it('может сузить выборку до одной компании или филиала', async () => {
      const byCompany = await get(
        `/api/analytics/summary?${PERIOD}&companyId=${ids.companyB}`,
        admin,
      ).expect(200);
      expect(byCompany.body.current.views).toBe(9000);
      const byBranch = await get(
        `/api/analytics/summary?${PERIOD}&branchId=${ids.branchB1}`,
        admin,
      ).expect(200);
      expect(byBranch.body.current.views).toBe(9000);
    });

    it('филиал не из выбранной компании не находится', async () => {
      await get(
        `/api/analytics/summary?${PERIOD}&companyId=${ids.companyA}&branchId=${ids.branchB1}`,
        admin,
      ).expect(404);
    });
  });

  describe('второй слой: Row-Level Security в PostgreSQL', () => {
    const actorA = {
      userId: 'x',
      role: 'client' as const,
      companyId: ids.companyA,
    };

    it('запрос без единого WHERE возвращает только строки своей компании', async () => {
      const counts = await app.get(TenantDb).run(actorA, async (em) => ({
        companies: (
          await em.query(`SELECT count(*)::int AS n FROM companies`)
        )[0].n,
        branches: (await em.query(`SELECT count(*)::int AS n FROM branches`))[0]
          .n,
        metrics: (
          await em.query(`SELECT count(*)::int AS n FROM daily_metrics`)
        )[0].n,
        reviews: (await em.query(`SELECT count(*)::int AS n FROM reviews`))[0]
          .n,
      }));
      expect(counts).toEqual({
        companies: 1,
        branches: 2,
        metrics: 4,
        reviews: 3,
      });
    });

    it('чужую строку нельзя ни изменить, ни подложить', async () => {
      const tenantDb = app.get(TenantDb);
      const updated = await tenantDb.run(actorA, (em) =>
        em.query(
          `UPDATE reviews SET status = 'processed' WHERE id = $1 RETURNING id`,
          [ids.reviewB1],
        ),
      );
      expect(updated[0]).toEqual([]);

      await expect(
        tenantDb.run(actorA, (em) =>
          em.query(
            `INSERT INTO daily_metrics (branch_id, company_id, date, views, site_clicks, calls, routes)
             VALUES ($1, $2, '2026-03-05', 1, 1, 1, 1)`,
            [ids.branchB1, ids.companyB],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('без контекста пользователя таблицы компаний пусты — забытый контекст не раскрывает данные', async () => {
      const db = app.get(DataSource);
      await app.get(TenantDb).run(actorA, (em) => em.query(`SELECT 1`));
      for (const table of [
        'companies',
        'branches',
        'daily_metrics',
        'reviews',
      ]) {
        const [{ n }] = await db.query(
          `SELECT count(*)::int AS n FROM ${table}`,
        );
        expect(n, table).toBe(0);
      }
    });

    it('каждая таблица с company_id защищена политикой, а роль приложения не может её обойти', async () => {
      const unprotected = await owner.query(`
        SELECT c.relname FROM pg_class c
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'company_id'
         WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace
           AND c.relname <> 'users'
           AND NOT (c.relrowsecurity AND EXISTS (SELECT FROM pg_policy p WHERE p.polrelid = c.oid))`);
      expect(unprotected).toEqual([]);

      const [role] = await app.get(DataSource).query(`
        SELECT r.rolsuper OR r.rolbypassrls AS bypass,
               EXISTS (SELECT FROM pg_class c WHERE c.relowner = r.oid AND c.relnamespace = 'public'::regnamespace) AS owns
          FROM pg_roles r WHERE r.rolname = current_user`);
      expect(role).toEqual({ bypass: false, owns: false });
    });
  });
});
