import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mapKeycloakRole, toBackendRole } from '../../core/auth/role-mapping';
import {
  DetalleDeRol,
  DetalleEventoAuditoria,
  EventoAuditoria,
  FiltroAuditoria,
  OpcionesAuditoria,
  PaginaAuditoria,
  PermisoDeRol,
  ResumenDeRol,
  UsuarioAuditoria,
} from '../../shared/models/audit';
import { Role } from '../../shared/models/user';
import { falla } from '../academic-program/http-errores';
import { AuditApi } from './audit-api';

// el back manda el rol como texto de keycloak, aca se pasa al rol del front
type UsuarioApi = Omit<UsuarioAuditoria, 'role'> & { role: string | null };
type EventoApi = Omit<EventoAuditoria, 'user'> & { user: UsuarioApi };
type DetalleApi = Omit<DetalleEventoAuditoria, 'user'> & { user: UsuarioApi };

const aUsuario = (u: UsuarioApi): UsuarioAuditoria => ({ ...u, role: u.role ? mapKeycloakRole(u.role) : null });
const aEvento = (e: EventoApi): EventoAuditoria => ({ ...e, user: aUsuario(e.user) });
const aDetalle = (e: DetalleApi): DetalleEventoAuditoria => ({ ...e, user: aUsuario(e.user) });

type ContratoAuditApi = Pick<AuditApi, keyof AuditApi>;

/** Misma API pública que el mock (AuditApi), pero contra /audit del backend. Solo rol admin. */
@Injectable()
export class HttpAuditApi implements ContratoAuditApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/audit`;

  listar(f: FiltroAuditoria): Observable<PaginaAuditoria> {
    let params = new HttpParams().set('page', f.pagina).set('pageSize', f.porPagina);
    const q = f.busqueda.trim();
    if (q) params = params.set('q', q);
    if (f.userId) params = params.set('userId', f.userId);
    if (f.moduleId) params = params.set('moduleId', f.moduleId);
    if (f.area) params = params.set('area', f.area);
    if (f.resultado !== 'TODOS') params = params.set('result', f.resultado);
    if (f.desde) params = params.set('from', f.desde);
    if (f.hasta) params = params.set('to', f.hasta);
    return this.http.get<{ items: EventoApi[]; total: number }>(`${this.base}/actions`, { params }).pipe(
      map((r) => ({ items: r.items.map(aEvento), total: r.total })),
      catchError(falla()),
    );
  }

  opciones(): Observable<OpcionesAuditoria> {
    return this.http.get<OpcionesAuditoria>(`${this.base}/actions/filters`).pipe(catchError(falla()));
  }

  detalle(id: string): Observable<DetalleEventoAuditoria> {
    return this.http.get<DetalleApi>(`${this.base}/actions/${encodeURIComponent(id)}`).pipe(
      map(aDetalle),
      catchError(falla()),
    );
  }

  roles(): Observable<ResumenDeRol[]> {
    return this.http.get<{ role: string; label: string; totalPermissions: number; areas: string[] }[]>(`${this.base}/permissions`).pipe(
      map((lista) => lista.flatMap((r) => { const role = mapKeycloakRole(r.role); return role ? [{ ...r, role }] : []; })),
      catchError(falla()),
    );
  }

  rol(role: Role): Observable<DetalleDeRol> {
    return this.http
      .get<{ label: string; totalPermissions: number; permissions: PermisoDeRol[] }>(`${this.base}/permissions/${toBackendRole(role)}`)
      .pipe(map((r) => ({ ...r, role })), catchError(falla()));
  }
}
