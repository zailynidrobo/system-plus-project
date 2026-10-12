import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { personaActual, vistaCompetencia } from '../../core/mock/vistas';
import { ApiError } from '../../shared/models/api-error';
import { Competency, CompetencyRevision, CompetencyView } from '../../shared/models/competency';
import { cleanText, formatCompetencyCode, normalizeForComparison } from '../../shared/utils/curricular';
import { ahoraIso } from '../../shared/utils/fechas';

export interface ResultadoEdicion {
  competencia: CompetencyView;
  textoAnterior: string;
}

export interface ResultadoEliminacion {
  competencia: CompetencyView;
  restantes: number;
}

export interface GuiaReferencia {
  id: number;
  code: string;
  title: string;
}

/**
 * Competencias de un módulo (HE-02). Imita POST/GET /modules/:moduleId/competencies,
 * GET /modules/:moduleId/competencies/next-code, PATCH/DELETE /competencies/:id
 * y GET /competencies/:id/history del backend.
 */
@Injectable({ providedIn: 'root' })
export class CompetencyApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  /** Competencias activas del módulo (las eliminadas no se listan). */
  listar(moduleId: number): Observable<CompetencyView[]> {
    return simular(this.ms, () =>
      this.db.competencias
        .filter((c) => c.moduleId === moduleId && !c.deletedAt)
        .sort((a, b) => a.sequence - b.sequence)
        .map((c) => vistaCompetencia(this.db, c)),
    );
  }

  /** Vista previa del próximo código. Cuenta también las eliminadas: un código nunca se reutiliza. */
  siguienteCodigo(moduleId: number): Observable<string> {
    return simular(this.ms, () => this.codigoSiguiente(moduleId).code);
  }

  /** Incluye competencias eliminadas: las guías publicadas siguen resolviéndolas. */
  obtener(id: number): Observable<CompetencyView> {
    return simular(this.ms, () => vistaCompetencia(this.db, this.buscar(id)));
  }

  historial(id: number): Observable<CompetencyRevision[]> {
    return simular(this.ms, () =>
      this.db.revisiones.filter((r) => r.competencyId === id).sort((a, b) => b.version - a.version),
    );
  }

  /** Guías publicadas que referencian la competencia (se conservan al eliminarla). */
  guiasPublicadas(id: number): Observable<GuiaReferencia[]> {
    return simular(this.ms, () =>
      this.db.guias
        .filter((g) => g.competencyId === id && g.status === 'Publicada')
        .map((g) => ({ id: g.id, code: g.code, title: g.title })),
    );
  }

  /** Asocia una competencia nueva. Un módulo puede tener varias a la vez. */
  crear(moduleId: number, text: string): Observable<CompetencyView> {
    return simular(this.ms, () => {
      const modulo = this.db.modulos.find((m) => m.id === moduleId);
      if (!modulo) throw new ApiError('NOT_FOUND');
      if (modulo.status !== 'active') throw new ApiError('MODULE_NOT_ACTIVE');
      const limpio = this.validarTexto(moduleId, text);

      const { sequence, code } = this.codigoSiguiente(moduleId);
      const ahora = ahoraIso();
      const autor = personaActual(this.auth);
      const nueva: Competency = {
        id: Math.max(0, ...this.db.competencias.map((c) => c.id)) + 1,
        moduleId,
        code,
        sequence,
        text: limpio,
        version: 1,
        createdBy: autor,
        createdAt: ahora,
        updatedBy: autor,
        updatedAt: ahora,
        deletedBy: null,
        deletedAt: null,
      };
      this.db.competencias = [...this.db.competencias, nueva];
      this.registrarRevision(nueva);
      return vistaCompetencia(this.db, nueva);
    });
  }

  /** Cambia solo el texto: sube la versión y no toca las demás competencias. */
  actualizar(id: number, text: string): Observable<ResultadoEdicion> {
    return simular(this.ms, () => {
      const actual = this.buscar(id);
      if (actual.deletedAt) throw new ApiError('COMPETENCY_DELETED');
      const limpio = this.validarTexto(actual.moduleId, text, id);
      if (limpio === actual.text) throw new ApiError('NO_CHANGES');

      const actualizada: Competency = {
        ...actual,
        text: limpio,
        version: actual.version + 1,
        updatedBy: personaActual(this.auth),
        updatedAt: ahoraIso(),
      };
      this.reemplazar(actualizada);
      this.registrarRevision(actualizada);
      return { competencia: vistaCompetencia(this.db, actualizada), textoAnterior: actual.text };
    });
  }

  /** Borrado lógico: la retira del módulo sin afectar las guías publicadas que la referencian. */
  eliminar(id: number): Observable<ResultadoEliminacion> {
    return simular(this.ms, () => {
      const actual = this.buscar(id);
      if (actual.deletedAt) throw new ApiError('COMPETENCY_DELETED');
      const eliminada: Competency = { ...actual, deletedBy: personaActual(this.auth), deletedAt: ahoraIso() };
      this.reemplazar(eliminada);
      const restantes = this.db.competencias.filter((c) => c.moduleId === actual.moduleId && !c.deletedAt).length;
      return { competencia: vistaCompetencia(this.db, eliminada), restantes };
    });
  }

  private buscar(id: number): Competency {
    const c = this.db.competencias.find((x) => x.id === id);
    if (!c) throw new ApiError('NOT_FOUND');
    return c;
  }

  private codigoSiguiente(moduleId: number): { sequence: number; code: string } {
    const modulo = this.db.modulos.find((m) => m.id === moduleId);
    if (!modulo) throw new ApiError('NOT_FOUND');
    const usadas = this.db.competencias.filter((c) => c.moduleId === moduleId).map((c) => c.sequence);
    const sequence = Math.max(0, ...usadas) + 1;
    return { sequence, code: formatCompetencyCode(modulo.competencyPrefix, sequence) };
  }

  private validarTexto(moduleId: number, text: string, excluirId?: number): string {
    const limpio = cleanText(text);
    if (!limpio) throw new ApiError('TEXT_REQUIRED');
    const clave = normalizeForComparison(limpio);
    const repetida = this.db.competencias.find(
      (c) => c.moduleId === moduleId && c.id !== excluirId && !c.deletedAt && normalizeForComparison(c.text) === clave,
    );
    if (repetida) throw new ApiError('COMPETENCY_DUPLICATED', { code: repetida.code });
    return limpio;
  }

  private reemplazar(c: Competency): void {
    this.db.competencias = this.db.competencias.map((x) => (x.id === c.id ? c : x));
  }

  private registrarRevision(c: Competency): void {
    this.db.revisiones = [
      ...this.db.revisiones,
      { competencyId: c.id, version: c.version, text: c.text, editedBy: c.updatedBy, editedAt: c.updatedAt },
    ];
  }
}
