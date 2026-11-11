import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { User } from '../db/entities/user.entity.js';
import type { Actor } from './actor.js';
import { Public, Roles } from './auth.decorators.js';

export const SESSION_COOKIE = 'cabinet_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(Public, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const token: string | undefined =
      request.headers.authorization?.replace(/^Bearer /, '') ??
      request.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Требуется вход в систему');

    const payload = await this.jwt
      .verifyAsync<{ sub: string }>(token)
      .catch(() => {
        throw new UnauthorizedException('Сессия недействительна или истекла');
      });

    // Роль и компания берутся из базы на каждый запрос: токен подтверждает только
    // личность, поэтому смена прав или удаление пользователя действуют сразу.
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: payload.sub });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    request.actor = {
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
    } satisfies Actor;

    const roles = this.reflector.getAllAndOverride(Roles, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав для этого действия');
    }
    return true;
  }
}
