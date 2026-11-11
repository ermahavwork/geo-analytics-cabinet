import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '../db/entities/user.entity.js';

/** Кто делает запрос. Заполняется из базы в AuthGuard, а не из тела запроса. */
export interface Actor {
  userId: string;
  role: UserRole;
  companyId: string | null;
}

export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor =>
    ctx.switchToHttp().getRequest().actor,
);
