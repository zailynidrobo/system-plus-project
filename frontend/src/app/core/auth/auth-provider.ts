import { Observable } from 'rxjs';
import { LoginRequest, User } from '../../shared/models/user';

/**
 * Contrato de autenticación. Pantallas, guards y menú NO lo usan directamente: usan `Auth`.
 * Hoy lo implementa MockAuthProvider; para Keycloak se agrega KeycloakAuthProvider
 * y se cambia una línea en provide-auth.ts.
 */
export interface AuthProvider {
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

  logout(): void;
}
