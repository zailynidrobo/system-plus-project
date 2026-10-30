import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error';
import { GuideView } from '../../shared/models/guide';
import { GuideValue } from '../../shared/models/guide-field';
import { EstadoPlazo, SuggestionStatus, SuggestionView } from '../../shared/models/suggestion';
import { AcademicIds, numeroDe } from '../academic-program/academic-ids';
import { falla } from '../academic-program/http-errores';
import { GuideApi } from '../guides/guide-api';
import {
  Aprobacion,
  FiltroSugerencias,
  NuevaSugerencia,
  Rechazo,
  ResumenSugerencias,
  RevisionSugerencia,
} from './suggestion-api';

/** Sugerencia como la devuelve gestion-guias (src/suggestions/suggestion-views.service.ts). */
export interface SuggestionResponse {
  id: string;
  code: string;
  guideId: string;
  moduleId: string;
  fieldKey: string;
  fieldLabel: string;
  teacherId: string;
  teacherName: string;
  currentValue: GuideValue;
  proposedValue: GuideValue;
  justification: string;
  neededBy: string | null;
  baseVersion: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  dueSoonAt: string;
  dueAt: string;
  decidedAt: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  rejectReason: string | null;
  feedback: string | null;
  resultingVersion: string | null;
  deadlineStatus: EstadoPlazo | null;
  businessDaysLeft: number | null;
  businessDaysOverdue: number | null;
  guideCode: string;
  guideTitle: string;
  guideVersion: string;
  moduleName: string;
  competencyPrefix: string;
  summary: string;
}

interface ReviewResponse extends SuggestionResponse {
  review: { currentGuideValue: GuideValue; moduleTeachers: number; teacherVersions: number };
}

interface SummaryResponse {
  pending: number;
  approved: number;
  rejected: number;
  dueSoon: number;
  overdue: number;
}

interface GuideOptionResponse {
  id: string;
  code: string;
  title: string;
  version: string;
  status: 'draft' | 'published';
  moduleId: string;
  moduleName: string;
}

interface ApprovalResponse {
  suggestion: SuggestionResponse;
  guide: { id: string };
  notifications: { author: number; newVersion: number };
}

export const ESTADOS_SUGERENCIA: Record<SuggestionResponse['status'], SuggestionStatus> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const ESTADOS_API: Record<SuggestionStatus | 'TODAS', string> = {
  Pendiente: 'pending',
  Aprobada: 'approved',
  Rechazada: 'rejected',
  TODAS: 'all',
};

/**
 * Sugerencias de cambio (HE-05) contra el backend real. Misma API pública que SuggestionApi (el mock):
 *   POST /academic/guides/:guideId/suggestions · GET /academic/suggestions/mine[/:id]
 *   GET /academic/suggestions[/summary|/guides|/:id] · PATCH /academic/suggestions/:id/approve|reject
 *
 * El front usa ids numéricos (derivados del UUID con AcademicIds); aquí se guarda la equivalencia
 * de las sugerencias y, si se recarga la página, se reconstruye consultando el listado.
 */
