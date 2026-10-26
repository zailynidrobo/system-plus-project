import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { NotificacionMock } from '../../core/mock/seed-suggestions';
import { personaActual, vistaGuia, vistaSugerencia } from '../../core/mock/vistas';
import { ApiError } from '../../shared/models/api-error';
import { Guide, GuideView } from '../../shared/models/guide';
import { GuideValue } from '../../shared/models/guide-field';
import {
  EstadoPlazo,
  JUSTIFICACION_MIN,
  MOTIVOS_RECHAZO,
  RETROALIMENTACION_MAX,
  RETROALIMENTACION_MIN,
  Suggestion,
  SuggestionStatus,
  SuggestionView,
} from '../../shared/models/suggestion';
import { ROLES_DOCENTES, Role } from '../../shared/models/user';
import {
  fechaMinimaRequerida,
  formatSuggestionCode,
  plazosDeRespuesta,
  siguienteVersion,
} from '../../shared/utils/sugerencias';
import { RELOJ } from './reloj';

export interface NuevaSugerencia {
  guideId: number;
  fieldKey: string;
  proposedValue: GuideValue;
  justification: string;
  /** AAAA-MM-DD: al menos 14 días después de hoy (en Bogotá). */
  neededBy: string;
}

export interface FiltroSugerencias {
  estado: SuggestionStatus | 'TODAS';
  moduleId: number | null;
  guideId: number | null;
  orden: 'antiguas' | 'recientes';
  /** Solo pendientes con ese estado de plazo. */
  plazo?: EstadoPlazo | null;
}

export interface ResumenSugerencias {
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  porVencer: number;
  vencidas: number;
}

/** Datos que acompañan la revisión: cuántos docentes verán la nueva versión. */
export interface RevisionSugerencia {
  sugerencia: SuggestionView;
  /** Valor vigente del campo en la guía (puede diferir del que vio el docente). */
  valorVigente: GuideValue;
  docentesDelModulo: number;
  versionesDocentes: number;
}

/** Resultado de aprobar: la sugerencia, la guía actualizada y a cuántos docentes se avisó. */
export interface Aprobacion {
  sugerencia: SuggestionView;
  guia: GuideView;
  /** Docentes del módulo (además del autor) que recibieron "Nueva versión disponible". */
  notificados: number;
}

export interface Rechazo {
  motivo: string;
  retroalimentacion: string;
}

const texto = (v: GuideValue | undefined) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Sugerencias de cambio sobre guías base (HE-05), con datos simulados. Con apiAcademico = 'http'
 * se usa HttpSuggestionApi, que tiene la misma API pública y habla con /academic/suggestions.
 */
