import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { NotificacionMock } from '../../core/mock/seed-suggestions';
import { vistaGuia, vistaSugerencia } from '../../core/mock/vistas';
import { ApiError } from '../../shared/models/api-error';
import { Campana, GravedadNotificacion, GuiaNotificada, Notificacion, TipoNotificacion } from '../../shared/models/notification';
import { EstadoPlazo, SuggestionView } from '../../shared/models/suggestion';
import { ROLES_DOCENTES } from '../../shared/models/user';
import { fechaEnBogota } from '../../shared/utils/dias-habiles';
import { nombreCorto } from './estado-sugerencia';
import { RELOJ } from './reloj';

const ALERTA: Record<EstadoPlazo, { type: TipoNotificacion; severity: GravedadNotificacion; orden: number }> = {
  overdue: { type: 'SUGGESTION_OVERDUE', severity: 'danger', orden: 0 },
  due_soon: { type: 'SUGGESTION_DUE_SOON', severity: 'warning', orden: 1 },
  on_time: { type: 'SUGGESTION_PENDING', severity: 'info', orden: 2 },
};

const GRAVEDAD: Record<NotificacionMock['type'], GravedadNotificacion> = {
  SUGGESTION_APPROVED: 'success',
  SUGGESTION_REJECTED: 'danger',
  GUIDE_NEW_VERSION: 'info',
};

const diasHabiles = (n: number) => `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;

/**
 * Campana del encabezado (HE-05), con datos simulados. Con apiAcademico = 'http' se usa
 * HttpNotificationApi (GET /academic/notifications).
 *  · Coordinador: alertas calculadas de las pendientes (vencidas, por vencer, nuevas).
 *  · Docente: notificaciones guardadas, con leída o no leída.
 *  · Administrador: lista vacía por ahora.
 */
@Injectable({ providedIn: 'root' })
export class NotificationApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);
  private ahora = inject(RELOJ);

  campana(): Observable<Campana> {
    return simular(this.ms, () => {
      const u = this.auth.user();
      if (!u) throw new ApiError('UNAUTHORIZED');
      if (u.rol === 'COORDINADOR') return this.alertasDeCoordinacion();
      if (ROLES_DOCENTES.includes(u.rol)) {
        const mias = this.db.notificaciones
          .filter((n) => n.recipientId === u.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { unread: mias.filter((n) => !n.readAt).length, items: mias.slice(0, 50).map((n) => this.aNotificacion(n)) };
      }
      return { unread: 0, items: [] };
    });
  }

  marcarLeida(id: string): Observable<Notificacion> {
    return simular(this.ms, () => {
      const n = this.db.notificaciones.find((x) => x.id === id && x.recipientId === this.docente());
      if (!n) throw new ApiError('NOT_FOUND');
      n.readAt ??= this.ahora().toISOString();
      return this.aNotificacion(n);
    });
  }

  marcarTodasLeidas(): Observable<{ actualizadas: number }> {
    return simular(this.ms, () => {
      const docente = this.docente();
      const sinLeer = this.db.notificaciones.filter((n) => n.recipientId === docente && !n.readAt);
      const ahora = this.ahora().toISOString();
      sinLeer.forEach((n) => (n.readAt = ahora));
      return { actualizadas: sinLeer.length };
    });
  }

  private alertasDeCoordinacion(): Campana {
    const ahora = this.ahora();
    const pendientes = this.db.sugerencias
      .filter((s) => s.status === 'Pendiente')
      .map((s) => vistaSugerencia(this.db, s, ahora))
      .sort(
        (a, b) =>
          ALERTA[a.deadlineStatus ?? 'on_time'].orden - ALERTA[b.deadlineStatus ?? 'on_time'].orden ||
          a.dueAt.localeCompare(b.dueAt),
      );
    return {
      unread: pendientes.length,
      items: pendientes.map((s) => {
        const alerta = ALERTA[s.deadlineStatus ?? 'on_time'];
        return {
          id: String(s.id),
          type: alerta.type,
          severity: alerta.severity,
          title: `${s.code} · ${nombreCorto(s.teacherName)} · ${s.guideCode}`,
          message: this.mensajeDeAlerta(s, ahora),
          createdAt: s.createdAt,
          read: false,
          suggestionId: s.id,
          guide: this.guia(s.guideId),
        };
      }),
    };
  }

  /** "venció hace 2 días hábiles (sigue pendiente)", "vence en 1 día hábil" o "nueva, recibida hoy". */
  private mensajeDeAlerta(s: SuggestionView, ahora: Date): string {
    if (s.deadlineStatus === 'overdue') return `venció hace ${diasHabiles(s.businessDaysOverdue ?? 1)} (sigue pendiente)`;
    if (s.deadlineStatus === 'due_soon') return s.businessDaysLeft ? `vence en ${diasHabiles(s.businessDaysLeft)}` : 'vence hoy';
    const dias = Math.round(
      (Date.parse(fechaEnBogota(ahora)) - Date.parse(fechaEnBogota(s.createdAt))) / 86_400_000,
    );
    if (dias <= 0) return 'nueva, recibida hoy';
    return dias === 1 ? 'nueva, recibida ayer' : `nueva, recibida hace ${dias} días`;
  }

  private aNotificacion(n: NotificacionMock): Notificacion {
    return {
      id: n.id,
      type: n.type,
      severity: GRAVEDAD[n.type],
      title: n.title,
      message: n.message,
      createdAt: n.createdAt,
      read: !!n.readAt,
      suggestionId: n.suggestionId,
      guide: this.guia(n.guideId),
    };
  }

  private guia(id: number): GuiaNotificada | null {
    const g = this.db.guias.find((x) => x.id === id);
    if (!g) return null;
    const v = vistaGuia(this.db, g);
    return { id: v.id, code: v.code, title: v.title, version: v.version, moduleName: v.moduleName };
  }

  /** Solo los docentes tienen notificaciones guardadas. */
  private docente(): number {
    const u = this.auth.user();
    if (!u) throw new ApiError('UNAUTHORIZED');
    if (!ROLES_DOCENTES.includes(u.rol)) throw new ApiError('FORBIDDEN');
    return u.id;
  }
}
