import { Observable } from 'rxjs';
import { CambioContrasenaTemporal, LoginRequest, User } from '../../shared/models/user';

/** Por qué la pantalla de login no puede redirigir sola a un inicio de sesión externo. */
export type ProblemaLogin = 'SIN_ROL' | 'SERVICIO_NO_DISPONIBLE';

/**
 * Contrato de autenticación. Pantallas, guards y menú NO lo usan directamente: usan `Auth`.
 * Lo implementan MockAuthProvider (login simulado), HttpAuthProvider (formulario propio validado
 * por la API) y KeycloakAuthProvider (redirección a Keycloak);
 * provide-auth.ts elige cuál según environment.auth.
 */
export interface AuthProvider {
  /** true si el login lo hace un servicio externo (Keycloak) y la app no pide credenciales. */
  readonly loginExterno?: boolean;

  /** Solo con login externo: motivo por el que no se puede redirigir, o null si todo está bien. */
  problemaLogin?(): ProblemaLogin | null;

  /** Usuario de la sesión guardada al arrancar la app, o null. */
  restaurarSesion(): User | null;

  /** Inicia sesión. Con Keycloak redirige a su pantalla de login y no emite. */
  login(credenciales: LoginRequest, recordar: boolean): Observable<User>;

  /**
   * Vuelve a consultar al usuario actual: devuelve su rol vigente, o null si ya no tiene
   * acceso (desactivado o sesión vencida). Permite aplicar un cambio de rol sin cerrar sesión.
   */
  refrescar(): Observable<User | null>;

  /** Token para el encabezado Authorization, o null si no hay sesión. */
  token(): string | null;

  /**
   * Token listo para usar: si está por vencer, primero renueva la sesión. Emite null si la
   * sesión ya no se puede renovar. Sin esta función se usa token() tal cual.
   */
  tokenVigente?(): Observable<string | null>;

  /** Primer ingreso con contraseña temporal: la cambia por una definitiva e inicia sesión. */
  cambiarContrasenaTemporal?(datos: CambioContrasenaTemporal, recordar: boolean): Observable<User>;

  logout(): void;
}
