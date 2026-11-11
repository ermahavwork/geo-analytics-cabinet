import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Company } from '../db/entities/company.entity.js';
import { User } from '../db/entities/user.entity.js';
import { TenantDb } from '../db/tenant-db.js';

/** Сверяется, когда пользователя нет, — чтобы время ответа не выдавало, есть ли такой email. */
const DUMMY_HASH = bcrypt.hashSync('no-such-user', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly tenantDb: TenantDb,
  ) {}

  async login(email: string, password: string) {
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .where('lower(u.email) = :email', { email: email.toLowerCase() })
      .getOne();
    const passwordOk = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: await this.toProfile(user),
    };
  }

  async profile(userId: string) {
    return this.toProfile(
      await this.dataSource.getRepository(User).findOneByOrFail({ id: userId }),
    );
  }

  private async toProfile(user: User) {
    const { id: userId, companyId, role } = user;
    const company = companyId
      ? await this.tenantDb.run({ userId, role, companyId }, (em) =>
          em.getRepository(Company).findOneByOrFail({ id: companyId }),
        )
      : null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role,
      company,
    };
  }
}
