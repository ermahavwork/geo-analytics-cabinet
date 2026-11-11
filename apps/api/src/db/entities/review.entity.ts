import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Branch } from './branch.entity.js';

export const REVIEW_STATUSES = ['new', 'in_progress', 'processed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

@Entity('reviews')
export class Review {
  @PrimaryColumn('uuid', { default: () => 'uuidv7()' })
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column('uuid', { name: 'company_id' })
  companyId: string;

  @Column('text', { name: 'external_id' })
  externalId: string;

  @Column('text', { name: 'author_name' })
  authorName: string;

  @Column('smallint')
  rating: number;

  @Column('text')
  text: string;

  @Column('enum', { enum: REVIEW_STATUSES, enumName: 'review_status' })
  status: ReviewStatus;

  @Column('timestamptz', { name: 'published_at' })
  publishedAt: Date;
}