@Injectable({ providedIn: 'root' })
export class SuggestionApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);
  private ahora = inject(RELOJ);

  /** Cuenta las decisiones tomadas en la sesión: el menú y la campana la usan para refrescarse. */
  readonly decisiones = signal(0);
  private avisar = () => this.decisiones.update((n) => n + 1);

  // ---------- Docente (HU-01) ----------

  enviar(n: NuevaSugerencia): Observable<SuggestionView> {
    return simular(this.ms, () => {
      const docente = this.exigirRol(ROLES_DOCENTES);
      const guia = this.guiaDelDocente(n.guideId, docente.id);
      const campo = guia.fields.find((f) => f.key === n.fieldKey);
      if (!campo) throw new ApiError('FIELD_NOT_FOUND');

      const propuesto = texto(n.proposedValue);
      const justificacion = n.justification.trim();
      if (!propuesto && campo.required) throw new ApiError('PROPOSAL_REQUIRED');
      if (propuesto === texto(guia.content[campo.key])) throw new ApiError('NO_CHANGES');
      if (campo.type === 'select' && propuesto && !campo.options?.includes(propuesto)) throw new ApiError('INVALID_OPTION');
      if (campo.maxLength && propuesto.length > campo.maxLength) throw new ApiError('VALUE_TOO_LONG');
      if (!justificacion) throw new ApiError('JUSTIFICATION_REQUIRED');
      if (justificacion.length < JUSTIFICACION_MIN) throw new ApiError('JUSTIFICATION_TOO_SHORT');
      const ahora = this.ahora();
      const requerida = (n.neededBy ?? '').trim();
      if (!requerida) throw new ApiError('NEEDED_BY_REQUIRED');
      if (requerida < fechaMinimaRequerida(ahora)) throw new ApiError('NOTICE_TOO_SHORT');
      const repetida = this.db.sugerencias.some(
        (s) => s.teacherId === docente.id && s.guideId === guia.id && s.fieldKey === campo.key && s.status === 'Pendiente',
      );
      if (repetida) throw new ApiError('SUGGESTION_ALREADY_PENDING');

      const enviadaEl = ahora.toISOString();
      const numero = Math.max(0, ...this.db.sugerencias.map((s) => Number(s.code.slice(4)))) + 1;
      const sugerencia: Suggestion = {
        id: Math.max(0, ...this.db.sugerencias.map((s) => s.id)) + 1,
        code: formatSuggestionCode(numero),
        guideId: guia.id,
        fieldKey: campo.key,
        fieldLabel: campo.label,
        teacherId: docente.id,
        teacherName: docente.nombre,
        currentValue: structuredClone(guia.content[campo.key] ?? null),
        proposedValue: !propuesto ? null : campo.type === 'number' ? Number(propuesto) : propuesto,
        justification: justificacion,
        neededBy: requerida,
        baseVersion: guia.version,
        status: 'Pendiente',
        createdAt: enviadaEl,
        ...plazosDeRespuesta(enviadaEl),
        decidedAt: null,
        decidedBy: null,
        rejectReason: null,
        feedback: null,
        resultingVersion: null,
      };
      this.db.sugerencias.push(sugerencia);
      return this.vista(sugerencia);
    });
  }

  misSugerencias(): Observable<SuggestionView[]> {
    return simular(this.ms, () => {
      const docente = this.exigirRol(ROLES_DOCENTES);
      return this.db.sugerencias
        .filter((s) => s.teacherId === docente.id)
        .map((s) => this.vista(s))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  /** Solo el autor puede abrir su sugerencia desde "Mis sugerencias". */
  obtenerMia(id: number): Observable<SuggestionView> {
    return simular(this.ms, () => {
      const docente = this.exigirRol(ROLES_DOCENTES);
      const s = this.db.sugerencias.find((x) => x.id === id && x.teacherId === docente.id);
      if (!s) throw new ApiError('NOT_FOUND');
      return this.vista(s);
    });
  }

  // ---------- Coordinador (HU-02 a HU-04) ----------

  listar(f: FiltroSugerencias): Observable<SuggestionView[]> {
    return simular(this.ms, () => {
      this.exigirRol(['COORDINADOR']);
      const signo = f.orden === 'antiguas' ? 1 : -1;
      return this.db.sugerencias
        .map((s) => this.vista(s))
        .filter((s) => f.estado === 'TODAS' || s.status === f.estado)
        .filter((s) => f.moduleId === null || s.moduleId === f.moduleId)
        .filter((s) => f.guideId === null || s.guideId === f.guideId)
        .filter((s) => !f.plazo || s.deadlineStatus === f.plazo)
        .sort((a, b) => signo * a.createdAt.localeCompare(b.createdAt));
    });
  }

  resumen(): Observable<ResumenSugerencias> {
    return simular(this.ms, () => {
      this.exigirRol(['COORDINADOR']);
      const vistas = this.db.sugerencias.map((s) => this.vista(s));
      const contar = (estado: SuggestionStatus) => vistas.filter((s) => s.status === estado).length;
      return {
        pendientes: contar('Pendiente'),
        aprobadas: contar('Aprobada'),
        rechazadas: contar('Rechazada'),
        porVencer: vistas.filter((s) => s.deadlineStatus === 'due_soon').length,
        vencidas: vistas.filter((s) => s.deadlineStatus === 'overdue').length,
      };
    });
  }

  /** Guías con sugerencias, para el filtro "Guía: Todas". */
  guiasConSugerencias(): Observable<GuideView[]> {
    return simular(this.ms, () => {
      this.exigirRol(['COORDINADOR']);
      const ids = new Set(this.db.sugerencias.map((s) => s.guideId));
      return this.db.guias.filter((g) => ids.has(g.id)).map((g) => vistaGuia(this.db, g)).sort((a, b) => a.code.localeCompare(b.code));
    });
  }

  obtener(id: number): Observable<RevisionSugerencia> {
    return simular(this.ms, () => {
      this.exigirRol(['COORDINADOR']);
      const s = this.buscar(id);
      const guia = this.db.guias.find((g) => g.id === s.guideId)!;
      return {
        sugerencia: this.vista(s),
        valorVigente: guia.content[s.fieldKey] ?? null,
        docentesDelModulo: this.db.asignaciones.filter((a) => a.moduleId === guia.moduleId).length,
        versionesDocentes: this.db.versiones.filter((v) => v.guideId === guia.id).length,
      };
    });
  }

  /**
   * Aplica el cambio en la guía base: nuevo contenido del campo, versión menor siguiente y evento en
   * el historial. Avisa al autor y a los demás docentes del módulo. Las versiones personalizadas
   * no se tocan. Una sugerencia vencida se puede aprobar igual.
   */
  aprobar(id: number): Observable<Aprobacion> {
    return simular(this.ms, () => {
      this.exigirRol(['COORDINADOR']);
      const s = this.buscar(id);
      if (s.status !== 'Pendiente') throw new ApiError('SUGGESTION_ALREADY_DECIDED');
      const guia = this.db.guias.find((g) => g.id === s.guideId);
      if (!guia || guia.status !== 'Publicada') throw new ApiError('GUIDE_NOT_PUBLISHED');
      // Si el campo cambió desde que se envió (otra sugerencia aprobada), aplicar esta borraría ese cambio
      if (texto(guia.content[s.fieldKey]) !== texto(s.currentValue)) throw new ApiError('GUIDE_CHANGED');

      const ahora = this.ahora().toISOString();
      const quien = personaActual(this.auth);
      guia.content[s.fieldKey] = structuredClone(s.proposedValue);
      guia.version = siguienteVersion(guia.version);
      guia.updatedAt = ahora;
      guia.updatedBy = quien;

      s.status = 'Aprobada';
      s.decidedAt = ahora;
      s.decidedBy = quien;
      s.resultingVersion = guia.version;
      this.db.eventosGuias.push({
        guideId: guia.id,
        titulo: `Sugerencia ${s.code} aprobada · ${s.fieldLabel} (${guia.version})`,
        autor: quien?.name ?? '',
        fecha: ahora,
      });

      const otros = [
        ...new Set(this.db.asignaciones.filter((a) => a.moduleId === guia.moduleId).map((a) => a.teacherId)),
      ].filter((teacherId) => teacherId !== s.teacherId);
      this.notificar(s, 'SUGGESTION_APPROVED', s.teacherId, `Sugerencia ${s.code} aprobada`, `Tu cambio en «${s.fieldLabel}» quedó en ${guia.code} ${guia.version}.`, ahora);
      for (const docente of otros) {
        this.notificar(
          s,
          'GUIDE_NEW_VERSION',
          docente,
          `Nueva versión ${guia.version} de ${guia.code} disponible`,
          `Coordinación actualizó «${s.fieldLabel}» con una sugerencia aprobada. Tu versión personalizada no cambió.`,
          ahora,
        );
      }
      return { sugerencia: this.vista(s), guia: vistaGuia(this.db, guia), notificados: otros.length };
    }).pipe(tap(this.avisar));
  }

  /** Rechaza con motivo y retroalimentación. La guía base no cambia; el docente recibe el aviso. */
  rechazar(id: number, r: Rechazo): Observable<SuggestionView> {
    return simular(this.ms, () => {
      this.exigirRol(['COORDINADOR']);
      const s = this.buscar(id);
      if (s.status !== 'Pendiente') throw new ApiError('SUGGESTION_ALREADY_DECIDED');
      if (!(MOTIVOS_RECHAZO as readonly string[]).includes(r.motivo)) throw new ApiError('REASON_REQUIRED');
      const feedback = r.retroalimentacion.trim();
      if (feedback.length < RETROALIMENTACION_MIN) throw new ApiError('FEEDBACK_TOO_SHORT');
      if (feedback.length > RETROALIMENTACION_MAX) throw new ApiError('FEEDBACK_TOO_LONG');

      const ahora = this.ahora().toISOString();
      s.status = 'Rechazada';
      s.decidedAt = ahora;
      s.decidedBy = personaActual(this.auth);
      s.rejectReason = r.motivo;
      s.feedback = feedback;
      this.notificar(
        s,
        'SUGGESTION_REJECTED',
        s.teacherId,
        `Sugerencia ${s.code} rechazada`,
        `Motivo: ${r.motivo}. Revisa la retroalimentación en Mis sugerencias.`,
        ahora,
      );
      return this.vista(s);
    }).pipe(tap(this.avisar));
  }

  // ---------- Reglas comunes ----------

  private vista(s: Suggestion): SuggestionView {
    return vistaSugerencia(this.db, s, this.ahora());
  }

  private notificar(
    s: Suggestion,
    type: NotificacionMock['type'],
    recipientId: number,
    title: string,
    message: string,
    createdAt: string,
  ): void {
    this.db.notificaciones.push({
      id: `n-${this.db.notificaciones.length + 1}-${s.id}-${recipientId}`,
      recipientId,
      type,
      title,
      message,
      guideId: s.guideId,
      suggestionId: s.id,
      createdAt,
      readAt: null,
    });
  }

  private exigirRol(roles: Role[]) {
    const u = this.auth.user();
    if (!u) throw new ApiError('UNAUTHORIZED');
    if (!roles.includes(u.rol)) throw new ApiError('FORBIDDEN');
    return u;
  }

  private guiaDelDocente(guideId: number, docenteId: number): Guide {
    const guia = this.db.guias.find((g) => g.id === guideId && g.status === 'Publicada');
    if (!guia) throw new ApiError('NOT_FOUND');
    const asignado = this.db.asignaciones.some((a) => a.teacherId === docenteId && a.moduleId === guia.moduleId);
    if (!asignado) throw new ApiError('GUIDE_NOT_ASSIGNED');
    return guia;
  }

  private buscar(id: number): Suggestion {
    const s = this.db.sugerencias.find((x) => x.id === id);
    if (!s) throw new ApiError('NOT_FOUND');
    return s;
  }
}
