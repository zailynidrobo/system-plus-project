import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('academic_legacy_modules')
@Index('UQ_academic_legacy_modules_normalized_name', ['normalizedName'], {
  unique: true,
})
export class AcademicModuleRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150 })
  normalizedName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  competencyIds: string[];
}
