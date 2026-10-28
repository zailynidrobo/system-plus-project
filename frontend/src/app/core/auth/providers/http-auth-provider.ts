import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../shared/models/api-error';
import { CambioContrasenaTemporal, LoginRequest, User } from '../../../shared/models/user';
import { AuthProvider } from '../auth-provider';
import { mapKeycloakRole } from '../role-mapping';
import { TokenStorage } from '../token-storage';

/** Sesión que devuelve la API (POST /auth/login, /auth/refresh y /auth/temporary-password). */
interface SesionApi {
  accessToken: string;
  refreshToken: string;
  /** Segundos de vida del token de acceso. */
  expiresIn: number;
  user: { id: string; name: string; email: string; role: string; isActive: boolean };
}

/** El token se renueva cuando le quedan menos de estos segundos. */
const MARGEN_RENOVACION_MS = 30_000;

/**
 * Inicio de sesión con el formulario propio de System Plus. La API valida las credenciales
 * contra Keycloak y devuelve sus tokens; aquí se guardan y se renuevan antes de que venzan.
 */
@Injectable({ providedIn: 'root' })
export class HttpAuthProvider implements AuthProvider {
  private http = inject(HttpClient);
  private storage = inject(TokenStorage);
  private readonly url = `${environment.apiUrl}/auth`;

  /** Renovación en curso: si varias peticiones la piden a la vez, se hace una sola. */
  private renovando: Observable<string | null> | null = null;

  restaurarSesion(): User | null {
    return this.storage.getToken() ? this.storage.getUser() : null;
  }

  login(credenciales: LoginRequest, recordar: boolean): Observable<User> {
    return this.abrirSesion(
      this.http.post<SesionApi>(`${this.url}/login`, {
        email: credenciales.correo,
        password: credenciales.contrasena,
      }),
      recordar,
    );
  }

  cambiarContrasenaTemporal(datos: CambioContrasenaTemporal, recordar: boolean): Observable<User> {
    return this.abrirSesion(
      this.http.post<SesionApi>(`${this.url}/temporary-password`, {
        email: datos.correo,
        currentPassword: datos.contrasenaTemporal,
        newPassword: datos.contrasenaNueva,
      }),
      recordar,
    );
  }

  /** Renueva el token si hace falta y devuelve el usuario vigente (con su rol actual). */
  refrescar(): Observable<User | null> {
    return this.tokenVigente().pipe(map((token) => (token ? this.storage.getUser() : null)));
  }

  token(): string | null {
    return this.storage.getToken();
  }

  tokenVigente(): Observable<string | null> {
    const token = this.storage.getToken();
    const renovacion = this.storage.getRenovacion();
    if (!token || !renovacion) return of(token);
    if (renovacion.venceEn - Date.now() > MARGEN_RENOVACION_MS) return of(token);

    this.renovando ??= this.http
      .post<SesionApi>(`${this.url}/refresh`, { refreshToken: renovacion.refreshToken })
      .pipe(
        map((sesion) => {
          this.storage.updateTokens(sesion.accessToken, this.renovacionDe(sesion));
          this.storage.updateUser(this.aUsuario(sesion.user));
          return sesion.accessToken;
        }),
        catchError((error: HttpErrorResponse) => {
          // 401: la sesión venció, se cerró o la cuenta se desactivó. Otro error (API caída):
          // se sigue con el token actual y la petición mostrará su propio error.
          if (error.status !== 401) return of(token);
          this.storage.clear();
          return of(null);
        }),
        finalize(() => (this.renovando = null)),
        shareReplay(1),
      );
    return this.renovando;
  }

  logout(): void {
    const renovacion = this.storage.getRenovacion();
    this.storage.clear();
    if (renovacion) {
      // Cierra también la sesión en Keycloak. Si falla, el token vence solo.
      this.http
        .post(`${this.url}/logout`, { refreshToken: renovacion.refreshToken })
        .subscribe({ error: () => undefined });
    }
  }

  private abrirSesion(peticion: Observable<SesionApi>, recordar: boolean): Observable<User> {
    return peticion.pipe(
      map((sesion) => {
        const usuario = this.aUsuario(sesion.user);
        this.storage.saveSession(sesion.accessToken, usuario, recordar, this.renovacionDe(sesion));
        return usuario;
      }),
      catchError((error: HttpErrorResponse) => throwError(() => aApiError(error))),
    );
  }

  private renovacionDe(sesion: SesionApi) {
    return { refreshToken: sesion.refreshToken, venceEn: Date.now() + sesion.expiresIn * 1000 };
  }

  private aUsuario(user: SesionApi['user']): User {
    const rol = mapKeycloakRole(user.role);
    if (!rol) throw new ApiError('SIN_ROL');
    return {
      // El id numérico solo existe en los datos simulados; el real es keycloakId (UUID).
      // Se deriva un número estable del UUID para las pantallas que aún lo usan.
      id: Number.parseInt(user.id.replaceAll('-', '').slice(0, 8), 16),
      keycloakId: user.id,
      nombre: user.name,
      correo: user.email,
      rol,
      activo: user.isActive,
    };
  }
}

/**
 * Error HTTP -> ApiError con el código que manda la API. Sin respuesta (API apagada) se trata
 * como servicio no disponible, no como credenciales inválidas.
 */
function aApiError(error: HttpErrorResponse): ApiError {
  if (error.status === 0 || error.status >= 500) return new ApiError('SERVICIO_NO_DISPONIBLE');
  const code = (error.error as { code?: unknown } | null)?.code;
  if (typeof code === 'string') return new ApiError(code);
  return new ApiError(error.status === 400 ? 'DATOS_INVALIDOS' : 'CREDENCIALES_INVALIDAS');
}
