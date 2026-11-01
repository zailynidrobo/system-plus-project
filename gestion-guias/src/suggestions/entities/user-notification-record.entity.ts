import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type StoredNotificationType =
  'SUGGESTION_APPROVED' | 'SUGGESTION_REJECTED' | 'GUIDE_NEW_VERSION';

/** Notificación guardada para un docente (la campana del encabezado). */
@Entity('user_notifications')
@Index('IDX_user_notifications_recipient_created', ['recipientId', 'createdAt'])
export class UserNotificationRecord {
  @PrimaryColumn('uuid')
  id: string;

  /** `sub` de Keycloak de quien la recibe. */
  @Column({ type: 'varchar', length: 255 })
  recipientId: string;

  @Column({ type: 'varchar', length: 40 })
  type: StoredNotificationType;

  @Column({ type: 'varchar', length: 250 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'uuid', nullable: true })
  guideId: string | null;

  @Column({ type: 'uuid', nullable: true })
  suggestionId: string | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
