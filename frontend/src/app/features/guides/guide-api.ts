import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { estructuraVigente } from '../../core/mock/estructuras';
import { personaActual, vistaGuia, vistaModulo } from '../../core/mock/vistas';
import { ApiError } from '../../shared/models/api-error';
import { Guide, GuideEvent, GuideStatus, GuideView } from '../../shared/models/guide';
import { GuideContent, GuideField, camposFaltantes } from '../../shared/models/guide-field';
import { GuideVersionDetail, HistorialVersiones } from '../../shared/models/guide-version';
import { User } from '../../shared/models/user';
import { formatGuideCode, normalizeForComparison } from '../../shared/utils/curricular';
import { ahoraIso } from '../../shared/utils/fechas';
import { construirVersiones, resumirVersiones } from '../../shared/utils/versiones';

export interface FiltroGuias {
  busqueda: string;
  moduleId: number | null;
  competencyId: number | null;
  autor: string | null;
  estado: GuideStatus | 'TODOS';
  pagina: number;
  porPagina: number;
}

export interface PaginaGuias {
  items: GuideView[];
  total: number;
}

export interface ResumenGuias {
  total: number;
  modulos: number;
  publicadas: number;
  borradores: number;
}

export interface NuevaGuia {
  moduleId: number;
  competencyId: number;
  content: GuideContent;
}

/**
 * Guías base institucionales (HE-03). Imita POST/GET /academic/guides,
 * GET/PATCH /academic/guides/:id y PATCH /academic/guides/:id/publish del backend.
 */
