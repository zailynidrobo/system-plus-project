import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mapKeycloakRole, toBackendRole } from '../../core/auth/role-mapping';
import { ApiError } from '../../shared/models/api-error';
import { EventoUsuario, ROLE_LABELS, Role, User, UsuarioCreado } from '../../shared/models/user';
import { fechaCorta } from '../../shared/utils/fechas';
import { FiltroUsuarios, NuevoUsuario, PaginaUsuarios, ResumenUsuarios, UserApi } from './user-api';

/** Usuario tal como lo devuelve el backend (gestion-guias, módulo users). */
interface UsuarioApi {
  id: string; // UUID de Keycloak
  name: string;
  email: string;
  role: string | null; // admin | coordinador | docente | docente_autorizado
  isActive: boolean;
  createdAt?: string;
  temporaryPassword?: string;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * El front usa ids numéricos (rutas /usuarios/:id/editar) y el backend UUID. Se deriva un número
 * estable del UUID (sus primeros 8 dígitos hexadecimales), así el mismo usuario tiene siempre el mismo
 * id, incluso después de recargar la página.
 */
export const idDesdeUuid = (uuid: string): number => parseInt(uuid.replace(/-/g, '').slice(0, 8), 16);

/** Misma API pública que el mock (UserApi), pero contra el backend real. */
type ContratoUserApi = Pick<UserApi, keyof UserApi>;

@Injectable()
export class HttpUserApi implements ContratoUserApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  /** id numérico del front -> UUID del backend. Se llena en cada consulta del listado. */
  private uuids = new Map<number, string>();

  listar(f: FiltroUsuarios): Observable<PaginaUsuarios> {
    return this.todos().pipe(
      map((usuarios) => {
        const q = normalizar(f.busqueda.trim());
        const filtrados = usuarios.filter((u) => {
          const coincideTexto = !q || normalizar(u.nombre).includes(q) || normalizar(u.correo).includes(q);
          const coincideRol = f.rol === 'TODOS' || u.rol === f.rol;
          const coincideEstado = f.estado === 'TODOS' || (f.estado === 'ACTIVO' ? u.activo : !u.activo);
          return coincideTexto && coincideRol && coincideEstado;
        });
        const inicio = (f.pagina - 1) * f.porPagina;
        return { items: filtrados.slice(inicio, inicio + f.porPagina), total: filtrados.length };
      }),
    );
  }

  resumen(): Observable<ResumenUsuarios> {
    return this.todos().pipe(
      map((usuarios) => {
        const activos = usuarios.filter((u) => u.activo).length;
        return { total: usuarios.length, activos, desactivados: usuarios.length - activos };
      }),
    );
  }

  conteoPorRol(): Observable<Record<Role, number>> {
    return this.todos().pipe(
      map((usuarios) => {
        const conteo = Object.fromEntries(Object.keys(ROLE_LABELS).map((r) => [r, 0])) as Record<Role, number>;
        for (const u of usuarios) conteo[u.rol]++;
        return conteo;
      }),
    );
  }

  correoDisponible(correo: string): Observable<boolean> {
    const buscado = correo.trim().toLowerCase();
    return this.todos().pipe(map((usuarios) => !usuarios.some((u) => u.correo.toLowerCase() === buscado)));
  }

  // El backend aún no guarda un historial de eventos: se muestra al menos la fecha de registro.
  historial(id: number): Observable<EventoUsuario[]> {
    return this.obtener(id).pipe(
      map((u) => (u.creadoEn ? [{ titulo: 'Usuario registrado', detalle: fechaCorta(u.creadoEn) }] : [])),
    );
  }

  crear(d: NuevoUsuario): Observable<UsuarioCreado> {
    const body = { name: d.nombre.trim(), email: d.correo.trim().toLowerCase(), role: toBackendRole(d.rol) };
    return this.http.post<UsuarioApi>(this.base, body).pipe(
      map((u) => ({ ...this.aUsuario(u)!, contrasenaTemporal: u.temporaryPassword })),
      catchError((e) => throwError(() => this.aError(e))),
    );
  }

  obtener(id: number): Observable<User> {
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.get<UsuarioApi>(`${this.base}/${uuid}`)),
      map((u) => this.aUsuarioObligatorio(u)),
      catchError((e) => throwError(() => this.aError(e))),
    );
  }

  actualizar(id: number, d: { nombre: string; correo: string }): Observable<User> {
    const body = { name: d.nombre.trim(), email: d.correo.trim().toLowerCase() };
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.patch<UsuarioApi>(`${this.base}/${uuid}`, body)),
      map((u) => this.aUsuarioObligatorio(u)),
      catchError((e) => throwError(() => this.aError(e))),
    );
  }

  desactivar(id: number): Observable<User> {
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.patch<UsuarioApi>(`${this.base}/${uuid}/deactivate`, {})),
      map((u) => this.aUsuarioObligatorio(u)),
      catchError((e) => throwError(() => this.aError(e))),
    );
  }

  cambiarRol(id: number, rol: Role): Observable<User> {
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.patch<UsuarioApi>(`${this.base}/${uuid}/role`, { role: toBackendRole(rol) })),
      map((u) => this.aUsuarioObligatorio(u)),
      catchError((e) => throwError(() => this.aError(e))),
    );
  }

  /** Todos los usuarios con rol de la app (el backend no pagina: filtros y páginas se hacen aquí). */
  private todos(): Observable<User[]> {
    return this.http.get<UsuarioApi[]>(this.base).pipe(
      map((filas) => filas.map((f) => this.aUsuario(f)).filter((u): u is User => u !== null)),
      catchError((e) => throwError(() => this.aError(e))),
    );
  }

  private uuid(id: number): Observable<string> {
    const guardado = this.uuids.get(id);
    if (guardado) return of(guardado);
    // Recarga directa en /usuarios/:id/editar: aún no se conoce el UUID; se rehace el listado.
    return this.todos().pipe(
      map(() => {
        const uuid = this.uuids.get(id);
        if (!uuid) throw new ApiError('NO_ENCONTRADO');
        return uuid;
      }),
    );
  }

  /** Usuario del backend -> usuario del front. Sin rol de la app (null) no se muestra. */
  private aUsuario(u: UsuarioApi): User | null {
    const rol = u.role ? mapKeycloakRole(u.role) : null;
    if (!rol) return null;
    const id = idDesdeUuid(u.id);
    this.uuids.set(id, u.id);
    return { id, keycloakId: u.id, nombre: u.name, correo: u.email, rol, activo: u.isActive, creadoEn: u.createdAt };
  }

  private aUsuarioObligatorio(u: UsuarioApi): User {
    const usuario = this.aUsuario(u);
    if (!usuario) throw new ApiError('NO_ENCONTRADO');
    return usuario;
  }

  private aError(e: unknown): ApiError {
    if (e instanceof ApiError) return e;
    const estado = e instanceof HttpErrorResponse ? e.status : 0;
    const codigo = e instanceof HttpErrorResponse ? (e.error as { code?: unknown } | null)?.code : undefined;
    if (codigo === 'ACCION_SOBRE_SI_MISMO' || codigo === 'ULTIMO_ADMINISTRADOR') return new ApiError(codigo);
    if (estado === 409) return new ApiError('CORREO_EN_USO');
    if (estado === 404) return new ApiError('NO_ENCONTRADO');
    if (estado === 401 || estado === 403) return new ApiError('SIN_PERMISO');
    return new ApiError('ERROR_DE_SERVIDOR', { estado });
  }
}
