import { Column, Entity, PrimaryColumn } from 'typeorm';

export type UserRole = 'admin' | 'client';

@Entity('users')
export class User {
  @PrimaryColumn('uuid', { default: () => 'uuidv7()' })
  id: string;

  @Column('text')
  email: string;

  @Column('text', { name: 'password_hash' })
  passwordHash: string;

  @Column('text', { name: 'full_name' })
  fullName: string;

  @Column('enum', { enum: ['admin', 'client'], enumName: 'user_role' })
  role: UserRole;

  /** У администратора компании нет; у клиента она обязательна (CHECK в БД). */
  @Column('uuid', { name: 'company_id', nullable: true })
  companyId: string | null;
}
