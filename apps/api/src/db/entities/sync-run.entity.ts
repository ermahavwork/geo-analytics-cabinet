import { Column, Entity, PrimaryColumn } from 'typeorm';

export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';

@Entity('sync_runs')
export class SyncRun {
  @PrimaryColumn('uuid', { default: () => 'uuidv7()' })
  id: string;

  @Column('text', { name: 'idempotency_key', nullable: true })
  idempotencyKey: string | null;

  @Column('uuid', { name: 'requested_by', nullable: true })
  requestedBy: string | null;

  @Column('date', { name: 'date_from' })
  dateFrom: string;

  @Column('date', { name: 'date_to' })
  dateTo: string;

  @Column('enum', {
    enum: ['running', 'success', 'partial', 'failed'],
    enumName: 'sync_status',
    default: 'running',
  })
  status: SyncStatus;

  @Column('integer', { name: 'branches_total', default: 0 })
  branchesTotal: number;

  @Column('integer', { name: 'branches_failed', default: 0 })
  branchesFailed: number;

  @Column('integer', { name: 'rows_received', default: 0 })
  rowsReceived: number;

  @Column('integer', { name: 'rows_changed', default: 0 })
  rowsChanged: number;

  @Column('text', { nullable: true })
  error: string | null;

  @Column('timestamptz', { name: 'started_at', default: () => 'now()' })
  startedAt: Date;

  @Column('timestamptz', { name: 'finished_at', nullable: true })
  finishedAt: Date | null;
}
