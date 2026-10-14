import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicModule, ModuleStatus, ModuleView } from '../../shared/models/academic-module';
import { ApiError } from '../../shared/models/api-error';
import { cleanText } from '../../shared/utils/curricular';
import { AcademicIds, aPersona, numeroDe } from './academic-ids';
import { falla } from './http-errores';
import {
  DatosModulo,
  DisponibilidadNombre,
  FiltroModulos,
  ModuleApi,
  ResumenModulos,
} from './module-api';

interface PersonaApi {
  id: string;
  name: string | null;
}

/** Módulo tal como lo devuelve el backend (listado: sin `audit`; detalle: con `audit`). */
interface ModuloApi {
  id: string;
  programId: string;
  code: string;
  sequence: number;
  competencyPrefix: string;
  name: string;
  description: string | null;
  status: ModuleStatus;
  competenciesCount: number;
  guidesCount: number;
  publishedGuidesCount: number;
  availableForGuides: boolean;
  createdAt: string;
  updatedAt: string;
  audit?: {
    createdBy: PersonaApi | null;
    updatedBy: PersonaApi | null;
    inactivatedBy: PersonaApi | null;
    inactivatedAt: string | null;
    inactivationReason: string | null;
  };
}

interface ResumenProgramaApi {
  modules: { total: number; active: number; inactive: number; draft: number };
  guides: { total: number; published: number };
}

/** Misma API pública que el mock (ModuleApi), pero contra el backend real (HE-02). */
type ContratoModuleApi = Pick<ModuleApi, keyof ModuleApi>;

