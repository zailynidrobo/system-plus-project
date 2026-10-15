import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { GuideField, GuideFormType } from '../academic.entities.js';

@Entity('academic_guide_field_configs')
@Index('IDX_academic_guide_field_configs_lookup', [
  'moduleId',
  'competencyId',
  'formType',
])
export class GuideFieldConfigRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moduleId: string;

  @Column({ type: 'uuid', nullable: true })
  competencyId: string | null;

  @Column({ type: 'varchar', length: 20 })
  formType: GuideFormType;

  @Column({ type: 'jsonb' })
  fields: GuideField[];
}
