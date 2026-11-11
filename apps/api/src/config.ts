import { randomBytes } from 'node:crypto';
import { Global, Module } from '@nestjs/common';
import { z } from 'zod';

z.config(z.locales.ru());

const schema = z.object({
  DATABASE_URL: z.url(),
  /**
   * Подпись сессий. Если не задан, на каждый запуск создаётся случайный: проект
   * стартует без настройки, а в репозитории нет секрета, которым можно подделать
   * токен. Для нескольких экземпляров API и сессий, переживающих рестарт, — задать.
   */
  JWT_SECRET: z.preprocess(
    (value) => value || undefined,
    z
      .string()
      .min(32)
      .default(() => randomBytes(32).toString('hex')),
  ),
  PORT: z.coerce.number().int().default(4000),
  COOKIE_SECURE: z.stringbool().default(false),
  /** Часовой пояс, по которому отзывы раскладываются по дням отчёта. */
  REPORT_TIMEZONE: z.string().default('Europe/Moscow'),
  GEO_API_URL: z.url(),
  GEO_API_KEY: z.string().min(1),
  /** Каждый N-й запрос к имитации внешнего API отвечает 503 (0 — без сбоев). */
  MOCK_GEO_FAIL_EVERY: z.coerce.number().int().min(0).default(0),
});

export type Config = z.infer<typeof schema>;

export const CONFIG = Symbol('CONFIG');

function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Некорректные переменные окружения:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
