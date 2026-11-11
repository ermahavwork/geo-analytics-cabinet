import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  closeTestApp,
  createTestApp,
  ids,
  loginAs,
  PASSWORD,
  resetDb,
} from './helpers.js';

describe('Вход и сессия', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDb();
  });
  afterAll(() => closeTestApp(app));

  it('проверка здоровья доступна без входа и видит базу', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('клиент входит и получает свой профиль с компанией', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'A@Test.Local', password: PASSWORD })
      .expect(200);

    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'a@test.local',
      fullName: 'Клиент А',
      role: 'client',
      company: { id: ids.companyA, name: 'Альфа' },
    });
    expect(res.body).not.toHaveProperty('user.passwordHash');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^cabinet_session=.+HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('сессия по cookie работает так же, как по Bearer-токену', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: PASSWORD })
      .expect(200);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ role: 'admin', company: null });

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('неверный пароль и несуществующий email дают одинаковый ответ', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@test.local', password: 'wrong-password' })
      .expect(401);
    const unknownUser = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: PASSWORD })
      .expect(401);

    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('пустое тело входа отклоняется проверкой, а не ошибкой сервера', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('форма с чужого сайта не принимается: API читает только JSON', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .type('form')
      .send({ email: 'a@test.local', password: PASSWORD })
      .expect(400);
  });

  it('срок сессии ограничивает сервер: токен, подписанный на десять лет, через девять часов не действует', async () => {
    const token = await app.get(JwtService).signAsync(
      {
        sub: '01900000-0000-7000-8000-0000000000fa',
        iat: Math.floor(Date.now() / 1000) - 9 * 3600,
      },
      { expiresIn: '10y' },
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('без токена, с мусорным и с подделанным токеном доступ закрыт', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/branches').expect(401);
    await http
      .get('/api/branches')
      .set('Authorization', 'Bearer garbage')
      .expect(401);

    const { Authorization } = await loginAs(app, 'a@test.local');
    const [header, payload] = Authorization.replace('Bearer ', '').split('.');
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString());
    forged.role = 'admin';
    const forgedToken = [
      header,
      Buffer.from(JSON.stringify(forged)).toString('base64url'),
      'AAAA',
    ].join('.');
    await http
      .get('/api/branches')
      .set('Authorization', `Bearer ${forgedToken}`)
      .expect(401);
  });

  it('подбор пароля к одной учётной записи ограничен по частоте', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'b@test.local', password: 'guess-' + i });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
