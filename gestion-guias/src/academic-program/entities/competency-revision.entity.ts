import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Competency } from './competency.entity.js';

/**
 * Versión histórica del texto de una competencia.
 * Las guías publicadas (HE-03) deben guardar `competencyId` + `version` para conservar
 * exactamente la redacción vigente al momento de publicarse.
 */
@Entity('competency_revisions')
@Index('UQ_competency_revisions_version', ['competencyId', 'version'], {
  unique: true,
})
export class CompetencyRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  competencyId: string;

  @ManyToOne(() => Competency, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'competencyId' })
  competency: Relation<Competency>;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 100 })
  editedById: string;

  @Column({ type: 'varchar', length: 150 })
  editedByName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
