import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { personaActual, vistaModulo } from '../../core/mock/vistas';
import { AcademicModule, ModuleStatus, ModuleView } from '../../shared/models/academic-module';
import { ApiError } from '../../shared/models/api-error';
import {
  buildCompetencyPrefix,
  cleanText,
  ensureUniquePrefix,
  formatModuleCode,
  normalizeForComparison,
} from '../../shared/utils/curricular';
import { ahoraIso } from '../../shared/utils/fechas';

export interface FiltroModulos {
  busqueda: string;
  estado: ModuleStatus | 'TODOS';
  orden: 'nombre' | 'codigo';
}

export interface DatosModulo {
  name: string;
  description: string;
}

export interface ResumenModulos {
  total: number;
  porEstado: Record<ModuleStatus, number>;
  disponiblesParaGuias: number;
  guiasPublicadas: number;
}

export interface DisponibilidadNombre {
  disponible: boolean;
  existente: ModuleView | null;
}

/**
 * Módulos del programa (HE-02). Imita GET/POST /programs/:programId/modules,
 * PATCH /modules/:id, /register, /deactivate y /reactivate del backend.
 */
@Injectable({ providedIn: 'root' })
export class ModuleApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  listar(f: FiltroModulos): Observable<ModuleView[]> {
    return simular(this.ms, () => {
      const q = normalizeForComparison(f.busqueda);
      return this.db.modulos
        .filter((m) => f.estado === 'TODOS' || m.status === f.estado)
        .filter((m) => !q || normalizeForComparison(m.name).includes(q) || m.code.toLowerCase().includes(q))
        .sort((a, b) => (f.orden === 'codigo' ? a.sequence - b.sequence : a.name.localeCompare(b.name, 'es')))
        .map((m) => vistaModulo(this.db, m));
    });
  }

  resumen(): Observable<ResumenModulos> {
    return simular(this.ms, () => {
      const porEstado: Record<ModuleStatus, number> = { draft: 0, active: 0, inactive: 0 };
      for (const m of this.db.modulos) porEstado[m.status]++;
      return {
        total: this.db.modulos.length,
        porEstado,
        disponiblesParaGuias: this.db.modulos.filter((m) => vistaModulo(this.db, m).availableForGuides).length,
        guiasPublicadas: this.db.guias.filter((g) => g.status === 'Publicada').length,
      };
    });
  }

  obtener(id: number): Observable<ModuleView> {
    return simular(this.ms, () => vistaModulo(this.db, this.buscar(id)));
  }

  /** Validación en vivo: "Nombre disponible" o el módulo con el que choca. */
  disponibilidadNombre(name: string, excluirId?: number): Observable<DisponibilidadNombre> {
    return simular(this.ms, () => {
      const existente = this.duplicado(name, excluirId);
      return { disponible: !existente, existente: existente ? vistaModulo(this.db, existente) : null };
    });
  }

  /** Módulos donde se pueden crear guías nuevas: activos y con al menos una competencia. */
  disponiblesParaGuias(): Observable<ModuleView[]> {
    return simular(this.ms, () =>
      this.db.modulos.map((m) => vistaModulo(this.db, m)).filter((m) => m.availableForGuides),
    );
  }

  /** Registra el módulo activo o lo guarda como borrador (el borrador no admite competencias). */
  crear(d: DatosModulo, comoBorrador = false): Observable<ModuleView> {
    return simular(this.ms, () => {
      const name = this.validarNombre(d.name);
      const description = cleanText(d.description);
      if (!comoBorrador && !description) throw new ApiError('DESCRIPTION_REQUIRED');

      const sequence = Math.max(0, ...this.db.modulos.map((m) => m.sequence)) + 1;
      const prefix = ensureUniquePrefix(buildCompetencyPrefix(name), this.db.modulos.map((m) => m.competencyPrefix));
      const ahora = ahoraIso();
      const autor = personaActual(this.auth);
      const modulo: AcademicModule = {
        id: Math.max(0, ...this.db.modulos.map((m) => m.id)) + 1,
        programId: this.db.programa.id,
        code: formatModuleCode(this.db.programa.code, sequence),
        sequence,
        name,
        description: description || null,
        status: comoBorrador ? 'draft' : 'active',
        competencyPrefix: prefix,
        createdBy: autor,
        createdAt: ahora,
        updatedBy: autor,
        updatedAt: ahora,
        inactivatedBy: null,
        inactivatedAt: null,
        inactivationReason: null,
      };
      this.db.modulos = [...this.db.modulos, modulo];
      return vistaModulo(this.db, modulo);
    });
  }

  /** Edita nombre y descripción. El código y la sigla no cambian. */
  actualizar(id: number, d: DatosModulo): Observable<ModuleView> {
    return simular(this.ms, () => {
      const actual = this.buscar(id);
      const name = this.validarNombre(d.name, id);
      const description = cleanText(d.description);
      if (actual.status !== 'draft' && !description) throw new ApiError('DESCRIPTION_REQUIRED');
      return this.guardar(id, { name, description: description || null });
    });
  }

  /** Borrador -> activo. */
  registrar(id: number): Observable<ModuleView> {
    return simular(this.ms, () => {
      const m = this.buscar(id);
      if (m.status !== 'draft') throw new ApiError('INVALID_STATUS');
      if (!m.description) throw new ApiError('DESCRIPTION_REQUIRED');
      return this.guardar(id, { status: 'active' });
    });
  }

  /** Activo -> inhabilitado. Conserva competencias y guías; deja de admitir guías nuevas. */
  inhabilitar(id: number, motivo?: string): Observable<ModuleView> {
    return simular(this.ms, () => {
      if (this.buscar(id).status !== 'active') throw new ApiError('INVALID_STATUS');
      return this.guardar(id, {
        status: 'inactive',
        inactivatedBy: personaActual(this.auth),
        inactivatedAt: ahoraIso(),
        inactivationReason: motivo?.trim() || null,
      });
    });
  }

  /** Inhabilitado -> activo. */
  rehabilitar(id: number): Observable<ModuleView> {
    return simular(this.ms, () => {
      if (this.buscar(id).status !== 'inactive') throw new ApiError('INVALID_STATUS');
      return this.guardar(id, { status: 'active', inactivatedBy: null, inactivatedAt: null, inactivationReason: null });
    });
  }

  private buscar(id: number): AcademicModule {
    const m = this.db.modulos.find((x) => x.id === id);
    if (!m) throw new ApiError('NOT_FOUND');
    return m;
  }

  private duplicado(name: string, excluirId?: number): AcademicModule | undefined {
    const clave = normalizeForComparison(name);
    return this.db.modulos.find((m) => m.id !== excluirId && normalizeForComparison(m.name) === clave);
  }

  private validarNombre(name: string, excluirId?: number): string {
    const limpio = cleanText(name);
    if (!limpio) throw new ApiError('NAME_REQUIRED');
    const existente = this.duplicado(limpio, excluirId);
    if (existente) throw new ApiError('MODULE_NAME_DUPLICATED', vistaModulo(this.db, existente));
    return limpio;
  }

  private guardar(id: number, cambios: Partial<AcademicModule>): ModuleView {
    const actualizado: AcademicModule = {
      ...this.buscar(id),
      ...cambios,
      updatedBy: personaActual(this.auth),
      updatedAt: ahoraIso(),
    };
    this.db.modulos = this.db.modulos.map((m) => (m.id === id ? actualizado : m));
    return vistaModulo(this.db, actualizado);
  }
}
