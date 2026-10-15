import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  GuideContent,
  GuideField,
  GuideStatus,
} from '../academic.entities.js';

@Entity('academic_guides')
@Index('IDX_academic_guides_module', ['moduleId'])
@Index('UQ_academic_guides_code', ['code'], { unique: true })
export class AcademicGuideRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  code: string | null;

  @Column({ type: 'uuid' })
  moduleId: string;

  @Column({ type: 'varchar', length: 150 })
  moduleName: string;

  @Column({ type: 'uuid', nullable: true })
  competencyId: string | null;

  /** Código y texto de la competencia al crear la guía (`COMP-POO-01 · …`); el texto puede ser largo. */
  @Column({ type: 'text', nullable: true })
  competencyName: string | null;

  @Column({ type: 'varchar', length: 250 })
  title: string;

  @Column({ type: 'jsonb' })
  content: GuideContent;

  @Column({ type: 'jsonb' })
  fields: GuideField[];

  @Column({ type: 'int', default: 1 })
  structureVersion: number;

  @Column({ type: 'varchar', length: 20, default: 'v0' })
  version: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: GuideStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  createdByName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updatedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  updatedByName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  publishedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  publishedByName: string | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
