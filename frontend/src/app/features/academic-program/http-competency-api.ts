import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error';
import { CompetencyRevision, CompetencyView } from '../../shared/models/competency';
import { cleanText } from '../../shared/utils/curricular';
import { AcademicIds, aPersona, numeroDe } from './academic-ids';
import {
  CompetencyApi,
  GuiaReferencia,
  ResultadoEdicion,
  ResultadoEliminacion,
} from './competency-api';
import { falla, traducirError } from './http-errores';

interface PersonaApi {
  id: string;
  name: string | null;
}

/** Competencia tal como la devuelve el backend (toCompetencyView). */
interface CompetenciaApi {
  id: string;
  moduleId: string;
  code: string;
  sequence: number;
  text: string;
  version: number;
  status: 'active' | 'deleted';
  publishedGuidesCount: number;
  createdBy: PersonaApi | null;
  createdAt: string;
  updatedBy: PersonaApi | null;
  updatedAt: string;
  deletedBy: PersonaApi | null;
  deletedAt: string | null;
}

interface RevisionApi {
  version: number;
  text: string;
  editedBy: PersonaApi | null;
  editedAt: string;
}

/** Misma API pública que el mock (CompetencyApi), pero contra el backend real (HE-02). */
type ContratoCompetencyApi = Pick<CompetencyApi, keyof CompetencyApi>;

@Injectable()
export class HttpCompetencyApi implements ContratoCompetencyApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private base = environment.apiUrl;

  /** Competencias activas del módulo (las eliminadas no se listan). */
  listar(moduleId: number): Observable<CompetencyView[]> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) =>
        this.http.get<CompetenciaApi[]>(`${this.base}/modules/${uuid}/competencies`),
      ),
      map((filas) => filas.map((c) => this.aVista(c))),
      catchError(falla()),
    );
  }

  /** Vista previa del próximo código. El backend cuenta también las eliminadas: un código nunca se reutiliza. */
  siguienteCodigo(moduleId: number): Observable<string> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) =>
        this.http.get<{ code: string }>(`${this.base}/modules/${uuid}/competencies/next-code`),
      ),
      map((r) => r.code),
      catchError(falla()),
    );
  }

  /** Incluye competencias eliminadas: se consultan por el historial, que sí las devuelve. */
  obtener(id: number): Observable<CompetencyView> {
    return this.ids.competencia(id).pipe(
      switchMap((uuid) =>
        this.http.get<CompetenciaApi>(`${this.base}/competencies/${uuid}`).pipe(
          catchError((e) => {
            // GET /competencies/:id no devuelve las eliminadas; /history sí.
            if (traducirError(e).code !== 'NOT_FOUND') return throwError(() => e);
            return this.http
              .get<{ competency: CompetenciaApi }>(`${this.base}/competencies/${uuid}/history`)
              .pipe(map((r) => r.competency));
          }),
        ),
      ),
      map((c) => this.aVista(c)),
      catchError(falla()),
    );
  }

  historial(id: number): Observable<CompetencyRevision[]> {
    return this.ids.competencia(id).pipe(
      switchMap((uuid) =>
        this.http.get<{ revisions: RevisionApi[] }>(`${this.base}/competencies/${uuid}/history`),
      ),
      map((r) =>
        r.revisions
          .map((v) => ({
            competencyId: id,
            version: v.version,
            text: v.text,
            editedBy: aPersona(v.editedBy),
            editedAt: v.editedAt,
          }))
          .sort((a, b) => b.version - a.version),
      ),
      catchError(falla()),
    );
  }

  /** El backend de guías (HE-03) aún no existe: no hay guías que listar. */
  guiasPublicadas(_id: number): Observable<GuiaReferencia[]> {
    return of([]);
  }

  /** Asocia una competencia nueva. Un módulo puede tener varias a la vez. */
  crear(moduleId: number, text: string): Observable<CompetencyView> {
    const limpio = cleanText(text);
    if (!limpio) return throwError(() => new ApiError('TEXT_REQUIRED'));
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) =>
        this.http.post<CompetenciaApi>(`${this.base}/modules/${uuid}/competencies`, {
          text: limpio,
        }),
      ),
      map((c) => this.aVista(c)),
      catchError(falla()),
    );
  }

  /** Cambia solo el texto: sube la versión y no toca las demás competencias. */
  actualizar(id: number, text: string): Observable<ResultadoEdicion> {
    const limpio = cleanText(text);
    if (!limpio) return throwError(() => new ApiError('TEXT_REQUIRED'));
    return this.ids.competencia(id).pipe(
      switchMap((uuid) =>
        this.http.patch<CompetenciaApi & { previousText: string }>(
          `${this.base}/competencies/${uuid}`,
          {
            text: limpio,
          },
        ),
      ),
      map((c) => ({ competencia: this.aVista(c), textoAnterior: c.previousText })),
      catchError(falla()),
    );
  }

  /** Borrado lógico: la retira del módulo sin afectar las guías publicadas que la referencian. */
  eliminar(id: number): Observable<ResultadoEliminacion> {
    return this.ids.competencia(id).pipe(
      switchMap((uuid) =>
        this.http.delete<{ competency: CompetenciaApi; remainingActiveCompetencies: number }>(
          `${this.base}/competencies/${uuid}`,
        ),
      ),
      map((r) => ({
        competencia: this.aVista(r.competency),
        restantes: r.remainingActiveCompetencies,
      })),
      catchError(falla()),
    );
  }

  private aVista(c: CompetenciaApi): CompetencyView {
    return {
      id: this.ids.registrar(c.id),
      moduleId: numeroDe(c.moduleId),
      code: c.code,
      sequence: c.sequence,
      text: c.text,
      version: c.version,
      status: c.status,
      publishedGuidesCount: c.publishedGuidesCount,
      createdBy: aPersona(c.createdBy),
      createdAt: c.createdAt,
      updatedBy: aPersona(c.updatedBy),
      updatedAt: c.updatedAt,
      deletedBy: aPersona(c.deletedBy),
      deletedAt: c.deletedAt,
    };
  }
}
