import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('guide_edit_locks')
@Index('IDX_guide_edit_locks_dates', ['startsAt', 'endsAt'])
export class GuideEditLockRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 100 })
  createdById: string;

  @Column({ type: 'varchar', length: 150 })
  createdByName: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
