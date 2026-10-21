import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('academic_guide_events')
@Index('IDX_academic_guide_events_guide_created', ['guideId', 'createdAt'])
export class GuideEventRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  guideId: string;

  @Column({ type: 'varchar', length: 250 })
  title: string;

  @Column({ type: 'varchar', length: 100 })
  authorId: string;

  @Column({ type: 'varchar', length: 150 })
  authorName: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
