import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { User } from '../../../shared/models/user';
import { AuthProvider } from '../auth-provider';
import { TokenStorage } from '../token-storage';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'coordinador' | 'docente' | 'docente_autorizado';
    isActive: boolean;
    createdAt?: string;
  };
}

const roles = {
  admin: 'ADMINISTRADOR',
  coordinador: 'COORDINADOR',
  docente: 'DOCENTE',
  docente_autorizado: 'DOCENTE_AUTORIZADO',
} as const;

@Injectable({ providedIn: 'root' })
export class HttpAuthProvider implements AuthProvider {
  private http = inject(HttpClient);
  private storage = inject(TokenStorage);

  restaurarSesion(): User | null {
    return this.storage.getToken() ? this.storage.getUser() : null;
  }

  login(credentials: { correo: string; contrasena: string }, recordar: boolean): Observable<User> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        email: credentials.correo,
        password: credentials.contrasena,
      })
      .pipe(
        map((response) => ({ token: response.accessToken, user: this.toUser(response.user) })),
        tap(({ token, user }) => this.storage.saveSession(token, user, recordar)),
        map(({ user }) => user),
      );
  }

  refrescar(): Observable<User | null> {
    return of(this.restaurarSesion());
  }

  token(): string | null {
    return this.storage.getToken();
  }

  logout(): void {
    this.storage.clear();
  }

  private toUser(user: LoginResponse['user']): User {
    return {
      id: Number.parseInt(user.id.replaceAll('-', '').slice(0, 8), 16),
      keycloakId: user.id,
      nombre: user.name,
      correo: user.email,
      rol: roles[user.role],
      activo: user.isActive,
      creadoEn: user.createdAt,
    };
  }
}
