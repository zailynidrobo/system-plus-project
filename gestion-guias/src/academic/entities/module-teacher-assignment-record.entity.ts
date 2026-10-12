import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('academic_module_teacher_assignments')
@Index(
  'UQ_academic_module_teacher_assignments_pair',
  ['moduleId', 'teacherId'],
  { unique: true },
)
@Index('IDX_academic_module_teacher_assignments_teacher', ['teacherId'])
export class ModuleTeacherAssignmentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moduleId: string;

  @Column({ type: 'varchar', length: 255 })
  teacherId: string;
}
