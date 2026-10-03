import { Injectable } from '@angular/core';
import { User } from '../../shared/models/user';

const TOKEN_KEY = 'athena_token';
const USER_KEY = 'athena_user';

@Injectable({ providedIn: 'root' })
export class TokenStorage {
  // persistente = true → localStorage (sigue al cerrar el navegador)
  // persistente = false → sessionStorage (se borra al cerrar la pestaña)
  saveSession(token: string, user: User, persistente: boolean): void {
    this.clear();
    const store = persistente ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
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
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
    }
  }
}