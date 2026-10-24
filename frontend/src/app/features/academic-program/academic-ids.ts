import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Persona } from '../../shared/models/academic-module';
import { ApiError } from '../../shared/models/api-error';
import { idDesdeUuid } from '../users/http-user-api';

/** Número estable que el front usa como id a partir de un UUID del backend (0 si no es un UUID). */
export const numeroDe = (uuid: string | null | undefined): number => {
  const n = uuid ? idDesdeUuid(uuid) : NaN;
  return Number.isNaN(n) ? 0 : n;
};

/** Persona del backend ({ id, name }) -> Persona del front (id numérico). */
export const aPersona = (
  p: { id: string; name: string | null } | null | undefined,
): Persona | null => (p ? { id: numeroDe(p.id), name: p.name ?? '' } : null);

/**
 * El backend identifica programas, módulos y competencias con UUID; las rutas del front usan números
 * (/modulos/:id). Este servicio guarda la equivalencia número -> UUID y, si la página se recarga y aún
 * no se conoce, la reconstruye consultando el backend.
 */
@Injectable({ providedIn: 'root' })
export class AcademicIds {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private uuids = new Map<number, string>();
  private programa$?: Observable<string>;

  /** Registra el UUID y devuelve el id numérico con el que lo conoce el front. */
  registrar(uuid: string): number {
    const id = numeroDe(uuid);
    this.uuids.set(id, uuid);
    return id;
  }

  /** UUID del programa (el alcance actual tiene uno solo: el primero de GET /programs). */
  programaId(): Observable<string> {
    this.programa$ ??= this.http.get<{ id: string }[]>(`${this.base}/programs`).pipe(
      map((programas) => {
        if (!programas.length) throw new ApiError('NOT_FOUND');
        return programas[0].id;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    // shareReplay no guarda los errores: si la primera consulta falla, la siguiente vuelve a intentarlo.
    return this.programa$;
  }

  modulo(id: number): Observable<string> {
    const guardado = this.uuids.get(id);
    if (guardado) return of(guardado);
    // Recarga directa en /modulos/:id: se rehace el listado de módulos para conocer su UUID.
    return this.cargarModulos().pipe(map(() => this.exigir(id)));
  }

  competencia(id: number): Observable<string> {
    const guardado = this.uuids.get(id);
    if (guardado) return of(guardado);
    // Recarga directa en /competencias/:id/editar: se recorren las competencias de cada módulo.
    return this.cargarModulos().pipe(
      switchMap((modulos) =>
        modulos.length
          ? forkJoin(
              modulos.map((m) =>
                this.http.get<{ id: string }[]>(`${this.base}/modules/${m}/competencies`),
              ),
            )
          : of([] as { id: string }[][]),
      ),
      map((grupos) => {
        for (const g of grupos) for (const c of g) this.registrar(c.id);
        return this.exigir(id);
      }),
    );
  }

  /** Carga el listado de módulos del programa y registra sus UUID. Devuelve los UUID. */
  private cargarModulos(): Observable<string[]> {
    return this.programaId().pipe(
      switchMap((programa) =>
        this.http.get<{ id: string }[]>(`${this.base}/programs/${programa}/modules`),
      ),
      map((modulos) => {
        for (const m of modulos) this.registrar(m.id);
        return modulos.map((m) => m.id);
      }),
    );
  }

  private exigir(id: number): string {
    const uuid = this.uuids.get(id);
    if (!uuid) throw new ApiError('NOT_FOUND');
    return uuid;
  }
}
