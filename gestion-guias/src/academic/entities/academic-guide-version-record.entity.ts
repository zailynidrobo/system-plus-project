import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { GuideContent, GuideField } from '../academic.entities.js';

@Entity('academic_guide_versions')
@Index('UQ_academic_guide_versions_guide_version', ['guideId', 'version'], {
  unique: true,
})
@Index('IDX_academic_guide_versions_guide_created', ['guideId', 'createdAt'])
export class AcademicGuideVersionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  guideId: string;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'draft' | 'current' | 'previous';

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  authorId: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  authorName: string | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'boolean' })
  isPublication: boolean;

  @Column({ type: 'int' })
  structureVersion: number;

  @Column({ type: 'jsonb' })
  fields: GuideField[];

  @Column({ type: 'jsonb' })
  content: GuideContent;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  publishedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  publishedByName: string | null;
}
