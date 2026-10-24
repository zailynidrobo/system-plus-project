import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicModule } from '../../shared/models/academic-module';
import { ApiError } from '../../shared/models/api-error';
import { GuideView } from '../../shared/models/guide';
import { GuideContent, GuideField, GuideValue } from '../../shared/models/guide-field';
import { AislamientoVersion, TeacherVersionView } from '../../shared/models/teacher-version';
import { AcademicIds, numeroDe } from '../academic-program/academic-ids';
import { falla } from '../academic-program/http-errores';
import { ModuleApi } from '../academic-program/module-api';
import { GuideApi } from '../guides/guide-api';
import { FiltroGuiasDocente, GuiaAsignada, GuiasAsignadas } from './teacher-api';

interface VersionResponse {
  id: string;
  baseGuideId: string;
  moduleId: string;
  moduleName: string;
  teacherId: string;
  title: string;
  name: string;
  baseContent: Record<string, unknown>;
  baseFields: GuideField[];
  content: Record<string, unknown>;
  fields: GuideField[];
  createdAt: string;
  updatedAt: string;
}

interface AssignmentsResponse {
  moduleIds: string[];
  hidden: { total: number; modules: string[] };
}

interface IsolationResponse {
  moduleName: string;
  otherVersions: number;
  otherTeachers: number;
}

interface GuidePageResponse {
  items: { id: string }[];
  total: number;
  page: number;
  pageSize: number;
}

const comparable = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Espacio del docente (HE-04) contra el backend real. Misma API pública que TeacherApi (el mock):
 *   GET /academic/my-assignments · GET /academic/guides · POST /academic/guides/:id/personalized-versions
 *   GET /academic/personalized-versions[/:id[/isolation]] · PATCH /academic/personalized-versions/:id
 *
 * Qué no guarda el backend y cómo se resuelve aquí:
 *  · `baseVersion` y `structureVersion` salen de la guía base actual.
 *  · `fieldUpdatedAt` usa la fecha de la última actualización de la versión para los campos adaptados.
 *  · `lastField` queda en null (el backend no registra cuál fue el último campo).
 *  · `content` es la copia completa: lo que el docente no ha cambiado muestra el texto de la guía base.
 */
