import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/**
 * Ограничивает попытки входа по учётной записи, а не по IP: за прокси адрес у
 * всех один, а подбор пароля к конкретному email должен упираться в лимит.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body?.email;
    return typeof email === 'string' && email
      ? email.slice(0, 254).toLowerCase()
      : req.ip;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      'Слишком много попыток входа. Повторите через минуту.',
    );
  }
}