@Injectable({ providedIn: 'root' })
export class GuideApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  listar(f: FiltroGuias): Observable<PaginaGuias> {
    return simular(this.ms, () => {
      const q = normalizeForComparison(f.busqueda);
      const filtradas = this.db.guias
        .map((g) => vistaGuia(this.db, g))
        .filter((g) => f.moduleId === null || g.moduleId === f.moduleId)
        .filter((g) => f.competencyId === null || g.competencyId === f.competencyId)
        .filter((g) => f.autor === null || g.createdBy?.name === f.autor)
        .filter((g) => f.estado === 'TODOS' || g.status === f.estado)
        .filter((g) => !q || [g.title, g.code, g.moduleName].some((t) => normalizeForComparison(t).includes(q)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const inicio = (f.pagina - 1) * f.porPagina;
      return { items: filtradas.slice(inicio, inicio + f.porPagina), total: filtradas.length };
    });
  }

  resumen(): Observable<ResumenGuias> {
    return simular(this.ms, () => ({
      total: this.db.guias.length,
      modulos: new Set(this.db.guias.map((g) => g.moduleId)).size,
      publicadas: this.db.guias.filter((g) => g.status === 'Publicada').length,
      borradores: this.db.guias.filter((g) => g.status === 'Borrador').length,
    }));
  }

  obtener(id: number): Observable<GuideView> {
    return simular(this.ms, () => vistaGuia(this.db, this.buscar(id)));
  }

  historial(id: number): Observable<GuideEvent[]> {
    return simular(this.ms, () =>
      this.db.eventosGuias.filter((e) => e.guideId === id).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    );
  }

  // he-07 lista de versiones
  versiones(id: number): Observable<HistorialVersiones> {
    return simular(this.ms, () => resumirVersiones(this.versionesDe(id)));
  }

  // he-07 una version con su contenido
  version(id: number, version: string): Observable<GuideVersionDetail> {
    return simular(this.ms, () => {
      const encontrada = this.versionesDe(id).find((v) => v.version === version);
      if (!encontrada) throw new ApiError('NOT_FOUND');
      return encontrada;
    });
  }

  /** Vista previa del código de la próxima guía del módulo: GB-POO-04. */
  siguienteCodigo(moduleId: number): Observable<string> {
    return simular(this.ms, () => this.codigoSiguiente(moduleId));
  }

  /** Docentes asignados al módulo: verán la guía cuando se publique. */
  docentesDelModulo(moduleId: number): Observable<User[]> {
    return simular(this.ms, () => {
      const ids = new Set(this.db.asignaciones.filter((a) => a.moduleId === moduleId).map((a) => a.teacherId));
      return this.db.usuarios.filter((u) => ids.has(u.id)).map(({ contrasena: _, ...u }) => u);
    });
  }

  /**
   * Crea la guía en Borrador con la estructura vigente del módulo (o de la competencia).
   * Solo sobre módulos disponibles para guías y con todos los campos obligatorios.
   */
  crear(d: NuevaGuia): Observable<GuideView> {
    return simular(this.ms, () => {
      const modulo = this.db.modulos.find((m) => m.id === d.moduleId);
      if (!modulo) throw new ApiError('NOT_FOUND');
      if (!vistaModulo(this.db, modulo).availableForGuides) throw new ApiError('MODULE_NOT_AVAILABLE');
      this.validarCompetencia(d.moduleId, d.competencyId);
      const { config } = estructuraVigente(this.db, d.moduleId, d.competencyId);
      const estructura = config.fields;
      this.validarObligatorios(estructura, d.content);

      const ahora = ahoraIso();
      const autor = personaActual(this.auth);
      const guia: Guide = {
        id: Math.max(0, ...this.db.guias.map((g) => g.id)) + 1,
        code: this.codigoSiguiente(d.moduleId),
        moduleId: d.moduleId,
        competencyId: d.competencyId,
        title: `Guía base · ${modulo.name}`,
        status: 'Borrador',
        content: limpiarContenido(estructura, d.content),
        fields: structuredClone(estructura),
        structureVersion: config.version,
        version: 'v0',
        createdAt: ahora,
        createdBy: autor,
        updatedAt: ahora,
        updatedBy: autor,
        publishedAt: null,
        publishedBy: null,
      };
      this.db.guias = [...this.db.guias, guia];
      this.registrar(guia.id, 'Guía creada como borrador');
      return vistaGuia(this.db, guia);
    });
  }

  /** Solo las guías en Borrador se editan; no afecta a ninguna guía publicada. */
  actualizar(id: number, d: { competencyId: number; content: GuideContent }): Observable<GuideView> {
    return simular(this.ms, () => {
      const actual = this.buscar(id);
      if (actual.status !== 'Borrador') throw new ApiError('GUIDE_NOT_EDITABLE');
      this.validarCompetencia(actual.moduleId, d.competencyId);
      this.validarObligatorios(actual.fields, d.content);

      const content = limpiarContenido(actual.fields, d.content);
      if (d.competencyId !== actual.competencyId) this.registrar(id, 'Competencia actualizada');
      for (const f of actual.fields) {
        if ((content[f.key] ?? null) !== (actual.content[f.key] ?? null)) this.registrar(id, `${f.label} editado`);
      }
      return this.guardar(id, { competencyId: d.competencyId, content });
    });
  }

  /** Borrador -> Publicada: queda visible para los docentes del módulo con fecha y autor. */
  publicar(id: number): Observable<GuideView> {
    return simular(this.ms, () => {
      const actual = this.buscar(id);
      if (actual.status !== 'Borrador') throw new ApiError('GUIDE_ALREADY_PUBLISHED');
      this.validarObligatorios(actual.fields, actual.content);
      const ahora = ahoraIso();
      this.registrar(id, 'Guía publicada');
      return this.guardar(id, { status: 'Publicada', version: 'v1.0', publishedAt: ahora, publishedBy: personaActual(this.auth) });
    });
  }

  private versionesDe(id: number): GuideVersionDetail[] {
    const guia = this.buscar(id);
    const eventos = this.db.eventosGuias.filter((e) => e.guideId === id);
    const aprobadas = this.db.sugerencias.filter((s) => s.guideId === id && s.status === 'Aprobada');
    return construirVersiones(guia, eventos, aprobadas);
  }

  private buscar(id: number): Guide {
    const g = this.db.guias.find((x) => x.id === id);
    if (!g) throw new ApiError('NOT_FOUND');
    return g;
  }

  private codigoSiguiente(moduleId: number): string {
    const modulo = this.db.modulos.find((m) => m.id === moduleId);
    if (!modulo) throw new ApiError('NOT_FOUND');
    const prefijo = `GB-${modulo.competencyPrefix}-`;
    const usados = this.db.guias.filter((g) => g.code.startsWith(prefijo)).map((g) => Number(g.code.slice(prefijo.length)));
    return formatGuideCode(modulo.competencyPrefix, Math.max(0, ...usados) + 1);
  }

  private validarCompetencia(moduleId: number, competencyId: number): void {
    const c = this.db.competencias.find((x) => x.id === competencyId);
    if (!c || c.moduleId !== moduleId || c.deletedAt) throw new ApiError('COMPETENCY_INVALID');
  }

  private validarObligatorios(fields: GuideField[], content: GuideContent): void {
    const faltan = camposFaltantes(fields, content);
    if (faltan.length) throw new ApiError('REQUIRED_FIELDS_MISSING', { campos: faltan.map((f) => f.label) });
  }

  private registrar(guideId: number, titulo: string): void {
    this.db.eventosGuias = [
      ...this.db.eventosGuias,
      { guideId, titulo, autor: this.auth.user()?.nombre ?? 'Sistema', fecha: ahoraIso() },
    ];
  }

  private guardar(id: number, cambios: Partial<Guide>): GuideView {
    const actualizada: Guide = { ...this.buscar(id), ...cambios, updatedAt: ahoraIso(), updatedBy: personaActual(this.auth) };
    this.db.guias = this.db.guias.map((g) => (g.id === id ? actualizada : g));
    return vistaGuia(this.db, actualizada);
  }
}

/** Solo guarda las claves de la estructura (no texto libre sin estructura). */
function limpiarContenido(fields: GuideField[], content: GuideContent): GuideContent {
  return Object.fromEntries(
    fields.map((f) => {
      const v = content[f.key];
      return [f.key, typeof v === 'string' ? v.trim() || null : (v ?? null)];
    }),
  );
}
