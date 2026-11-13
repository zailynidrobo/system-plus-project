import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * HE-09-HU-01 · Tiempo límite de respuesta a sugerencias, configurado por el administrador.
 * Una sola fila (id = 'default'). Si la tabla está vacía rigen los valores del .env.
 */
@Entity('suggestion_settings')
export class SuggestionSettingsRecord {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'int' })
  dueBusinessDays: number;

  @Column({ type: 'int' })
  dueSoonBusinessDays: number;

  @Column({ type: 'varchar', length: 100 })
  updatedById: string;

  @Column({ type: 'varchar', length: 150 })
  updatedByName: string;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;
}
