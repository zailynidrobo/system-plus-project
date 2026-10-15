import { Injectable, signal } from '@angular/core';

/**
 * Último nivel de la miga de pan cuando cambia dentro de una misma pantalla
 * (p. ej. "Nueva guía base" → "Registro completado"). El Shell lo limpia al navegar.
 */
@Injectable({ providedIn: 'root' })
export class Miga {
  readonly detalle = signal<string | null>(null);
}
