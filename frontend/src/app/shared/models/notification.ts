/** Tipos de la campana: los guardados (docente) y las alertas calculadas (coordinador). */
export type TipoNotificacion =
  | 'SUGGESTION_APPROVED'
  | 'SUGGESTION_REJECTED'
  | 'GUIDE_NEW_VERSION'
  | 'SUGGESTION_OVERDUE'
  | 'SUGGESTION_DUE_SOON'
  | 'SUGGESTION_PENDING';

export type GravedadNotificacion = 'danger' | 'warning' | 'info' | 'success';

/** Datos de la guía para abrirla directo desde la alerta. */
export interface GuiaNotificada {
  id: number;
  code: string;
  title: string;
  version: string;
  moduleName: string;
}

export interface Notificacion {
  /** UUID en el backend; en el coordinador es el id de la sugerencia. */
  id: string;
  type: TipoNotificacion;
  severity: GravedadNotificacion;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  suggestionId: number | null;
  guide: GuiaNotificada | null;
}

/** GET /academic/notifications: contador y alertas según el rol. */
export interface Campana {
  unread: number;
  items: Notificacion[];
}
