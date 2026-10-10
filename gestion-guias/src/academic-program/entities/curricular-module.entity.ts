import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Program } from './program.entity.js';

export enum CurricularModuleStatus {
  /** Guardado como borrador: aún no admite competencias ni guías. */
  DRAFT = 'draft',
  /** Disponible para asociar competencias y crear nuevas guías. */
  ACTIVE = 'active',
  /** Inhabilitado (HE-02-HU-03): conserva competencias y guías, pero no admite nuevas guías. */
  INACTIVE = 'inactive',
}

/** Módulo del plan curricular (p. ej. TS-MOD-02 · Programación Orientada a Objetos). */
@Entity('curricular_modules')
@Index('UQ_curricular_modules_program_name', ['programId', 'normalizedName'], {
  unique: true,
})
@Index('UQ_curricular_modules_program_sequence', ['programId', 'sequence'], {
  unique: true,
})
@Index(
  'UQ_curricular_modules_program_prefix',
  ['programId', 'competencyPrefix'],
  { unique: true },
)
export class CurricularModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  programId: string;

  @ManyToOne(() => Program, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'programId' })
  program: Relation<Program>;

  /** Código legible e inmutable: TS-MOD-06. */
  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Nombre en minúsculas y sin espacios sobrantes; garantiza la unicidad dentro del programa. */
  @Column({ type: 'varchar', length: 150 })
  normalizedName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: CurricularModuleStatus,
    default: CurricularModuleStatus.ACTIVE,
  })
  status: CurricularModuleStatus;

  /** Sigla usada en los códigos de competencia: POO → COMP-POO-01. */
  @Column({ type: 'varchar', length: 10 })
  competencyPrefix: string;

  /** Último consecutivo de competencia asignado. Nunca se reutiliza aunque se eliminen competencias. */
  @Column({ type: 'int', default: 0 })
  competencySequence: number;

  @Column({ type: 'varchar', length: 100 })
  createdById: string;

  @Column({ type: 'varchar', length: 150 })
  createdByName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updatedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  updatedByName: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  inactivatedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  inactivatedById: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  inactivatedByName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  inactivationReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
