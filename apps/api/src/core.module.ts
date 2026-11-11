import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CONFIG, ConfigModule, type Config } from './config.js';
import { dataSourceOptions } from './db/data-source.js';
import { TenantDb } from './db/tenant-db.js';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (cfg: Config) => dataSourceOptions(cfg.DATABASE_URL),
    }),
    JwtModule.registerAsync({
      inject: [CONFIG],
      useFactory: (cfg: Config) => ({
        secret: cfg.JWT_SECRET,
        signOptions: { algorithm: 'HS256', expiresIn: '8h' },
        // Срок жизни проверяет сервер, а не только поле exp, заданное при подписи.
        verifyOptions: { algorithms: ['HS256'], maxAge: '8h' },
      }),
    }),
  ],
  providers: [TenantDb],
  exports: [TenantDb, JwtModule],
})
export class CoreModule {}
