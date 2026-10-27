import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap, throwError } from 'rxjs';
import { ApiError } from '../../shared/models/api-error';
import { CambioContrasenaTemporal, LoginRequest, Role, User } from '../../shared/models/user';
import { ProblemaLogin } from './auth-provider';
import { AUTH_PROVIDER } from './provide-auth';

/**
 * Fachada de autenticación que usan pantallas, guards, menú e interceptor.
 * No sabe si la sesión viene del mock o de Keycloak: eso lo decide AUTH_PROVIDER.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private provider = inject(AUTH_PROVIDER);

  private _user = signal<User | null>(this.provider.restaurarSesion());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  /** true si el login es externo (Keycloak): la pantalla de login redirige en vez de pedir datos. */
  readonly loginExterno = this.provider.loginExterno ?? false;

  /** Con login externo: por qué no se puede redirigir automáticamente, o null. */
  problemaLogin(): ProblemaLogin | null {
    return this.provider.problemaLogin?.() ?? null;
  }

  login(credenciales: LoginRequest, recordar = false): Observable<User> {
    return this.provider.login(credenciales, recordar).pipe(tap((u) => this._user.set(u)));
  }

  /** Relee al usuario: aplica un cambio de rol o cierra la sesión si fue desactivado. */
  refrescar(): Observable<User | null> {
    return this.provider.refrescar().pipe(tap((u) => this._user.set(u)));
  }

  /** Primer ingreso con contraseña temporal: la cambia e inicia sesión. */
  cambiarContrasenaTemporal(datos: CambioContrasenaTemporal, recordar = false): Observable<User> {
    if (!this.provider.cambiarContrasenaTemporal) {
      return throwError(() => new ApiError('NO_DISPONIBLE'));
    }
    return this.provider
      .cambiarContrasenaTemporal(datos, recordar)
      .pipe(tap((u) => this._user.set(u)));
  }

  token(): string | null {
    return this.provider.token();
  }

  /** Token para la próxima petición, renovando la sesión si hace falta. */
  tokenVigente(): Observable<string | null> {
    if (!this.provider.tokenVigente) return of(this.provider.token());
    return this.provider.tokenVigente().pipe(
      tap((token) => {
        if (!token && this._user()) this._user.set(null);
      }),
    );
  }

  logout(): void {
    this.provider.logout();
    this._user.set(null);
  }

  hasRole(roles: Role[]): boolean {
    const user = this._user();
    return !!user && roles.includes(user.rol);
  }
}
