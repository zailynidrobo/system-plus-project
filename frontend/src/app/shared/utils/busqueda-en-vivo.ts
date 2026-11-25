import { DestroyRef, inject } from '@angular/core';
import { Observable, Observer, Subscription } from 'rxjs';

/** Pausa entre teclas antes de consultar: corta para que se sienta inmediato. */
export const ESPERA_BUSQUEDA_MS = 200;

/**
 * Búsqueda mientras se escribe. Espera una pausa corta entre teclas y cancela la
 * consulta anterior, para no saturar la API y para que una respuesta vieja nunca
 * reemplace los resultados de lo último que se escribió.
 * Se crea como campo del componente (contexto de inyección).
 */
export class BusquedaEnVivo {
  private espera: ReturnType<typeof setTimeout> | null = null;
  private consulta: Subscription | null = null;

  constructor(private readonly ms = ESPERA_BUSQUEDA_MS) {
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  /** Programa la búsqueda; cada tecla nueva reinicia la espera. */
  alEscribir(buscar: () => void): void {
    this.limpiarEspera();
    this.espera = setTimeout(() => {
      this.espera = null;
      buscar();
    }, this.ms);
  }

  /** Lanza la consulta y cancela la que siguiera en curso. */
  consultar<T>(
    origen: Observable<T>,
    observador: Partial<Observer<T>> | ((valor: T) => void),
  ): void {
    this.limpiarEspera();
    this.consulta?.unsubscribe();
    this.consulta =
      typeof observador === 'function'
        ? origen.subscribe(observador)
        : origen.subscribe(observador);
  }

  detener(): void {
    this.limpiarEspera();
    this.consulta?.unsubscribe();
    this.consulta = null;
  }

  private limpiarEspera(): void {
    if (this.espera) clearTimeout(this.espera);
    this.espera = null;
  }
}
