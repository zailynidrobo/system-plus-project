import { Injectable } from '@angular/core';
import { User } from '../../shared/models/user';

const TOKEN_KEY = 'athena_token';
const USER_KEY = 'athena_user';
const REFRESH_KEY = 'athena_refresh';
const EXPIRES_KEY = 'athena_expires_at';

/** Datos para renovar la sesión sin pedir otra vez la contraseña (solo con el login propio). */
export interface Renovacion {
  refreshToken: string;
  /** Momento (ms desde 1970) en que vence el token de acceso. */
  venceEn: number;
}

@Injectable({ providedIn: 'root' })
export class TokenStorage {
  // persistente = true -> localStorage (sigue al cerrar el navegador)
  // persistente = false -> sessionStorage (se borra al cerrar la pestaña)
  saveSession(token: string, user: User, persistente: boolean, renovacion?: Renovacion): void {
    this.clear();
    const store = persistente ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
    if (renovacion) this.escribirRenovacion(store, renovacion);
  }

  // Actualiza los datos del usuario (p. ej. su rol) en el mismo almacenamiento de la sesión
  updateUser(user: User): void {
    const store = this.storeActual();
    if (store) store.setItem(USER_KEY, JSON.stringify(user));
  }

  /** Guarda los tokens renovados en el mismo almacenamiento de la sesión. */
  updateTokens(token: string, renovacion: Renovacion): void {
    const store = this.storeActual();
    if (!store) return;
    store.setItem(TOKEN_KEY, token);
    this.escribirRenovacion(store, renovacion);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  getRenovacion(): Renovacion | null {
    const store = this.storeActual();
    const refreshToken = store?.getItem(REFRESH_KEY);
    const venceEn = Number(store?.getItem(EXPIRES_KEY));
    return refreshToken && Number.isFinite(venceEn) ? { refreshToken, venceEn } : null;
  }

  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  clear(): void {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of [TOKEN_KEY, USER_KEY, REFRESH_KEY, EXPIRES_KEY]) store.removeItem(key);
    }
  }

  private storeActual(): Storage | null {
    if (localStorage.getItem(TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
    return null;
  }

  private escribirRenovacion(store: Storage, renovacion: Renovacion): void {
    store.setItem(REFRESH_KEY, renovacion.refreshToken);
    store.setItem(EXPIRES_KEY, String(renovacion.venceEn));
  }
}
