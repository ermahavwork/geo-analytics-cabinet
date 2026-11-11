import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('branches')
export class Branch {
  @PrimaryColumn('uuid', { default: () => 'uuidv7()' })
  id: string;

  @Column('uuid', { name: 'company_id' })
  companyId: string;

  @Column('text')
  name: string;

  @Column('text')
  city: string;

  @Column('text')
  address: string;

  /** Идентификатор карточки во внешнем геосервисе. */
  @Column('text', { name: 'external_id' })
  externalId: string;
}
