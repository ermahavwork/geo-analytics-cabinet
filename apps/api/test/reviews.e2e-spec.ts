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

describe('Отзывы', () => {
  let app: INestApplication<App>;
  let clientA: { Authorization: string };

  const get = (url: string) =>
    request(app.getHttpServer()).get(url).set(clientA);
  const patch = (id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/api/reviews/${id}`)
      .set(clientA)
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    await resetDb();
    clientA = await loginAs(app, 'a@test.local');
  });
  afterAll(() => closeTestApp(app));

  it('список идёт от новых к старым и содержит филиал', async () => {
    const res = await get('/api/reviews').expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((r: any) => r.authorName)).toEqual([
      'Борис',
      'Анна',
      'Вера',
    ]);
    expect(res.body.items[1]).toEqual({
      id: ids.reviewA1,
      branch: { id: ids.branchA1, name: 'Альфа — Центр' },
      authorName: 'Анна',
      rating: 5,
      text: 'Отлично',
      status: 'new',
      publishedAt: '2026-03-01T07:00:00.000Z',
    });
  });

  it('фильтр по рейтингу', async () => {
    const res = await get('/api/reviews?rating=2').expect(200);
    expect(res.body.items.map((r: any) => r.authorName)).toEqual(['Борис']);
  });

  it('фильтр по статусу обработки', async () => {
    const res = await get('/api/reviews?status=processed').expect(200);
    expect(res.body.items.map((r: any) => r.authorName)).toEqual(['Вера']);
  });

  it('фильтры сочетаются между собой и с филиалом', async () => {
    const res = await get(
      `/api/reviews?branchId=${ids.branchA1}&status=new&rating=5`,
    ).expect(200);
    expect(res.body.total).toBe(1);
    const none = await get(
      `/api/reviews?branchId=${ids.branchA2}&rating=5`,
    ).expect(200);
    expect(none.body).toEqual({ items: [], total: 0 });
  });

  it('постраничная выдача сохраняет общее число', async () => {
    const res = await get('/api/reviews?limit=2&page=2').expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((r: any) => r.authorName)).toEqual(['Вера']);
  });

  it('статус обработки меняется и сохраняется', async () => {
    const res = await patch(ids.reviewA1, { status: 'in_progress' }).expect(
      200,
    );
    expect(res.body).toMatchObject({ id: ids.reviewA1, status: 'in_progress' });
    const list = await get('/api/reviews?status=in_progress').expect(200);
    expect(list.body.total).toBe(2);
  });

  it('администратор меняет статус отзыва любой компании', async () => {
    const admin = await loginAs(app, 'admin@test.local');
    const res = await request(app.getHttpServer())
      .patch(`/api/reviews/${ids.reviewB1}`)
      .set(admin)
      .send({ status: 'processed' })
      .expect(200);
    expect(res.body.status).toBe('processed');
  });

  it.each([
    ['рейтинг вне 1–5', () => get('/api/reviews?rating=6')],
    ['неизвестный статус в фильтре', () => get('/api/reviews?status=deleted')],
    [
      'неизвестный статус при смене',
      () => patch(ids.reviewA1, { status: 'deleted' }),
    ],
    ['идентификатор не UUID', () => patch('42', { status: 'new' })],
  ])('некорректный запрос (%s) → 400', async (_name, send) => {
    await send().expect(400);
  });

  it('несуществующий отзыв → 404', async () => {
    await patch('01900000-0000-7000-8000-00000000dead', {
      status: 'new',
    }).expect(404);
  });
});
