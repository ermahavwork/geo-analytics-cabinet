import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { APP_OPTIONS, configureApp } from './app.setup.js';
import { CONFIG, type Config } from './config.js';

const app = await NestFactory.create<NestExpressApplication>(
  AppModule,
  APP_OPTIONS,
);
configureApp(app);

SwaggerModule.setup(
  'api/docs',
  app,
  SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Аналитический кабинет — API')
      .setDescription(
        'Вход: POST /api/auth/login, затем токен из ответа в заголовке Authorization.',
      )
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build(),
  ),
);

await app.listen(app.get<Config>(CONFIG).PORT, '0.0.0.0');
