import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Campana, GravedadNotificacion, Notificacion, TipoNotificacion } from '../../shared/models/notification';
import { AcademicIds, numeroDe } from '../academic-program/academic-ids';
import { falla } from '../academic-program/http-errores';
import { SuggestionApi } from './suggestion-api';
import { HttpSuggestionApi } from './http-suggestion-api';

interface NotificationResponse {
  id: string;
  type: TipoNotificacion;
  severity: GravedadNotificacion;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  suggestionId?: string;
  guide: { id: string; code: string; title: string; version: string; moduleName: string } | null;
}

/**
 * Campana del encabezado (HE-05) contra el backend real. Misma API pública que NotificationApi:
 *   GET /academic/notifications · PATCH /academic/notifications/:id/read · PATCH /academic/notifications/read-all
 */
@Injectable()
export class HttpNotificationApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  // En modo 'http' SuggestionApi es HttpSuggestionApi: se le registran las sugerencias que llegan
  // por la campana para abrirlas sin volver a buscarlas.
  private suggestions = inject(SuggestionApi) as unknown as Partial<HttpSuggestionApi>;
  private base = `${environment.apiUrl}/academic/notifications`;

  campana(): Observable<Campana> {
    return this.http.get<{ unread: number; items: NotificationResponse[] }>(this.base).pipe(
      map((r) => ({ unread: r.unread, items: r.items.map((n) => this.aNotificacion(n)) })),
      catchError(falla()),
    );
  }

  marcarLeida(id: string): Observable<Notificacion> {
    return this.http.patch<NotificationResponse>(`${this.base}/${id}/read`, {}).pipe(
      map((n) => this.aNotificacion(n)),
      catchError(falla()),
    );
  }

  marcarTodasLeidas(): Observable<{ actualizadas: number }> {
    return this.http.patch<{ updated: number }>(`${this.base}/read-all`, {}).pipe(
      map((r) => ({ actualizadas: r.updated })),
      catchError(falla()),
    );
  }

  private aNotificacion(n: NotificationResponse): Notificacion {
    return {
      id: n.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      message: n.message,
      createdAt: n.createdAt,
      read: n.read,
      suggestionId: n.suggestionId ? (this.suggestions.registrar?.(n.suggestionId) ?? numeroDe(n.suggestionId)) : null,
      guide: n.guide ? { ...n.guide, id: this.ids.registrar(n.guide.id) } : null,
    };
  }
}
