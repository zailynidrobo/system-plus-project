import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

/** Sugerencia de cambio de un docente sobre un campo de una guía base publicada (HE-05). */
@Entity('academic_guide_suggestions')
@Index('UQ_academic_guide_suggestions_code', ['code'], { unique: true })
@Index('UQ_academic_guide_suggestions_sequence', ['sequence'], { unique: true })
@Index('IDX_academic_guide_suggestions_status', ['status'])
@Index('IDX_academic_guide_suggestions_guide', ['guideId'])
@Index('IDX_academic_guide_suggestions_teacher', ['teacherId'])
// HE-05-HU-01: un docente no puede tener dos pendientes propias sobre el mismo campo de una guía.
@Index(
  'UQ_academic_guide_suggestions_pending_field',
  ['guideId', 'teacherId', 'fieldKey'],
  { unique: true, where: `"status" = 'pending'` },
)
export class SuggestionRecord {
  @PrimaryColumn('uuid')
  id: string;

  /** Consecutivo de SUG-NNN. */
  @Column({ type: 'int' })
  sequence: number;

  /** SUG-014 */
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'uuid' })
  guideId: string;

  @Column({ type: 'uuid' })
  moduleId: string;

  @Column({ type: 'varchar', length: 100 })
  fieldKey: string;

  @Column({ type: 'varchar', length: 250 })
  fieldLabel: string;

  /** `sub` de Keycloak del docente. */
  @Column({ type: 'varchar', length: 255 })
  teacherId: string;

  @Column({ type: 'varchar', length: 150 })
  teacherName: string;

  /** Valor del campo cuando se envió: permite detectar si la guía cambió después. */
  @Column({ type: 'jsonb', nullable: true })
  currentValue: unknown;

  /** Contenido completo que tendrá el campo si se aprueba. */
  @Column({ type: 'jsonb', nullable: true })
  proposedValue: unknown;

  @Column({ type: 'text' })
  justification: string;

  /** Fecha en que el docente necesita el cambio aplicado (YYYY-MM-DD). */
  @Column({ type: 'date', nullable: true })
  neededBy: string | null;

  /** Versión de la guía cuando se envió ("v1.0"). */
  @Column({ type: 'varchar', length: 20 })
  baseVersion: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: SuggestionStatus;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  /** Fin del día hábil 5: desde aquí queda "por vencer". */
  @Column({ type: 'timestamptz' })
  dueSoonAt: Date;

  /** Fin del día hábil 8: tiempo límite. Después queda "vencida", pero sigue pendiente. */
  @Column({ type: 'timestamptz' })
  dueAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  decidedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  decidedByName: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  rejectReason: string | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  /** Versión de la guía que resultó al aprobarla ("v1.1"). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  resultingVersion: string | null;
}
