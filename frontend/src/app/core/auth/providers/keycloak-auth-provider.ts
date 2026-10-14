import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';
import { NEVER, Observable, catchError, from, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { User } from '../../../shared/models/user';
import { AuthProvider, ProblemaLogin } from '../auth-provider';
import { usuarioDesdeToken } from '../keycloak-user';

/**
 * Inicio de sesión real con Keycloak (flujo de código con PKCE y redirección).
 * La pantalla de login la pone Keycloak; la app solo recibe el token y lo manda al backend.
 */
@Injectable({ providedIn: 'root' })
export class KeycloakAuthProvider implements AuthProvider {
  readonly loginExterno = true;

  private readonly keycloak = new Keycloak(environment.keycloak);
  private usuario: User | null = null;
  private servicioNoDisponible = false;
  private cerrandoSesion = false;

  /**
   * Se ejecuta una vez antes de arrancar la app (ver provide-auth.ts). Termina un login que viene
   * de vuelta de Keycloak o, en segundo plano, recupera la sesión que ya esté abierta allí.
   * Nunca falla: si Keycloak no responde, la app arranca y el login explica el problema.
   */
  async iniciar(): Promise<void> {
    try {
      await this.keycloak.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: 'S256',
        checkLoginIframe: false,
      });
      this.usuario = this.keycloak.authenticated ? usuarioDesdeToken(this.keycloak.tokenParsed) : null;
    } catch (error) {
      console.error('No se pudo conectar con Keycloak', error);
      this.servicioNoDisponible = true;
    }
  }

  restaurarSesion(): User | null {
    return this.usuario;
  }

  /** Redirige a Keycloak: la página se va, así que nunca emite. */
  login(): Observable<User> {
    // Si se está cerrando sesión, no se vuelve a Keycloak para no deshacer el cierre.
    if (!this.cerrandoSesion) {
      void this.keycloak.login({ redirectUri: `${window.location.origin}/` });
    }
    return NEVER;
  }

  /**
   * Renueva el token si le quedan menos de 30 s y relee el rol. Un cambio de rol hecho en
   * Keycloak se ve cuando el token se renueva (antes de que venza la sesión del usuario).
   */
  refrescar(): Observable<User | null> {
    if (!this.keycloak.authenticated) return of(null);

    return from(this.keycloak.updateToken(30)).pipe(
      map(() => {
        this.usuario = usuarioDesdeToken(this.keycloak.tokenParsed);
        return this.usuario;
      }),
      // Sesión vencida o cerrada en Keycloak
      catchError(() => {
        this.usuario = null;
        return of(null);
      }),
    );
  }

  token(): string | null {
    return this.keycloak.token ?? null;
  }

  logout(): void {
    this.cerrandoSesion = true;
    this.usuario = null;
    void this.keycloak.logout({ redirectUri: `${window.location.origin}/login` });
  }

  problemaLogin(): ProblemaLogin | null {
    if (this.servicioNoDisponible) return 'SERVICIO_NO_DISPONIBLE';
    // Entró en Keycloak pero su cuenta no tiene un rol de la app: redirigirlo otra vez haría un bucle.
    if (this.keycloak.authenticated && !this.usuario) return 'SIN_ROL';
    return null;
  }
}