@Injectable()
export class HttpSuggestionApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private guideApi = inject(GuideApi);
  private base = `${environment.apiUrl}/academic`;

  private uuids = new Map<number, string>();

  /** Cuenta las decisiones tomadas en la sesión: el menú y la campana la usan para refrescarse. */
  readonly decisiones = signal(0);
  private avisar = () => this.decisiones.update((n) => n + 1);

  // ---------- Docente (HU-01) ----------

  enviar(n: NuevaSugerencia): Observable<SuggestionView> {
    const texto = n.proposedValue === null || n.proposedValue === undefined ? '' : String(n.proposedValue).trim();
    return this.ids.guia(n.guideId).pipe(
      switchMap((guia) =>
        this.http.post<SuggestionResponse>(`${this.base}/guides/${guia}/suggestions`, {
          fieldKey: n.fieldKey,
          // El backend convierte a número los campos numéricos y valida contra la estructura.
          proposedValue: texto || null,
          justification: n.justification,
          neededBy: n.neededBy,
        }),
      ),
      map((s) => this.aVista(s)),
      catchError(falla()),
    );
  }

  misSugerencias(): Observable<SuggestionView[]> {
    return this.http.get<SuggestionResponse[]>(`${this.base}/suggestions/mine`).pipe(
      map((lista) => lista.map((s) => this.aVista(s))),
      catchError(falla()),
    );
  }

  obtenerMia(id: number): Observable<SuggestionView> {
    return this.uuid(id, `${this.base}/suggestions/mine`).pipe(
      switchMap((uuid) => this.http.get<SuggestionResponse>(`${this.base}/suggestions/mine/${uuid}`)),
      map((s) => this.aVista(s)),
      catchError(falla()),
    );
  }

  // ---------- Coordinador (HU-02 a HU-04) ----------

  listar(f: FiltroSugerencias): Observable<SuggestionView[]> {
    return forkJoin({
      moduleId: f.moduleId === null ? of(null) : this.ids.modulo(f.moduleId),
      guideId: f.guideId === null ? of(null) : this.ids.guia(f.guideId),
    }).pipe(
      switchMap(({ moduleId, guideId }) => {
        const params: Record<string, string> = {
          status: ESTADOS_API[f.estado],
          order: f.orden === 'antiguas' ? 'asc' : 'desc',
        };
        if (moduleId) params['moduleId'] = moduleId;
        if (guideId) params['guideId'] = guideId;
        if (f.plazo) params['deadline'] = f.plazo;
        return this.http.get<SuggestionResponse[]>(`${this.base}/suggestions`, { params });
      }),
      map((lista) => lista.map((s) => this.aVista(s))),
      catchError(falla()),
    );
  }

  resumen(): Observable<ResumenSugerencias> {
    return this.http.get<SummaryResponse>(`${this.base}/suggestions/summary`).pipe(
      map((r) => ({
        pendientes: r.pending,
        aprobadas: r.approved,
        rechazadas: r.rejected,
        porVencer: r.dueSoon,
        vencidas: r.overdue,
      })),
      catchError(falla()),
    );
  }

  /** Guías con sugerencias, para el filtro "Guía: Todas" (solo trae lo que usa el filtro). */
  guiasConSugerencias(): Observable<GuideView[]> {
    return this.http.get<GuideOptionResponse[]>(`${this.base}/suggestions/guides`).pipe(
      map((guias) => guias.map((g) => this.aOpcionDeGuia(g))),
      catchError(falla()),
    );
  }

  obtener(id: number): Observable<RevisionSugerencia> {
    return this.uuid(id, `${this.base}/suggestions`, { status: 'all' }).pipe(
      switchMap((uuid) => this.http.get<ReviewResponse>(`${this.base}/suggestions/${uuid}`)),
      map((r) => ({
        sugerencia: this.aVista(r),
        valorVigente: r.review.currentGuideValue,
        docentesDelModulo: r.review.moduleTeachers,
        versionesDocentes: r.review.teacherVersions,
      })),
      catchError(falla()),
    );
  }

  /** Aprueba y devuelve la guía actualizada completa (se consulta con GuideApi para tener su vista). */
  aprobar(id: number): Observable<Aprobacion> {
    return this.uuid(id, `${this.base}/suggestions`, { status: 'all' }).pipe(
      switchMap((uuid) => this.http.patch<ApprovalResponse>(`${this.base}/suggestions/${uuid}/approve`, {})),
      switchMap((r) =>
        this.guideApi.obtener(this.ids.registrar(r.guide.id)).pipe(
          map((guia) => ({ sugerencia: this.aVista(r.suggestion), guia, notificados: r.notifications.newVersion })),
        ),
      ),
      tap(this.avisar),
      catchError(falla()),
    );
  }

  rechazar(id: number, r: Rechazo): Observable<SuggestionView> {
    return this.uuid(id, `${this.base}/suggestions`, { status: 'all' }).pipe(
      switchMap((uuid) =>
        this.http.patch<SuggestionResponse>(`${this.base}/suggestions/${uuid}/reject`, {
          reason: r.motivo,
          feedback: r.retroalimentacion,
        }),
      ),
      map((s) => this.aVista(s)),
      tap(this.avisar),
      catchError(falla()),
    );
  }

  // ---------- Internos ----------

  /** Registra el UUID de una sugerencia (p. ej. al llegar desde la campana) y devuelve su número. */
  registrar(uuid: string): number {
    const id = numeroDe(uuid);
    this.uuids.set(id, uuid);
    return id;
  }

  /** UUID de una sugerencia; si no se conoce (recarga directa), se busca en el listado indicado. */
  private uuid(id: number, listado: string, params: Record<string, string> = {}): Observable<string> {
    const conocido = this.uuids.get(id);
    if (conocido) return of(conocido);
    return this.http.get<SuggestionResponse[]>(listado, { params }).pipe(
      switchMap((lista) => {
        lista.forEach((s) => this.registrar(s.id));
        const uuid = this.uuids.get(id);
        return uuid ? of(uuid) : throwError(() => new ApiError('NOT_FOUND'));
      }),
    );
  }

  private aVista(s: SuggestionResponse): SuggestionView {
    return {
      id: this.registrar(s.id),
      code: s.code,
      guideId: this.ids.registrar(s.guideId),
      fieldKey: s.fieldKey,
      fieldLabel: s.fieldLabel,
      teacherId: numeroDe(s.teacherId),
      teacherName: s.teacherName,
      currentValue: s.currentValue,
      proposedValue: s.proposedValue,
      justification: s.justification,
      neededBy: s.neededBy,
      baseVersion: s.baseVersion,
      status: ESTADOS_SUGERENCIA[s.status],
      createdAt: s.createdAt,
      dueSoonAt: s.dueSoonAt,
      dueAt: s.dueAt,
      decidedAt: s.decidedAt,
      decidedBy: s.decidedById ? { id: numeroDe(s.decidedById), name: s.decidedByName ?? '' } : null,
      rejectReason: s.rejectReason,
      feedback: s.feedback,
      resultingVersion: s.resultingVersion,
      guideCode: s.guideCode,
      guideTitle: s.guideTitle,
      guideVersion: s.guideVersion,
      moduleId: this.ids.registrar(s.moduleId),
      moduleName: s.moduleName,
      competencyPrefix: s.competencyPrefix,
      summary: s.summary,
      deadlineStatus: s.deadlineStatus,
      businessDaysLeft: s.businessDaysLeft,
      businessDaysOverdue: s.businessDaysOverdue,
    };
  }

  private aOpcionDeGuia(g: GuideOptionResponse): GuideView {
    return {
      id: this.ids.registrar(g.id),
      code: g.code,
      moduleId: this.ids.registrar(g.moduleId),
      competencyId: null,
      title: g.title,
      status: g.status === 'published' ? 'Publicada' : 'Borrador',
      content: {},
      fields: [],
      structureVersion: 0,
      version: g.version,
      createdAt: '',
      createdBy: null,
      updatedAt: '',
      updatedBy: null,
      publishedAt: null,
      publishedBy: null,
      moduleName: g.moduleName,
      moduleCode: '',
      competencyPrefix: '',
      competencyCode: null,
      competencyText: null,
      competencyDeleted: false,
    };
  }
}
