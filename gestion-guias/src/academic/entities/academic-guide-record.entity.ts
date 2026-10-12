import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  GuideContent,
  GuideField,
  GuideStatus,
} from '../academic.entities.js';

@Entity('academic_guides')
@Index('IDX_academic_guides_module', ['moduleId'])
export class AcademicGuideRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moduleId: string;

  @Column({ type: 'varchar', length: 150 })
  moduleName: string;

  @Column({ type: 'uuid', nullable: true })
  competencyId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  competencyName: string | null;

  @Column({ type: 'varchar', length: 250 })
  title: string;

  @Column({ type: 'jsonb' })
  content: GuideContent;

  @Column({ type: 'jsonb' })
  fields: GuideField[];

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: GuideStatus;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
