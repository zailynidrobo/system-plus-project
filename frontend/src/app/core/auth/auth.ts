import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { LoginRequest, Role, User } from '../../shared/models/user';
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

  login(credenciales: LoginRequest, recordar = false): Observable<User> {
    return this.provider.login(credenciales, recordar).pipe(tap((u) => this._user.set(u)));
  }

  /** Relee al usuario: aplica un cambio de rol o cierra la sesión si fue desactivado. */
  refrescar(): Observable<User | null> {
    return this.provider.refrescar().pipe(tap((u) => this._user.set(u)));
  }

  token(): string | null {
    return this.provider.token();
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
