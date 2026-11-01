import { InjectionToken } from '@angular/core';

/** Fecha actual de los servicios mock de HE-05. Las pruebas la fijan para revisar los plazos. */
export const RELOJ = new InjectionToken<() => Date>('RELOJ', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
