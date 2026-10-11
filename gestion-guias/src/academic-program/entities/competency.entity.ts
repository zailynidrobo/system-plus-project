import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { CurricularModule } from './curricular-module.entity.js';

/**
 * Competencia asociada a un módulo (relación 1:N módulo–competencia).
 * La eliminación es lógica (`deletedAt`) para que las guías publicadas sigan resolviéndola.
 */
@Entity('competencies')
@Index('UQ_competencies_module_sequence', ['moduleId', 'sequence'], {
  unique: true,
})
export class Competency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moduleId: string;

  @ManyToOne(() => CurricularModule, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'moduleId' })
  module: Relation<CurricularModule>;

  /** Código inmutable generado según el módulo: COMP-POO-05. */
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'int' })
  sequence: number;

  /** Texto de la competencia (resultado de aprendizaje). */
  @Column({ type: 'text' })
  text: string;

  /** Texto normalizado para evitar competencias repetidas dentro del mismo módulo. */
  @Column({ type: 'text' })
  normalizedText: string;

  /** Versión vigente del texto. Cada edición crea una nueva `CompetencyRevision`. */
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 100 })
  createdById: string;

  @Column({ type: 'varchar', length: 150 })
  createdByName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updatedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  updatedByName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deletedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  deletedByName: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
