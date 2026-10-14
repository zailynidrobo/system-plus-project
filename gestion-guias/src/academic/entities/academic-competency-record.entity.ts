import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('academic_legacy_competencies')
export class AcademicCompetencyRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
