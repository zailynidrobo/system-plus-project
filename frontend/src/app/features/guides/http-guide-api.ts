import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../../core/auth/auth';
import { ApiError } from '../../shared/models/api-error';
import { AcademicModule, ModuleView } from '../../shared/models/academic-module';
import { Guide, GuideEvent, GuideStatus, GuideView } from '../../shared/models/guide';
import { GuideContent, GuideField } from '../../shared/models/guide-field';
import { User } from '../../shared/models/user';
import { AcademicIds, numeroDe } from '../academic-program/academic-ids';
import { falla } from '../academic-program/http-errores';
import { ModuleApi } from '../academic-program/module-api';
import { UserApi } from '../users/user-api';
import { FiltroGuias, GuideApi, NuevaGuia, PaginaGuias, ResumenGuias } from './guide-api';

interface GuideResponse {
  id: string;
  code: string;
  moduleId: string;
  moduleName: string;
  competencyId?: string;
  competencyName?: string;
  competencyDeleted: boolean;
  title: string;
  content: GuideContent;
  fields: GuideField[];
  structureVersion: number;
  version: string;
  status: 'draft' | 'published';
  createdBy?: { id: string; name: string };
  updatedBy?: { id: string; name: string };
  publishedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

interface GuidePageResponse {
  items: GuideResponse[];
  total: number;
  page: number;
  pageSize: number;
}

interface GuideEventResponse {
  id: string;
  guideId: string;
  title: string;
  author: { id: string; name: string };
  createdAt: string;
}

const ESTADOS: Record<GuideResponse['status'], GuideStatus> = {
  draft: 'Borrador',
  published: 'Publicada',
};

@Injectable()
export class HttpGuideApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private moduleApi = inject(ModuleApi);
  private userApi = inject(UserApi);
  private auth = inject(Auth);
  private base = `${environment.apiUrl}/academic/guides`;
  private guideUuids = new Map<number, string>();

  listar(filtro: FiltroGuias): Observable<PaginaGuias> {
    const moduleId$ =
      filtro.moduleId === null ? of(null) : this.ids.modulo(filtro.moduleId);
    const competencyId$ =
      filtro.competencyId === null ? of(null) : this.ids.competencia(filtro.competencyId);
    return forkJoin({ moduleId: moduleId$, competencyId: competencyId$ }).pipe(
      switchMap(({ moduleId, competencyId }) => {
        const params: Record<string, string> = {
          page: String(filtro.pagina),
          pageSize: String(filtro.porPagina),
        };
        const search = filtro.busqueda.trim();
        if (search) params['search'] = search;
        if (moduleId) params['moduleId'] = moduleId;
        if (competencyId) params['competencyId'] = competencyId;
        if (filtro.estado !== 'TODOS') {
          params['status'] = filtro.estado === 'Borrador' ? 'draft' : 'published';
        }
        return forkJoin({
          page: this.http.get<GuidePageResponse>(this.base, { params }),
          modules: this.moduleApi.listar({ busqueda: '', estado: 'TODOS', orden: 'codigo' }),
        });
      }),
      map(({ page, modules }) => ({
        items: page.items.map((guide) => this.aVista(guide, modules)),
        total: page.total,
      })),
      catchError(falla()),
    );
  }

  resumen(): Observable<ResumenGuias> {
    return this.http
      .get<ResumenGuias>(`${this.base}/summary`)
      .pipe(catchError(falla()));
  }

