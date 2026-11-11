import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Приложение создаётся без парсеров тела по умолчанию, а включается только JSON.
 * Форму с чужого сайта (application/x-www-form-urlencoded) браузер шлёт без
 * предварительного запроса — такие тела API просто не читает.
 */
export const APP_OPTIONS = { bodyParser: false };

/** Общая настройка приложения — одна и та же в проде и в тестах. */
export function configureApp(app: NestExpressApplication): void {
  app.useBodyParser('json');
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();
}
