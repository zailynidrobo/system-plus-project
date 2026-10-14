import { InjectionToken } from '@angular/core';
import { Observable, map, timer } from 'rxjs';

/** Latencia simulada (ms) de los servicios mock. Las pruebas la reemplazan por 0. */
export const MOCK_LATENCY = new InjectionToken<number>('MOCK_LATENCY', {
  providedIn: 'root',
  factory: () => 350,
});

/**
 * Simula una llamada HTTP: espera la latencia y luego ejecuta la operación, como lo haría
 * el servidor. Si la operación lanza un error, el Observable termina en error.
 * Devuelve una copia para que ninguna pantalla modifique los datos en memoria por referencia.
 */
export function simular<T>(ms: number, operacion: () => T): Observable<T> {
  return timer(ms).pipe(map(() => structuredClone(operacion())));
}
