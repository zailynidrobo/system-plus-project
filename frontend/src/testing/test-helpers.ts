// Utilidades para las pruebas (Vitest con TestBed).
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { Auth } from '../app/core/auth/auth';
import { MOCK_LATENCY } from '../app/core/mock/latency';
import { CONTRASENA_DE_PRUEBA } from '../app/core/mock/seed-users';
import { ApiError } from '../app/shared/models/api-error';
import { User } from '../app/shared/models/user';

/** Los servicios mock responden sin esperar. */
export const SIN_LATENCIA: Provider = { provide: MOCK_LATENCY, useValue: 0 };

export const CORREOS = {
  admin: 'admin@systemplus.edu.co',
  coordinador: 'coordinador@systemplus.edu.co',
  docente: 'docente@systemplus.edu.co',
  autorizado: 'autorizado@systemplus.edu.co',
  inactivo: 'inactivo@systemplus.edu.co',
} as const;

export function limpiarSesion(): void {
  localStorage.clear();
  sessionStorage.clear();
}

export function entrarComo(correo: string, recordar = false): Promise<User> {
  return firstValueFrom(
    TestBed.inject(Auth).login({ correo, contrasena: CONTRASENA_DE_PRUEBA }, recordar),
  );
}

/** Espera que el Observable falle y devuelve el error. */
export async function capturarError(obs: Observable<unknown>): Promise<ApiError> {
  try {
    await firstValueFrom(obs);
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('Se esperaba un error y la operación terminó bien');
}
