import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { CONFIG, type Config } from '../src/config.js';
import { generateDay } from '../src/mock-geo/generator.js';
import {
  closeTestApp,
  createTestApp,
  ids,
  loginAs,
  owner,
  resetDb,
} from './helpers.js';

const PERIOD = { from: '2026-04-01', to: '2026-04-03' };

describe('Синхронизация статистики из внешнего API', () => {
  let app: INestApplication<App>;
  let config: Config;
  let mockUrl: string;
  let admin: { Authorization: string };

  const sync = (body: object = PERIOD, headers: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .post('/api/sync/metrics')
      .set(admin)
      .set(headers)
      .send(body);
  const aprilRows = async (): Promise<number> =>
    (
      await owner.query(
        `SELECT count(*)::int AS n FROM daily_metrics WHERE date >= '2026-04-01'`,
      )
    )[0].n;

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    config = app.get(CONFIG);
    mockUrl = `${await app.getUrl()}/api/mock-geo/v1`;
    await resetDb();
    admin = await loginAs(app, 'admin@test.local');
  });
  beforeEach(async () => {
    await resetDb();
    config.GEO_API_URL = mockUrl;
    config.MOCK_GEO_FAIL_EVERY = 0;
  });
  afterAll(() => closeTestApp(app));

  it('загружает статистику всех филиалов и сохраняет её в базе', async () => {
    const res = await sync().expect(200);
    expect(res.body).toMatchObject({
      status: 'success',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-03',
      branchesTotal: 3,
      branchesFailed: 0,
      rowsReceived: 9,
      rowsChanged: 9,
      error: null,
    });

    const [row] = await owner.query(
      `SELECT views, site_clicks, calls, routes FROM daily_metrics WHERE branch_id = $1 AND date = '2026-04-02'`,
      [ids.branchA1],
    );
    const expected = generateDay('ext-a1', '2026-04-02');
    expect(row).toEqual({
      views: expected.views,
      site_clicks: expected.siteClicks,
      calls: expected.calls,
      routes: expected.routes,
    });
  });

  it('повторный запуск не создаёт дублей и ничего не переписывает', async () => {
    await sync().expect(200);
    const again = await sync().expect(200);
    expect(again.body).toMatchObject({
      status: 'success',
      rowsReceived: 9,
      rowsChanged: 0,
    });
    expect(await aprilRows()).toBe(9);
  });

  it('если данные у источника изменились, обновляются только изменившиеся строки', async () => {
    await sync().expect(200);
    await owner.query(
      `UPDATE daily_metrics SET views = 1 WHERE branch_id = $1 AND date = '2026-04-02'`,
      [ids.branchA1],
    );
    const res = await sync().expect(200);
    expect(res.body.rowsChanged).toBe(1);
    const [row] = await owner.query(
      `SELECT views FROM daily_metrics WHERE branch_id = $1 AND date = '2026-04-02'`,
      [ids.branchA1],
    );
    expect(row.views).toBe(generateDay('ext-a1', '2026-04-02').views);
  });

  it('повтор с тем же Idempotency-Key возвращает прежний результат и не запускает работу заново', async () => {
    const key = { 'Idempotency-Key': 'retry-42' };
    const first = await sync(PERIOD, key).expect(200);
    const second = await sync(PERIOD, key).expect(200);
    expect(second.body).toEqual(first.body);
    const [{ n }] = await owner.query(
      `SELECT count(*)::int AS n FROM sync_runs`,
    );
    expect(n).toBe(1);
  });

  it('тот же Idempotency-Key с другим периодом — конфликт, а не тихая подмена', async () => {
    const key = { 'Idempotency-Key': 'retry-43' };
    await sync(PERIOD, key).expect(200);
    await sync({ from: '2026-04-01', to: '2026-04-02' }, key).expect(409);
  });

  it('повтор с тем же ключом, пока запуск ещё идёт, не выдаёт его за готовый результат', async () => {
    await owner.query(
      `INSERT INTO sync_runs (idempotency_key, date_from, date_to, status)
       VALUES ('retry-44', '2026-04-01', '2026-04-03', 'running')`,
    );
    await sync(PERIOD, { 'Idempotency-Key': 'retry-44' }).expect(409);
  });

  it('временные сбои источника переживаются повторными попытками', async () => {
    config.MOCK_GEO_FAIL_EVERY = 2;
    const res = await sync().expect(200);
    expect(res.body).toMatchObject({
      status: 'success',
      branchesFailed: 0,
      rowsReceived: 9,
    });
  });

  it('недоступный источник: запуск помечен неудачным, прежние данные целы', async () => {
    config.GEO_API_URL = 'http://geo.invalid';
    const before = (
      await owner.query(`SELECT count(*)::int AS n FROM daily_metrics`)
    )[0].n;
    const res = await sync().expect(200);
    expect(res.body).toMatchObject({
      status: 'failed',
      branchesFailed: 3,
      rowsChanged: 0,
    });
    expect(res.body.error).toEqual(expect.any(String));
    expect(
      (await owner.query(`SELECT count(*)::int AS n FROM daily_metrics`))[0].n,
    ).toBe(before);
  });

  describe('источник отвечает не по договору', () => {
    let stub: Server;
    let reply: { status: number; body: string };
    let hits: number;

    beforeAll(async () => {
      stub = createServer((_req, res) => {
        hits++;
        res
          .writeHead(reply.status, { 'content-type': 'application/json' })
          .end(reply.body);
      });
      await new Promise<void>((resolve) =>
        stub.listen(0, '127.0.0.1', resolve),
      );
    });
    beforeEach(() => {
      hits = 0;
      config.GEO_API_URL = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
    });
    afterAll(() => stub.close());

    it('мусор вместо данных не попадает в базу', async () => {
      reply = {
        status: 200,
        body: JSON.stringify({ days: [{ date: '2026-04-01', views: -5 }] }),
      };
      const res = await sync().expect(200);
      expect(res.body).toMatchObject({
        status: 'failed',
        branchesFailed: 3,
        rowsReceived: 0,
      });
      expect(await aprilRows()).toBe(0);
    });

    it('отказ в доступе не повторяется бесконечно: одна попытка на филиал', async () => {
      reply = { status: 401, body: '{}' };
      const res = await sync().expect(200);
      expect(res.body.status).toBe('failed');
      expect(hits).toBe(3);
    });

    it('обрыв соединения посреди ответа считается сбоем сети и повторяется', async () => {
      const good = JSON.stringify({
        days: [
          { date: '2026-04-01', views: 10, siteClicks: 1, calls: 1, routes: 1 },
        ],
      });
      const seen = new Set<string>();
      stub.removeAllListeners('request');
      stub.on('request', (req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        if (seen.has(req.url!)) return res.end(good);
        seen.add(req.url!);
        res.write('{"days":[');
        res.destroy();
      });
      const res = await sync().expect(200);
      expect(res.body).toMatchObject({ status: 'success', rowsReceived: 3 });
    });

    it('дни вне запрошенного периода отбрасываются, из повторов даты берётся последний', async () => {
      const day = (date: string, views: number) => ({
        date,
        views,
        siteClicks: 1,
        calls: 1,
        routes: 1,
      });
      const body = JSON.stringify({
        days: [
          day('1999-01-01', 1),
          day('2026-04-01', 5),
          day('2026-04-01', 7),
        ],
      });
      stub.removeAllListeners('request');
      stub.on('request', (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' }).end(body);
      });
      const res = await sync().expect(200);
      expect(res.body).toMatchObject({
        status: 'success',
        rowsReceived: 3,
        rowsChanged: 3,
      });
      const rows = await owner.query(
        `SELECT DISTINCT date::text, views FROM daily_metrics WHERE date < '2026-01-01' OR date >= '2026-04-01'`,
      );
      expect(rows).toEqual([{ date: '2026-04-01', views: 7 }]);
    });

    it('часть филиалов загрузилась, часть нет — запуск частичный, успешное сохранено', async () => {
      const good = JSON.stringify({
        days: [
          { date: '2026-04-01', views: 10, siteClicks: 1, calls: 1, routes: 1 },
        ],
      });
      stub.removeAllListeners('request');
      stub.on('request', (req, res) => {
        const ok = req.url!.includes('ext-a1');
        res
          .writeHead(ok ? 200 : 404, { 'content-type': 'application/json' })
          .end(ok ? good : '{}');
      });
      const res = await sync().expect(200);
      expect(res.body).toMatchObject({
        status: 'partial',
        branchesFailed: 2,
        rowsChanged: 1,
      });
      expect(await aprilRows()).toBe(1);
    });
  });

  it('вторая синхронизация не стартует, пока идёт первая', async () => {
    await owner.query(
      `INSERT INTO sync_runs (date_from, date_to, status) VALUES ('2026-04-01', '2026-04-03', 'running')`,
    );
    await sync().expect(409);
  });

  it('зависший запуск не блокирует синхронизацию навсегда', async () => {
    await owner.query(
      `INSERT INTO sync_runs (date_from, date_to, status, started_at)
       VALUES ('2026-04-01', '2026-04-03', 'running', now() - interval '1 hour')`,
    );
    await sync().expect(200);
    const stale = await owner.query(
      `SELECT status FROM sync_runs ORDER BY started_at LIMIT 1`,
    );
    expect(stale[0].status).toBe('failed');
  });

  it('история запусков доступна администратору, от новых к старым', async () => {
    await sync().expect(200);
    await sync({ from: '2026-04-02', to: '2026-04-02' }).expect(200);
    const res = await request(app.getHttpServer())
      .get('/api/sync/runs')
      .set(admin)
      .expect(200);
    expect(res.body.map((run: any) => run.dateFrom)).toEqual([
      '2026-04-02',
      '2026-04-01',
    ]);
  });

  it('клиенту синхронизация и её история запрещены', async () => {
    const client = await loginAs(app, 'a@test.local');
    await request(app.getHttpServer())
      .post('/api/sync/metrics')
      .set(client)
      .send(PERIOD)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/sync/runs')
      .set(client)
      .expect(403);
  });

  it.each([
    ['без периода', {}],
    ['период длиннее 31 дня', { from: '2026-01-01', to: '2026-04-01' }],
  ])('некорректный запрос (%s) → 400', async (_name, body) => {
    await sync(body).expect(400);
  });

  it('имитация внешнего API не отдаёт данные без своего ключа', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/mock-geo/v1/locations/ext-a1/insights?from=2026-04-01&to=2026-04-03',
      )
      .expect(401);
  });
});