@Injectable()
export class HttpModuleApi implements ContratoModuleApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private base = environment.apiUrl;

  listar(f: FiltroModulos): Observable<ModuleView[]> {
    return this.ids.programaId().pipe(
      switchMap((programa) => {
        const params: Record<string, string> = {
          sort: f.orden === 'codigo' ? 'code' : 'name',
          order: 'asc',
        };
        if (f.busqueda.trim()) params['search'] = f.busqueda.trim();
        if (f.estado !== 'TODOS') params['status'] = f.estado;
        return this.http.get<ModuloApi[]>(`${this.base}/programs/${programa}/modules`, { params });
      }),
      map((filas) => filas.map((m) => this.aVista(m))),
      catchError(falla()),
    );
  }

  resumen(): Observable<ResumenModulos> {
    return this.ids.programaId().pipe(
      switchMap((programa) =>
        forkJoin({
          resumen: this.http.get<ResumenProgramaApi>(`${this.base}/programs/${programa}`),
          disponibles: this.http.get<ModuloApi[]>(`${this.base}/programs/${programa}/modules`, {
            params: { availableForGuides: 'true' },
          }),
        }),
      ),
      map(({ resumen, disponibles }) => ({
        total: resumen.modules.total,
        porEstado: {
          draft: resumen.modules.draft,
          active: resumen.modules.active,
          inactive: resumen.modules.inactive,
        },
        disponiblesParaGuias: disponibles.length,
        guiasPublicadas: resumen.guides.published,
      })),
      catchError(falla()),
    );
  }

  obtener(id: number): Observable<ModuleView> {
    return this.ids.modulo(id).pipe(
      switchMap((uuid) => this.http.get<ModuloApi>(`${this.base}/modules/${uuid}`)),
      map((m) => this.aVista(m)),
      catchError(falla()),
    );
  }

  /** Validación en vivo: "Nombre disponible" o el módulo con el que choca. */
  disponibilidadNombre(name: string, excluirId?: number): Observable<DisponibilidadNombre> {
    // Al editar se excluye el propio módulo; al crear no hay nada que excluir.
    const excluir$: Observable<string | undefined> =
      excluirId === undefined ? of(undefined) : this.ids.modulo(excluirId);
    return this.ids.programaId().pipe(
      switchMap((programa) =>
        excluir$.pipe(
          switchMap((excluir) => {
            const params: Record<string, string> = { name };
            if (excluir) params['excludeModuleId'] = excluir;
            return this.http.get<{ available: boolean; existingModule: ModuloApi | null }>(
              `${this.base}/programs/${programa}/modules/name-availability`,
              { params },
            );
          }),
        ),
      ),
      map((r) => ({
        disponible: r.available,
        existente: r.existingModule ? this.aVista(r.existingModule) : null,
      })),
      catchError(falla()),
    );
  }

  /** Módulos donde se pueden crear guías nuevas: activos y con al menos una competencia. */
  disponiblesParaGuias(): Observable<ModuleView[]> {
    return this.ids.programaId().pipe(
      switchMap((programa) =>
        this.http.get<ModuloApi[]>(`${this.base}/programs/${programa}/modules`, {
          params: { availableForGuides: 'true' },
        }),
      ),
      map((filas) => filas.map((m) => this.aVista(m))),
      catchError(falla()),
    );
  }

  /** Registra el módulo activo o lo guarda como borrador (el borrador no admite competencias). */
  crear(d: DatosModulo, comoBorrador = false): Observable<ModuleView> {
    const name = cleanText(d.name);
    const description = cleanText(d.description);
    if (!name) return throwError(() => new ApiError('NAME_REQUIRED'));
    if (!comoBorrador && !description)
      return throwError(() => new ApiError('DESCRIPTION_REQUIRED'));

    const body: Record<string, unknown> = { name };
    if (description) body['description'] = description;
    if (comoBorrador) body['draft'] = true;
    return this.ids.programaId().pipe(
      switchMap((programa) =>
        this.http.post<ModuloApi>(`${this.base}/programs/${programa}/modules`, body),
      ),
      map((m) => this.aVista(m)),
      catchError(falla((m: ModuloApi) => this.aVista(m))),
    );
  }

  /** Edita nombre y descripción. El código y la sigla no cambian. */
  actualizar(id: number, d: DatosModulo): Observable<ModuleView> {
    const name = cleanText(d.name);
    const description = cleanText(d.description);
    if (!name) return throwError(() => new ApiError('NAME_REQUIRED'));

    const guardar = () =>
      this.ids.modulo(id).pipe(
        switchMap((uuid) =>
          this.http.patch<ModuloApi>(
            `${this.base}/modules/${uuid}`,
            description ? { name, description } : { name },
          ),
        ),
        map((m) => this.aVista(m)),
      );
    // Solo un borrador puede quedarse sin descripción.
    const validado = description
      ? guardar()
      : this.obtener(id).pipe(
          switchMap((actual) =>
            actual.status === 'draft'
              ? guardar()
              : throwError(() => new ApiError('DESCRIPTION_REQUIRED')),
          ),
        );
    return validado.pipe(catchError(falla((m: ModuloApi) => this.aVista(m))));
  }

  /** Borrador → activo. */
  registrar(id: number): Observable<ModuleView> {
    return this.cambiarEstado(id, 'register', {});
  }

  /** Activo → inhabilitado. Conserva competencias y guías; deja de admitir guías nuevas. */
  inhabilitar(id: number, motivo?: string): Observable<ModuleView> {
    const reason = motivo?.trim();
    return this.cambiarEstado(id, 'deactivate', reason ? { reason } : {});
  }

  /** Inhabilitado → activo. */
  rehabilitar(id: number): Observable<ModuleView> {
    return this.cambiarEstado(id, 'reactivate', {});
  }

  private cambiarEstado(id: number, accion: string, body: object): Observable<ModuleView> {
    return this.ids.modulo(id).pipe(
      switchMap((uuid) =>
        this.http.patch<ModuloApi>(`${this.base}/modules/${uuid}/${accion}`, body),
      ),
      map((m) => this.aVista(m)),
      catchError(falla()),
    );
  }

  /** Módulo del backend → módulo del front. El listado no trae auditoría: esos campos quedan en null. */
  private aVista(m: ModuloApi): ModuleView {
    const base: AcademicModule = {
      id: this.ids.registrar(m.id),
      programId: numeroDe(m.programId),
      code: m.code,
      sequence: m.sequence,
      name: m.name,
      description: m.description,
      status: m.status,
      competencyPrefix: m.competencyPrefix,
      createdBy: aPersona(m.audit?.createdBy),
      createdAt: m.createdAt,
      updatedBy: aPersona(m.audit?.updatedBy),
      updatedAt: m.updatedAt,
      inactivatedBy: aPersona(m.audit?.inactivatedBy),
      inactivatedAt: m.audit?.inactivatedAt ?? null,
      inactivationReason: m.audit?.inactivationReason ?? null,
    };
    return {
      ...base,
      competenciesCount: m.competenciesCount,
      guidesCount: m.guidesCount,
      publishedGuidesCount: m.publishedGuidesCount,
      availableForGuides: m.availableForGuides,
    };
  }
}
