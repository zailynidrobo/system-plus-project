import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GuideContent, GuideField } from '../academic.entities.js';

@Entity('academic_personalized_guide_versions')
@Index('IDX_academic_personalized_versions_teacher', ['teacherId'])
export class PersonalizedGuideVersionRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  baseGuideId: string;

  @Column({ type: 'uuid' })
  moduleId: string;

  @Column({ type: 'varchar', length: 150 })
  moduleName: string;

  @Column({ type: 'varchar', length: 255 })
  teacherId: string;

  @Column({ type: 'varchar', length: 250 })
  title: string;

  /** Nombre que el docente le da a su versión (null en versiones creadas antes de existir este dato). */
  @Column({ type: 'varchar', length: 150, nullable: true })
  name: string | null;

  @Column({ type: 'jsonb' })
  baseContent: GuideContent;

  @Column({ type: 'jsonb' })
  baseFields: GuideField[];

  @Column({ type: 'jsonb' })
  content: GuideContent;

  @Column({ type: 'jsonb' })
  fields: GuideField[];

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;
}
