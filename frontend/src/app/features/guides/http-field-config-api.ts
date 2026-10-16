import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FieldConfig, GuideField } from '../../shared/models/guide-field';
import { AcademicIds } from '../academic-program/academic-ids';
import { falla } from '../academic-program/http-errores';
import { diferencias, FieldConfigApi, ImpactoEstructura } from './field-config-api';
import { EstructuraVigente, OrigenEstructura } from '../../core/mock/estructuras';

type ContratoFieldConfigApi = Pick<FieldConfigApi, keyof FieldConfigApi>;

interface FieldConfigResponse {
  moduleId: string;
  competencyId?: string;
  formType: 'base';
  fields: GuideField[];
  version: number;
  updatedAt: string;
  origin: OrigenEstructura;
}

interface FieldConfigImpactResponse {
  publishedGuides: number;
  draftGuides: number;
  teacherVersions: number;
  currentVersion: number;
  nextVersion: number;
}

@Injectable()
export class HttpFieldConfigApi implements ContratoFieldConfigApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private base = environment.apiUrl;

  obtener(moduleId: number, competencyId: number | null = null): Observable<EstructuraVigente> {
    return this.withModule(moduleId, competencyId, (moduleUuid, competencyUuid) => {
      const params: Record<string, string> = competencyUuid ? { competencyId: competencyUuid } : {};
      return this.http
        .get<FieldConfigResponse>(`${this.base}/academic/modules/${moduleUuid}/guide-fields`, {
          params,
        })
        .pipe(map((response) => this.aVista(response)));
    }).pipe(catchError(falla()));
  }

  impacto(
    moduleId: number,
    competencyId: number | null,
    fields: GuideField[],
  ): Observable<ImpactoEstructura> {
    return this.withModule(moduleId, competencyId, (moduleUuid, competencyUuid) =>
      forkJoin({
        current: this.http.get<FieldConfigResponse>(
          `${this.base}/academic/modules/${moduleUuid}/guide-fields`,
          { params: competencyUuid ? { competencyId: competencyUuid } : {} },
        ),
        impact: this.http.post<FieldConfigImpactResponse>(
          `${this.base}/academic/modules/${moduleUuid}/guide-fields/impact`,
          competencyUuid ? { competencyId: competencyUuid } : {},
        ),
      }).pipe(
        map(({ current, impact }) => ({
          cambios: diferencias(current.fields, fields),
          publicadas: impact.publishedGuides,
          borradores: impact.draftGuides,
          versionesDocentes: impact.teacherVersions,
          versionActual: impact.currentVersion,
          versionNueva: impact.nextVersion,
        })),
      ),
    ).pipe(catchError(falla()));
  }

  guardar(
    moduleId: number,
    competencyId: number | null,
    fields: GuideField[],
  ): Observable<FieldConfig> {
    return this.withModule(moduleId, competencyId, (moduleUuid, competencyUuid) => {
      const path = competencyUuid
        ? `${this.base}/academic/modules/${moduleUuid}/competencies/${competencyUuid}/guide-fields`
        : `${this.base}/academic/modules/${moduleUuid}/guide-fields`;
      return this.http
        .put<FieldConfigResponse>(path, { fields })
        .pipe(map((response) => this.aConfig(response)));
    }).pipe(catchError(falla()));
  }

  private withModule<T>(
    moduleId: number,
    competencyId: number | null,
    request: (moduleUuid: string, competencyUuid?: string) => Observable<T>,
  ): Observable<T> {
    return this.ids
      .modulo(moduleId)
      .pipe(
        switchMap((moduleUuid) =>
          competencyId === null
            ? request(moduleUuid)
            : this.ids
                .competencia(competencyId)
                .pipe(switchMap((competencyUuid) => request(moduleUuid, competencyUuid))),
        ),
      );
  }

  private aVista(response: FieldConfigResponse): EstructuraVigente {
    return {
      config: this.aConfig(response),
      origen: response.origin,
    };
  }

  private aConfig(response: FieldConfigResponse): FieldConfig {
    return {
      moduleId: this.ids.registrar(response.moduleId),
      competencyId: response.competencyId ? this.ids.registrar(response.competencyId) : null,
      fields: response.fields,
      version: response.version,
      updatedAt: response.updatedAt,
      updatedBy: 'Sistema',
    };
  }
}
