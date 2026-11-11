import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  closeTestApp,
  createTestApp,
  ids,
  loginAs,
  resetDb,
} from './helpers.js';

describe('Аналитика', () => {
  let app: INestApplication<App>;
  let clientA: { Authorization: string };

  const get = (url: string) =>
    request(app.getHttpServer()).get(url).set(clientA);

  beforeAll(async () => {
    app = await createTestApp();
    await resetDb();
    clientA = await loginAs(app, 'a@test.local');
  });
  afterAll(() => closeTestApp(app));

  it('сводка по всем филиалам компании складывает шесть показателей', async () => {
    const res = await get(
      '/api/analytics/summary?from=2026-03-01&to=2026-03-03',
    ).expect(200);
    expect(res.body.current).toEqual({
      views: 350,
      siteClicks: 34,
      calls: 12,
      routes: 17,
      reviewsCount: 3,
      avgRating: 3.67,
    });
  });

  it('сводка сравнивает с предыдущим периодом той же длины', async () => {
    const res = await get(
      '/api/analytics/summary?from=2026-03-01&to=2026-03-03',
    ).expect(200);
    expect(res.body.previousPeriod).toEqual({
      from: '2026-02-26',
      to: '2026-02-28',
    });
    expect(res.body.previous).toEqual({
      views: 40,
      siteClicks: 3,
      calls: 2,
      routes: 1,
      reviewsCount: 0,
      avgRating: null,
    });
  });

  it('сводка по одному филиалу считает только его', async () => {
    const res = await get(
      `/api/analytics/summary?from=2026-03-01&to=2026-03-03&branchId=${ids.branchA1}`,
    ).expect(200);
    expect(res.body.current).toMatchObject({
      views: 300,
      calls: 11,
      reviewsCount: 2,
      avgRating: 3.5,
    });
  });

  it('отзыв относится к дню по часовому поясу отчёта, а не по UTC', async () => {
    // Отзыв от 00:30 1 марта по Москве в UTC ещё 28 февраля.
    const res = await get(
      '/api/analytics/summary?from=2026-03-01&to=2026-03-01',
    ).expect(200);
    expect(res.body.current.reviewsCount).toBe(2);
  });

  it('период без данных даёт нули и пустой рейтинг, а не ошибку', async () => {
    const res = await get(
      '/api/analytics/summary?from=2025-01-01&to=2025-01-07',
    ).expect(200);
    expect(res.body.current).toEqual({
      views: 0,
      siteClicks: 0,
      calls: 0,
      routes: 0,
      reviewsCount: 0,
      avgRating: null,
    });
  });

  it('динамика заполняет дни без данных нулями', async () => {
    const res = await get(
      '/api/analytics/timeseries?from=2026-03-01&to=2026-03-03&metric=views',
    ).expect(200);
    expect(res.body).toEqual({
      metric: 'views',
      points: [
        { date: '2026-03-01', value: 150 },
        { date: '2026-03-02', value: 0 },
        { date: '2026-03-03', value: 200 },
      ],
    });
  });

  it('динамика строится по любому из четырёх счётчиков', async () => {
    const res = await get(
      `/api/analytics/timeseries?from=2026-03-01&to=2026-03-01&metric=siteClicks&branchId=${ids.branchA2}`,
    ).expect(200);
    expect(res.body.points).toEqual([{ date: '2026-03-01', value: 4 }]);
  });

  it('разбивка по филиалам отдаёт показатели каждого и общее число', async () => {
    const res = await get(
      '/api/analytics/branches?from=2026-03-01&to=2026-03-03',
    ).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toEqual([
      {
        branch: {
          id: ids.branchA2,
          companyId: ids.companyA,
          name: 'Альфа — Север',
          city: 'Москва',
          address: 'ул. Вторая, 2',
          companyName: 'Альфа',
        },
        views: 50,
        siteClicks: 4,
        calls: 1,
        routes: 2,
        reviewsCount: 1,
        avgRating: 4,
      },
      {
        branch: {
          id: ids.branchA1,
          companyId: ids.companyA,
          name: 'Альфа — Центр',
          city: 'Москва',
          address: 'ул. Первая, 1',
          companyName: 'Альфа',
        },
        views: 300,
        siteClicks: 30,
        calls: 11,
        routes: 15,
        reviewsCount: 2,
        avgRating: 3.5,
      },
    ]);
  });

  it('разбивка листается постранично', async () => {
    const res = await get(
      '/api/analytics/branches?from=2026-03-01&to=2026-03-03&limit=1&page=2',
    ).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].branch.id).toBe(ids.branchA1);
  });

  it.each([
    ['без периода', '/api/analytics/summary'],
    [
      'несуществующая дата',
      '/api/analytics/summary?from=2026-02-30&to=2026-03-03',
    ],
    [
      'начало позже конца',
      '/api/analytics/summary?from=2026-03-05&to=2026-03-01',
    ],
    [
      'период длиннее года',
      '/api/analytics/summary?from=2024-01-01&to=2026-03-01',
    ],
    [
      'филиал не UUID',
      '/api/analytics/summary?from=2026-03-01&to=2026-03-03&branchId=1%20OR%201=1',
    ],
    [
      'неизвестный показатель',
      '/api/analytics/timeseries?from=2026-03-01&to=2026-03-03&metric=password_hash',
    ],
    [
      'слишком большая страница',
      '/api/analytics/branches?from=2026-03-01&to=2026-03-03&limit=100000',
    ],
  ])('некорректный запрос (%s) → 400 с пояснением', async (_name, url) => {
    const res = await get(url).expect(400);
    expect(res.body.message).toEqual(expect.any(Array));
  });
});