@Injectable()
export class HttpTeacherApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private guideApi = inject(GuideApi);
  private moduleApi = inject(ModuleApi);
  private base = `${environment.apiUrl}/academic`;

  private guideUuids = new Map<number, string>();
  private versionUuids = new Map<number, string>();
  private versions = new Map<number, VersionResponse>();

  // ---------- HU-01 · Consultar guías base ----------

  misModulos(): Observable<AcademicModule[]> {
    return forkJoin({
      asignaciones: this.asignaciones(),
      modulos: this.moduleApi.listar({ busqueda: '', estado: 'TODOS', orden: 'codigo' }),
    }).pipe(
      map(({ asignaciones, modulos }) => {
        const asignados = new Set(asignaciones.moduleIds.map((uuid) => this.ids.registrar(uuid)));
        return modulos.filter((m) => asignados.has(m.id));
      }),
      catchError(falla()),
    );
  }

  guiasAsignadas(f: FiltroGuiasDocente): Observable<GuiasAsignadas> {
    return forkJoin({
      asignaciones: this.asignaciones(),
      pagina: this.guideApi.listar({
        busqueda: f.busqueda,
        moduleId: f.moduleId,
        competencyId: null,
        estado: 'Publicada',
        pagina: 1,
        porPagina: 100,
      }),
      versiones: this.misVersiones(),
    }).pipe(
      map(({ asignaciones, pagina, versiones }) => ({
        guias: pagina.items
          .map((g) => this.aGuiaAsignada(g, versiones))
          .sort((a, b) => a.moduleId - b.moduleId || a.code.localeCompare(b.code)),
        ocultas: { total: asignaciones.hidden.total, modulos: asignaciones.hidden.modules },
      })),
      catchError(falla()),
    );
  }

  obtenerGuia(id: number): Observable<GuiaAsignada> {
    return forkJoin({ guia: this.guideApi.obtener(id), versiones: this.misVersiones() }).pipe(
      map(({ guia, versiones }) => this.aGuiaAsignada(guia, versiones)),
      catchError((e: unknown) => {
        // El backend responde 403 cuando el módulo de la guía no está asignado al docente.
        if (e instanceof ApiError && e.code === 'SIN_PERMISO') {
          return throwError(() => new ApiError('GUIDE_NOT_ASSIGNED'));
        }
        return throwError(() => e);
      }),
    );
  }

  // ---------- HU-02 · Crear versión personalizada ----------

  crearVersion(guideId: number, nombre: string): Observable<TeacherVersionView> {
    const name = nombre.trim().replace(/\s+/g, ' ');
    if (!name) return throwError(() => new ApiError('NAME_REQUIRED'));
    return this.uuidGuia(guideId).pipe(
      switchMap((uuid) =>
        this.http.post<VersionResponse>(`${this.base}/guides/${uuid}/personalized-versions`, { name }),
      ),
      switchMap((version) => this.unaVista(version)),
      catchError((e: unknown) => {
        if (e instanceof HttpErrorResponse) {
          const sinCodigo = !(e.error && typeof e.error === 'object' && 'code' in e.error);
          if (e.status === 403) return throwError(() => new ApiError('GUIDE_NOT_ASSIGNED'));
          // 409 sin código: la guía ya no está publicada.
          if (e.status === 409 && sinCodigo) return throwError(() => new ApiError('NOT_FOUND'));
        }
        return falla()(e);
      }),
    );
  }

  misVersiones(): Observable<TeacherVersionView[]> {
    return this.http.get<VersionResponse[]>(`${this.base}/personalized-versions`).pipe(
      switchMap((versiones) => this.vistas(versiones)),
      map((vistas) => vistas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
      catchError(falla()),
    );
  }

  /** Solo el dueño puede abrir su versión; para cualquier otro docente "no existe". */
  obtenerVersion(id: number): Observable<TeacherVersionView> {
    return this.uuidVersion(id).pipe(
      switchMap((uuid) => this.http.get<VersionResponse>(`${this.base}/personalized-versions/${uuid}`)),
      switchMap((version) => this.unaVista(version)),
      catchError(() => throwError(() => new ApiError('NOT_FOUND'))),
    );
  }

  /** Tarjeta "Versiones de otros docentes": cuántas hay en el módulo (el backend no expone su contenido). */
  aislamiento(id: number): Observable<AislamientoVersion> {
    return this.uuidVersion(id).pipe(
      switchMap((uuid) =>
        this.http.get<IsolationResponse>(`${this.base}/personalized-versions/${uuid}/isolation`),
      ),
      map((r) => ({
        otrasVersiones: r.otherVersions,
        docentes: [],
        cantidadDocentes: r.otherTeachers,
        moduleName: r.moduleName,
      })),
      catchError(falla()),
    );
  }

  // ---------- HU-03 · Editar versión personalizada ----------

  /** Guarda un campo de la versión. Nunca toca la guía base ni otras versiones. */
  guardarCampo(id: number, key: string, valor: GuideValue): Observable<TeacherVersionView> {
    return this.uuidVersion(id).pipe(
      switchMap((uuid) =>
        this.conocida(id, uuid).pipe(
          switchMap((version) => {
            const campo = version.fields.find((f) => f.key === key);
            if (!campo) return throwError(() => new ApiError('FIELD_NOT_FOUND'));
            if (campo.teacherEditable === false) return throwError(() => new ApiError('FIELD_NOT_EDITABLE'));

            const texto = valor === null || valor === undefined ? '' : String(valor).trim();
            if (campo.required && !texto) return throwError(() => new ApiError('FIELD_REQUIRED'));
            if (campo.maxLength && texto.length > campo.maxLength) {
              return throwError(() => new ApiError('VALUE_TOO_LONG'));
            }
            if (campo.type === 'select' && texto && !campo.options?.includes(texto)) {
              return throwError(() => new ApiError('INVALID_OPTION'));
            }
            const nuevo: GuideValue = !texto ? null : campo.type === 'number' ? Number(texto) : texto;
            return this.http.patch<VersionResponse>(`${this.base}/personalized-versions/${uuid}`, {
              content: { [key]: nuevo },
            });
          }),
        ),
      ),
      switchMap((version) => this.unaVista(version)),
      catchError(falla()),
    );
  }

  // ---------- Internos ----------

  private asignaciones(): Observable<AssignmentsResponse> {
    return this.http.get<AssignmentsResponse>(`${this.base}/my-assignments`);
  }

  private aGuiaAsignada(g: GuideView, versiones: TeacherVersionView[]): GuiaAsignada {
    return {
      ...g,
      misVersiones: versiones.filter((v) => v.guideId === g.id).map((v) => ({ id: v.id, name: v.name })),
    };
  }

  private recordar(v: VersionResponse): number {
    const id = numeroDe(v.id);
    this.versionUuids.set(id, v.id);
    this.versions.set(id, v);
    this.guideUuids.set(numeroDe(v.baseGuideId), v.baseGuideId);
    return id;
  }

  private uuidVersion(id: number): Observable<string> {
    const conocido = this.versionUuids.get(id);
    if (conocido) return of(conocido);
    return this.http.get<VersionResponse[]>(`${this.base}/personalized-versions`).pipe(
      map((versiones) => {
        versiones.forEach((v) => this.recordar(v));
        const uuid = this.versionUuids.get(id);
        if (!uuid) throw new ApiError('NOT_FOUND');
        return uuid;
      }),
    );
  }

  /** La versión tal como la devolvió el backend la última vez (trae los campos para validar). */
  private conocida(id: number, uuid: string): Observable<VersionResponse> {
    const guardada = this.versions.get(id);
    if (guardada) return of(guardada);
    return this.http.get<VersionResponse>(`${this.base}/personalized-versions/${uuid}`).pipe(
      map((v) => {
        this.recordar(v);
        return v;
      }),
    );
  }

  private uuidGuia(id: number): Observable<string> {
    const conocido = this.guideUuids.get(id);
    if (conocido) return of(conocido);
    const buscar = (page: number): Observable<string> =>
      this.http
        .get<GuidePageResponse>(`${this.base}/guides`, { params: { page: String(page), pageSize: '100' } })
        .pipe(
          switchMap((r) => {
            const guia = r.items.find((c) => numeroDe(c.id) === id);
            if (guia) {
              this.guideUuids.set(id, guia.id);
              return of(guia.id);
            }
            if (page * r.pageSize >= r.total) return throwError(() => new ApiError('NOT_FOUND'));
            return buscar(page + 1);
          }),
        );
    return buscar(1);
  }

  private unaVista(version: VersionResponse): Observable<TeacherVersionView> {
    return this.vistas([version]).pipe(map((vistas) => vistas[0]));
  }

  /** Une cada versión con los datos de su guía base (una consulta por guía distinta). */
  private vistas(versiones: VersionResponse[]): Observable<TeacherVersionView[]> {
    versiones.forEach((v) => this.recordar(v));
    if (!versiones.length) return of([]);
    const guiasIds = [...new Set(versiones.map((v) => numeroDe(v.baseGuideId)))];
    return forkJoin(
      guiasIds.map((guiaId) =>
        this.guideApi.obtener(guiaId).pipe(
          map((guia) => [guiaId, guia] as const),
          // Si la guía ya no se puede consultar (p. ej. módulo desasignado) la versión se muestra igual.
          catchError(() => of([guiaId, null] as const)),
        ),
      ),
    ).pipe(
      map((pares) => new Map(pares)),
      map((guias) => versiones.map((v) => this.aVista(v, guias.get(numeroDe(v.baseGuideId)) ?? null))),
    );
  }

  private aVista(v: VersionResponse, guia: GuideView | null): TeacherVersionView {
    const baseContent = v.baseContent as GuideContent;
    // El backend guarda solo lo que el docente cambió (`content`) junto a la guía base (`baseContent`).
    // Para la pantalla, la versión es una copia completa: lo no editado muestra el texto de la guía base.
    const content: GuideContent = {};
    for (const f of v.fields) {
      const propio = v.content[f.key] as GuideValue | undefined;
      content[f.key] = propio !== undefined ? propio : (baseContent[f.key] ?? null);
    }
    const adaptedKeys = v.fields
      .filter((f) => comparable(content[f.key]) !== comparable(baseContent[f.key]))
      .map((f) => f.key);
    return {
      id: numeroDe(v.id),
      guideId: numeroDe(v.baseGuideId),
      teacherId: numeroDe(v.teacherId),
      name: v.name,
      content,
      fields: v.fields,
      baseContent,
      baseVersion: guia?.version ?? '',
      structureVersion: guia?.structureVersion ?? 0,
      fieldUpdatedAt: Object.fromEntries(adaptedKeys.map((key) => [key, v.updatedAt])),
      lastField: null,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      guideCode: guia?.code ?? '',
      guideTitle: v.title,
      moduleId: this.ids.registrar(v.moduleId),
      moduleName: v.moduleName,
      competencyPrefix: guia?.competencyPrefix ?? '',
      guidePublishedBy: guia?.publishedBy?.name ?? null,
      guidePublishedAt: guia?.publishedAt ?? null,
      guideUpdatedAt: guia?.updatedAt ?? v.updatedAt,
      guideVersion: guia?.version ?? '',
      adaptedKeys,
      editableCount: v.fields.filter((f) => f.teacherEditable !== false).length,
    };
  }
}