  obtener(id: number): Observable<GuideView> {
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.get<GuideResponse>(`${this.base}/${uuid}`)),
      switchMap((guide) => this.withModule(guide, (module) => this.aVista(guide, [module]))),
      catchError(falla()),
    );
  }

  historial(id: number): Observable<GuideEvent[]> {
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.get<GuideEventResponse[]>(`${this.base}/${uuid}/events`)),
      map((events) =>
        events.map((event) => ({
          guideId: id,
          titulo: event.title,
          autor: event.author.name,
          fecha: event.createdAt,
        })),
      ),
      catchError(falla()),
    );
  }

  siguienteCodigo(moduleId: number): Observable<string> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) =>
        this.http.get<{ code: string }>(
          `${environment.apiUrl}/academic/modules/${uuid}/guides/next-code`,
        ),
      ),
      map((result) => result.code),
      catchError(falla()),
    );
  }

  docentesDelModulo(moduleId: number): Observable<User[]> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) =>
        forkJoin({
          teacherIds: this.http.get<string[]>(
            `${environment.apiUrl}/academic/modules/${uuid}/teachers`,
          ),
          users: this.userApi.listar({
            busqueda: '',
            rol: 'TODOS',
            estado: 'ACTIVO',
            pagina: 1,
            porPagina: 1000,
          }),
        }),
      ),
      map(({ teacherIds, users }) => {
        const assigned = new Set(teacherIds);
        return users.items.filter((user) => !!user.keycloakId && assigned.has(user.keycloakId));
      }),
      catchError(falla()),
    );
  }

  crear(data: NuevaGuia): Observable<GuideView> {
    return forkJoin({
      moduleId: this.ids.modulo(data.moduleId),
      competencyId: this.ids.competencia(data.competencyId),
    }).pipe(
      switchMap(({ moduleId, competencyId }) =>
        this.http.post<GuideResponse>(this.base, {
          moduleId,
          competencyId,
          content: data.content,
        }),
      ),
      switchMap((guide) =>
        this.withModule(guide, (module) =>
          this.aVista(
            guide,
            [module],
            this.auth.user()
              ? {
                  id: this.auth.user()!.id,
                  name: this.auth.user()!.nombre,
                }
              : null,
          ),
        ),
      ),
      catchError(falla()),
    );
  }

  actualizar(
    id: number,
    data: { competencyId: number; content: GuideContent },
  ): Observable<GuideView> {
    return forkJoin({
      uuid: this.uuid(id),
      competencyId: this.ids.competencia(data.competencyId),
    }).pipe(
      switchMap(({ uuid, competencyId }) =>
        this.http.patch<GuideResponse>(`${this.base}/${uuid}`, {
          competencyId,
          content: data.content,
        }),
      ),
      switchMap((guide) =>
        this.withModule(guide, (module) =>
          this.aVista(
            guide,
            [module],
            this.auth.user()
              ? {
                  id: this.auth.user()!.id,
                  name: this.auth.user()!.nombre,
                }
              : null,
          ),
        ),
      ),
      catchError(falla()),
    );
  }

  publicar(id: number): Observable<GuideView> {
    return this.uuid(id).pipe(
      switchMap((uuid) => this.http.patch<GuideResponse>(`${this.base}/${uuid}/publish`, {})),
      switchMap((guide) =>
        this.withModule(guide, (module) =>
          this.aVista(
            guide,
            [module],
            this.auth.user()
              ? {
                  id: this.auth.user()!.id,
                  name: this.auth.user()!.nombre,
                }
              : null,
          ),
        ),
      ),
      catchError(falla()),
    );
  }

  private uuid(id: number): Observable<string> {
    const known = this.guideUuids.get(id);
    if (known) return of(known);
    const buscarEnPagina = (page: number): Observable<string> =>
      this.http
        .get<GuidePageResponse>(this.base, {
          params: { page: String(page), pageSize: '100' },
        })
        .pipe(
          switchMap((result) => {
            const guide = result.items.find((candidate) => numeroDe(candidate.id) === id);
            if (guide) {
              this.guideUuids.set(id, guide.id);
              return of(guide.id);
            }
            if (page * result.pageSize >= result.total) {
              return throwError(() => new ApiError('NOT_FOUND'));
            }
            return buscarEnPagina(page + 1);
          }),
        );
    return buscarEnPagina(1);
  }

  private withModule<T>(guide: GuideResponse, build: (module: ModuleView) => T): Observable<T> {
    const moduleId = this.ids.registrar(guide.moduleId);
    return this.moduleApi.obtener(moduleId).pipe(map(build));
  }

  private aVista(
    response: GuideResponse,
    modulos: ModuleView[],
    actor: { id: number; name: string } | null = null,
  ): GuideView {
    const id = numeroDe(response.id);
    this.guideUuids.set(id, response.id);
    const moduleId = this.ids.registrar(response.moduleId);
    const competencyId = response.competencyId ? this.ids.registrar(response.competencyId) : null;
    const module: AcademicModule | undefined = modulos.find((item) => item.id === moduleId);
    const competencyParts = (response.competencyName ?? '').split(' · ');
    const persona = (value?: { id: string; name: string } | null) =>
      value ? { id: numeroDe(value.id), name: value.name } : null;
    const fallback = actor ? { id: actor.id, name: actor.name } : null;
    const guide: Guide = {
      id,
      code: response.code,
      moduleId,
      competencyId,
      title: response.title,
      status: ESTADOS[response.status],
      content: response.content,
      fields: response.fields,
      structureVersion: response.structureVersion,
      version: response.version,
      createdAt: response.createdAt,
      createdBy: persona(response.createdBy) ?? fallback,
      updatedAt: response.updatedAt,
      updatedBy: persona(response.updatedBy) ?? fallback,
      publishedAt: response.publishedAt ?? null,
      publishedBy: persona(response.publishedBy) ??
        (response.status === 'published' ? fallback : null),
    };
    return {
      ...guide,
      moduleName: response.moduleName,
      moduleCode: module?.code ?? '',
      competencyPrefix: module?.competencyPrefix ?? '',
      competencyCode: competencyParts[0] || null,
      competencyText: competencyParts.length > 1 ? competencyParts.slice(1).join(' · ') : null,
      competencyDeleted: response.competencyDeleted,
    };
  }
}
