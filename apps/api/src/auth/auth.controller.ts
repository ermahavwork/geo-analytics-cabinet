import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CONFIG, type Config } from '../config.js';
import { type Actor, CurrentActor } from './actor.js';
import { Public } from './auth.decorators.js';
import { SESSION_COOKIE } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginThrottlerGuard } from './login-throttler.guard.js';

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(body.email, body.password);
    res.cookie(SESSION_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.COOKIE_SECURE,
      maxAge: 8 * 60 * 60 * 1000,
    });
    return session;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE);
  }

  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return this.auth.profile(actor.userId);
  }
}
