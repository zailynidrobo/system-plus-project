import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, delay, of, tap, throwError } from 'rxjs';
import { LoginRequest, LoginResponse, Role, User } from '../../shared/models/user';
import { TokenStorage } from './token-storage';

// Cuando el backend esté listo: USE_MOCK = false y ajustar API_URL
const USE_MOCK = true;
const API_URL = 'http://localhost:3000/api';

const MOCK_USERS: (User & { contrasena: string })[] = [
  { id: 1, nombre: 'Admin Prueba', correo: 'admin@systemplus.edu.co', contrasena: '123456', rol: 'ADMINISTRADOR', activo: true },
  { id: 2, nombre: 'Coordinadora Prueba', correo: 'coordinador@systemplus.edu.co', contrasena: '123456', rol: 'COORDINADOR', activo: true },
  { id: 3, nombre: 'Docente Prueba', correo: 'docente@systemplus.edu.co', contrasena: '123456', rol: 'DOCENTE', activo: true },
  { id: 4, nombre: 'Docente Inactivo', correo: 'inactivo@systemplus.edu.co', contrasena: '123456', rol: 'DOCENTE', activo: false },
];

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private storage = inject(TokenStorage);

  private _user = signal<User | null>(this.storage.getUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  login(credenciales: LoginRequest, recordar = false): Observable<LoginResponse> {
    const peticion = USE_MOCK
      ? this.mockLogin(credenciales)
      : this.http.post<LoginResponse>(`${API_URL}/auth/login`, credenciales);

    return peticion.pipe(
      tap((res) => {
        this.storage.saveSession(res.token, res.usuario, recordar);
        this._user.set(res.usuario);
      }),
    );
  }

  logout(): void {
    this.storage.clear();
    this._user.set(null);
  }

  hasRole(roles: Role[]): boolean {
    const user = this._user();
    return !!user && roles.includes(user.rol);
  }

  private mockLogin(c: LoginRequest): Observable<LoginResponse> {
    const encontrado = MOCK_USERS.find(
      (u) => u.correo === c.correo && u.contrasena === c.contrasena && u.activo,
    );
    if (!encontrado) {
      return throwError(() => new Error('Credenciales inválidas')).pipe(delay(500));
    }
    const { contrasena, ...usuario } = encontrado;
    return of({ token: 'token-falso-' + usuario.id, usuario }).pipe(delay(500));
  }
}