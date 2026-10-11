import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiError } from '../../../shared/models/api-error';
import { LoginRequest, User } from '../../../shared/models/user';
import { MOCK_LATENCY, simular } from '../../mock/latency';
import { MockDb } from '../../mock/mock-db';
import { sinContrasena } from '../../mock/seed-users';
import { AuthProvider } from '../auth-provider';
import { TokenStorage } from '../token-storage';

/** Login simulado contra los usuarios del mock compartido (mismos datos que /usuarios). */
@Injectable({ providedIn: 'root' })
export class MockAuthProvider implements AuthProvider {
  private db = inject(MockDb);
  private storage = inject(TokenStorage);
  private ms = inject(MOCK_LATENCY);

  restaurarSesion(): User | null {
    return this.storage.getToken() ? this.storage.getUser() : null;
  }

  login(c: LoginRequest, recordar: boolean): Observable<User> {
    return simular(this.ms, () => {
      const correo = c.correo.trim().toLowerCase();
      const encontrado = this.db.usuarios.find(
        (u) => u.correo === correo && u.contrasena !== null && u.contrasena === c.contrasena,
      );
      // Mismo error para correo inexistente, contraseña incorrecta o usuario desactivado (HU-05)
      if (!encontrado || !encontrado.activo) throw new ApiError('CREDENCIALES_INVALIDAS');

      const usuario = sinContrasena(encontrado);
      this.storage.saveSession('token-falso-' + usuario.id, usuario, recordar);
      return usuario;
    });
  }

  refrescar(): Observable<User | null> {
    const actual = this.storage.getUser();
    if (!actual) return of(null);

    const enDb = this.db.usuarios.find((u) => u.id === actual.id);
    if (!enDb || !enDb.activo) {
      this.storage.clear();
      return of(null);
    }
    const usuario = sinContrasena(enDb);
    this.storage.updateUser(usuario);
    return of(usuario);
  }

  token(): string | null {
    return this.storage.getToken();
  }

  logout(): void {
    this.storage.clear();
  }
}
