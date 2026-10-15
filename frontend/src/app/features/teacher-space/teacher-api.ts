import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { vistaGuia, vistaVersion } from '../../core/mock/vistas';
import { AcademicModule } from '../../shared/models/academic-module';
import { ApiError } from '../../shared/models/api-error';
import { Guide, GuideView } from '../../shared/models/guide';
import { GuideValue } from '../../shared/models/guide-field';
import { AislamientoVersion, TeacherVersion, TeacherVersionView } from '../../shared/models/teacher-version';
import { normalizeForComparison } from '../../shared/utils/curricular';
import { ahoraIso } from '../../shared/utils/fechas';

/** Búsqueda sin tildes ni mayúsculas ("validacion" encuentra "Validación"). */
const paraBuscar = (t: string) => normalizeForComparison(t).normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface FiltroGuiasDocente {
  busqueda: string;
  moduleId: number | null;
}

/** Guía base publicada de un módulo asignado, con las versiones propias del docente. */
export interface GuiaAsignada extends GuideView {
  misVersiones: { id: number; name: string }[];
}

export interface GuiasAsignadas {
  guias: GuiaAsignada[];
  /** Guías publicadas de módulos no asignados: no se muestran, solo se cuentan. */
  ocultas: { total: number; modulos: string[] };
}

/**
 * Espacio del docente (HE-04): todo se filtra por los módulos asignados a quien tiene la sesión.
 * Imita GET /academic/guides (vista docente), POST /academic/guides/:guideId/personalized-versions,
 * GET /academic/personalized-versions y GET/PATCH /academic/personalized-versions/:id.
 */
