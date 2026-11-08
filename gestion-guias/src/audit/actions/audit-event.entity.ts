import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type AuditResult = 'success' | 'denied' | 'failed';
export const AUDIT_RESULTS: AuditResult[] = ['success', 'denied', 'failed'];

export type AuditEntityType =
  | 'guide'
  | 'module'
  | 'competency'
  | 'user'
  | 'suggestion'
  | 'personalized_version'
  | 'support_material'
  | 'teacher_assignment'
  | 'session';

/**
 * Un evento del registro de auditoría (HE-08-HU-01). Las filas no se editan ni se borran:
 * la API no tiene endpoints para hacerlo. Los nombres (usuario, módulo, entidad) se guardan
 * como copia para que el historial no cambie si después se renombran.
 */
@Entity('audit_events')
// PostgreSQL recorre un índice btree en ambos sentidos: este también sirve para `ORDER BY occurredAt DESC`.
@Index('IDX_audit_events_occurred_at', ['occurredAt'])
@Index('IDX_audit_events_actor', ['actorId'])
@Index('IDX_audit_events_module', ['moduleId'])
@Index('IDX_audit_events_area', ['area'])
@Index('IDX_audit_events_result', ['result'])
export class AuditEventRecord {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  /** `sub` de Keycloak. Null en un inicio de sesión fallido. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  actorName: string | null;

  /** En un inicio de sesión fallido, el correo con el que se intentó. */
  @Column({ type: 'varchar', length: 254, nullable: true })
  actorEmail: string | null;

  /** Rol de la app que tenía el usuario al momento de la acción. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  actorRole: string | null;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  /** Patrón de la ruta: `/academic/guides/:id/publish`. */
  @Column({ type: 'varchar', length: 250 })
  route: string;

  /** URL real, sin query string. */
  @Column({ type: 'varchar', length: 500 })
  path: string;

  @Column({ type: 'varchar', length: 60 })
  area: string;

  @Column({ type: 'varchar', length: 150 })
  action: string;

  @Column({ type: 'varchar', length: 10 })
  result: AuditResult;

  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  entityType: AuditEntityType | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityId: string | null;

  /** `GB-POO-01 · Guía de clases`, `Programación Orientada a Objetos` o el correo del usuario. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  entityLabel: string | null;

  /** Módulo curricular de la acción (CA-02). Null si no aplica (usuarios, sesión). */
  @Column({ type: 'uuid', nullable: true })
  moduleId: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  moduleName: string | null;

  /** Resumen corto y sin datos sensibles (campos cambiados, estado resultante...). */
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;
}
