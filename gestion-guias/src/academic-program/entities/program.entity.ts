import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Programa académico (p. ej. Técnico en Sistemas · Sede Piendamó). */
@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Prefijo usado en los códigos de módulo: TS → TS-MOD-01. */
  @Column({ type: 'varchar', length: 10, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  campus: string | null;

  /** Cohorte del plan curricular vigente. */
  @Column({ type: 'int', nullable: true })
  cohort: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