@Injectable({ providedIn: 'root' })
export class TeacherApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  misModulos(): Observable<AcademicModule[]> {
    return simular(this.ms, () => {
      const ids = this.idsAsignados();
      return this.db.modulos.filter((m) => ids.has(m.id));
    });
  }

  // ---------- HU-01 · Consultar guías base ----------

  guiasAsignadas(f: FiltroGuiasDocente): Observable<GuiasAsignadas> {
    return simular(this.ms, () => {
      const ids = this.idsAsignados();
      const q = paraBuscar(f.busqueda);
      const publicadas = this.db.guias.filter((g) => g.status === 'Publicada');
      const guias = publicadas
        .filter((g) => ids.has(g.moduleId))
        .filter((g) => f.moduleId === null || g.moduleId === f.moduleId)
        .map((g) => this.vistaAsignada(g))
        .filter((g) => !q || [g.title, g.code, g.moduleName].some((t) => paraBuscar(t).includes(q)))
        .sort((a, b) => a.moduleId - b.moduleId || a.code.localeCompare(b.code));
      const otras = publicadas.filter((g) => !ids.has(g.moduleId));
      const modulos = [...new Set(otras.map((g) => this.db.modulos.find((m) => m.id === g.moduleId)?.name ?? ''))];
      return { guias, ocultas: { total: otras.length, modulos } };
    });
  }

  /** Solo guías publicadas de módulos asignados: los borradores no existen para el docente. */
  obtenerGuia(id: number): Observable<GuiaAsignada> {
    return simular(this.ms, () => this.vistaAsignada(this.guiaVisible(id)));
  }

  // ---------- HU-02 · Crear versión personalizada ----------

  /**
   * Copia física de la guía base en el espacio del docente. structuredClone garantiza que la
   * versión no comparte ninguna referencia con la guía ni con las versiones de otros docentes.
   */
  crearVersion(guideId: number, nombre: string): Observable<TeacherVersionView> {
    return simular(this.ms, () => {
      const guia = this.guiaVisible(guideId);
      const docenteId = this.docenteId();
      const name = nombre.trim().replace(/\s+/g, ' ');
      if (!name) throw new ApiError('NAME_REQUIRED');
      const repetida = this.db.versiones.some(
        (v) => v.teacherId === docenteId && normalizeForComparison(v.name) === normalizeForComparison(name),
      );
      if (repetida) throw new ApiError('VERSION_NAME_DUPLICATED');

      const ahora = ahoraIso();
      const version: TeacherVersion = {
        id: Math.max(0, ...this.db.versiones.map((v) => v.id)) + 1,
        guideId: guia.id,
        teacherId: docenteId,
        name,
        content: structuredClone(guia.content),
        fields: structuredClone(guia.fields),
        baseContent: structuredClone(guia.content),
        baseVersion: guia.version,
        structureVersion: guia.structureVersion,
        fieldUpdatedAt: {},
        lastField: null,
        createdAt: ahora,
        updatedAt: ahora,
      };
      this.db.versiones.push(version);
      return vistaVersion(this.db, version);
    });
  }

  misVersiones(): Observable<TeacherVersionView[]> {
    return simular(this.ms, () => {
      const docenteId = this.docenteId();
      return this.db.versiones
        .filter((v) => v.teacherId === docenteId)
        .map((v) => vistaVersion(this.db, v))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  /** Solo el dueño puede abrir su versión; para cualquier otro docente "no existe". */
  obtenerVersion(id: number): Observable<TeacherVersionView> {
    return simular(this.ms, () => vistaVersion(this.db, this.versionPropia(id)));
  }

  /** Tarjeta "Versiones de otros docentes": cuántas hay en el módulo y que ninguna cambió. */
  aislamiento(id: number): Observable<AislamientoVersion> {
    return simular(this.ms, () => {
      const propia = vistaVersion(this.db, this.versionPropia(id));
      const otras = this.db.versiones
        .filter((v) => v.teacherId !== propia.teacherId)
        .filter((v) => this.db.guias.find((g) => g.id === v.guideId)?.moduleId === propia.moduleId);
      const docentes = [...new Set(otras.map((v) => this.db.usuarios.find((u) => u.id === v.teacherId)?.nombre ?? ''))];
      return { otrasVersiones: otras.length, docentes, moduleName: propia.moduleName };
    });
  }

  // ---------- HU-03 · Editar versión personalizada ----------

  /** Guarda un campo de la versión. Nunca toca la guía base ni otras versiones. */
  guardarCampo(id: number, key: string, valor: GuideValue): Observable<TeacherVersionView> {
    return simular(this.ms, () => {
      const version = this.versionPropia(id);
      const campo = version.fields.find((f) => f.key === key);
      if (!campo) throw new ApiError('FIELD_NOT_FOUND');
      if (campo.teacherEditable === false) throw new ApiError('FIELD_NOT_EDITABLE');

      const texto = valor === null || valor === undefined ? '' : String(valor).trim();
      if (campo.required && !texto) throw new ApiError('FIELD_REQUIRED');
      if (campo.maxLength && texto.length > campo.maxLength) throw new ApiError('VALUE_TOO_LONG');
      if (campo.type === 'select' && texto && !campo.options?.includes(texto)) throw new ApiError('INVALID_OPTION');
      const nuevo: GuideValue = !texto ? null : campo.type === 'number' ? Number(texto) : texto;

      if (version.content[key] !== nuevo) {
        const ahora = ahoraIso();
        version.content[key] = nuevo;
        version.fieldUpdatedAt[key] = ahora;
        version.lastField = key;
        version.updatedAt = ahora;
      }
      return vistaVersion(this.db, version);
    });
  }

  // ---------- Reglas comunes ----------

  private docenteId(): number {
    const id = this.auth.user()?.id;
    if (!id) throw new ApiError('UNAUTHORIZED');
    return id;
  }

  private idsAsignados(): Set<number> {
    const docenteId = this.auth.user()?.id;
    return new Set(
      this.db.asignaciones.filter((a) => a.teacherId === docenteId).map((a) => a.moduleId),
    );
  }

  private guiaVisible(id: number): Guide {
    const guia = this.db.guias.find((g) => g.id === id && g.status === 'Publicada');
    if (!guia) throw new ApiError('NOT_FOUND');
    if (!this.idsAsignados().has(guia.moduleId)) throw new ApiError('GUIDE_NOT_ASSIGNED');
    return guia;
  }

  private versionPropia(id: number): TeacherVersion {
    const version = this.db.versiones.find((v) => v.id === id && v.teacherId === this.docenteId());
    if (!version) throw new ApiError('NOT_FOUND');
    return version;
  }

  private vistaAsignada(g: Guide): GuiaAsignada {
    const docenteId = this.auth.user()?.id;
    return {
      ...vistaGuia(this.db, g),
      misVersiones: this.db.versiones
        .filter((v) => v.guideId === g.id && v.teacherId === docenteId)
        .map((v) => ({ id: v.id, name: v.name })),
    };
  }
}
