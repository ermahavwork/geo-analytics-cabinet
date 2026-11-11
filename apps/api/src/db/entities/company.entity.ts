import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryColumn('uuid', { default: () => 'uuidv7()' })
  id: string;

  @Column('text')
  name: string;
}
