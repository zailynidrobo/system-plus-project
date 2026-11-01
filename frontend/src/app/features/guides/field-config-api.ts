import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { EstructuraVigente, estructuraVigente } from '../../core/mock/estructuras';
import { ApiError } from '../../shared/models/api-error';
import { FieldConfig, GuideContent, GuideField } from '../../shared/models/guide-field';
import { cleanText } from '../../shared/utils/curricular';
import { ahoraIso } from '../../shared/utils/fechas';

export type { EstructuraVigente, OrigenEstructura } from '../../core/mock/estructuras';

export interface CambioEstructura {
  tipo: 'agregado' | 'modificado' | 'eliminado' | 'orden';
  descripcion: string;
}

export interface ImpactoEstructura {
  cambios: CambioEstructura[];
  publicadas: number;
  borradores: number;
  versionesDocentes: number;
  versionActual: number;
  versionNueva: number;
}

/**
 * Estructura del formulario de guías (HE-03-HU-04). Imita
 * PUT /academic/modules/:moduleId/guide-fields y
 * PUT /academic/modules/:moduleId/competencies/:competencyId/guide-fields del backend.
 */
@Injectable({ providedIn: 'root' })
export class FieldConfigApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  /** La de la competencia si existe; si no, la del módulo; si no, la institucional por defecto. */
  obtener(moduleId: number, competencyId: number | null = null): Observable<EstructuraVigente> {
    return simular(this.ms, () => this.vigente(moduleId, competencyId));
  }

  /** Qué cambia y a cuántas guías afecta, para el aviso de impacto antes de guardar. */
  impacto(moduleId: number, competencyId: number | null, fields: GuideField[]): Observable<ImpactoEstructura> {
    return simular(this.ms, () => {
      const actual = this.vigente(moduleId, competencyId).config;
      const guias = this.guiasAlcanzadas(moduleId, competencyId);
      const ids = new Set(guias.map((g) => g.id));
      return {
        cambios: diferencias(actual.fields, fields),
        publicadas: guias.filter((g) => g.status === 'Publicada').length,
        borradores: guias.filter((g) => g.status === 'Borrador').length,
        versionesDocentes: this.db.versiones.filter((v) => ids.has(v.guideId)).length,
        versionActual: actual.version,
        versionNueva: actual.version + 1,
      };
    });
  }

  /**
   * Guarda una nueva versión de la estructura. Aplica a las guías nuevas y a los borradores;
   * las guías publicadas conservan su copia de la estructura anterior.
   */
  guardar(moduleId: number, competencyId: number | null, fields: GuideField[]): Observable<FieldConfig> {
    return simular(this.ms, () => {
      const limpios = validar(fields);
      const actual = this.vigente(moduleId, competencyId).config;
      const nueva: FieldConfig = {
        moduleId,
        competencyId,
        fields: limpios,
        version: actual.version + 1,
        updatedAt: ahoraIso(),
        updatedBy: this.auth.user()?.nombre ?? 'Sistema',
      };
      this.db.estructuras = [
        ...this.db.estructuras.filter((e) => !(e.moduleId === moduleId && e.competencyId === competencyId)),
        nueva,
      ];
      // Los borradores adoptan la nueva estructura y conservan los valores de los campos que siguen
      const borradores = new Set(
        this.guiasAlcanzadas(moduleId, competencyId).filter((g) => g.status === 'Borrador').map((g) => g.id),
      );
      this.db.guias = this.db.guias.map((g) =>
        borradores.has(g.id)
          ? { ...g, fields: structuredClone(limpios), structureVersion: nueva.version, content: adaptarContenido(g.content, limpios) }
          : g,
      );
      return nueva;
    });
  }

  private vigente(moduleId: number, competencyId: number | null): EstructuraVigente {
    return estructuraVigente(this.db, moduleId, competencyId);
  }

  /** Guías que usan esta estructura: las de la competencia, o las del módulo sin estructura propia. */
  private guiasAlcanzadas(moduleId: number, competencyId: number | null) {
    const conPropia = new Set(
      this.db.estructuras.filter((e) => e.moduleId === moduleId && e.competencyId !== null).map((e) => e.competencyId),
    );
    return this.db.guias.filter((g) =>
      g.moduleId === moduleId && (competencyId ? g.competencyId === competencyId : !conPropia.has(g.competencyId)),
    );
  }
}

/** Claves únicas a partir de la etiqueta: "Objetivos de aprendizaje" -> objetivos_de_aprendizaje. */
export function claveDesdeEtiqueta(label: string, usadas: Iterable<string>): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'campo';
  const tomadas = new Set(usadas);
  if (!tomadas.has(base)) return base;
  for (let i = 2; ; i++) if (!tomadas.has(`${base}_${i}`)) return `${base}_${i}`;
}

function validar(fields: GuideField[]): GuideField[] {
  if (fields.length === 0) throw new ApiError('FIELDS_REQUIRED');
  const keys = new Set<string>();
  return fields.map((f) => {
    const label = cleanText(f.label);
    if (!label) throw new ApiError('FIELD_LABEL_REQUIRED');
    if (keys.has(f.key)) throw new ApiError('FIELD_KEY_DUPLICATED', { key: f.key });
    keys.add(f.key);
    const options = f.type === 'select' ? (f.options ?? []).map(cleanText).filter(Boolean) : undefined;
    if (f.type === 'select' && (options?.length ?? 0) < 2) throw new ApiError('SELECT_OPTIONS_REQUIRED', { label });
    return { ...f, label, options };
  });
}

function adaptarContenido(content: GuideContent, fields: GuideField[]): GuideContent {
  return Object.fromEntries(fields.map((f) => [f.key, content[f.key] ?? null]));
}

/** Cambios entre dos estructuras, como los muestra el aviso de impacto. */
export function diferencias(antes: GuideField[], despues: GuideField[]): CambioEstructura[] {
  const cambios: CambioEstructura[] = [];
  const previos = new Map(antes.map((f) => [f.key, f]));
  const nuevos = new Map(despues.map((f) => [f.key, f]));

  for (const f of despues) {
    const p = previos.get(f.key);
    if (!p) {
      cambios.push({ tipo: 'agregado', descripcion: `${f.label} · ${f.required ? 'Obligatorio' : 'Opcional'}` });
      continue;
    }
    const detalle: string[] = [];
    if (p.label !== f.label) detalle.push(`nombre “${p.label}” -> “${f.label}”`);
    if (p.type !== f.type) detalle.push('tipo de dato');
    if (p.required !== f.required) detalle.push(f.required ? 'ahora obligatorio' : 'ahora opcional');
    if ((p.maxLength ?? 0) !== (f.maxLength ?? 0)) detalle.push(`límite ${p.maxLength ?? 'sin límite'} -> ${f.maxLength ?? 'sin límite'} caracteres`);
    if (JSON.stringify(p.options ?? []) !== JSON.stringify(f.options ?? [])) detalle.push('opciones de la lista');
    if (detalle.length) cambios.push({ tipo: 'modificado', descripcion: `${f.label} · ${detalle.join(' · ')}` });
  }
  for (const p of antes) {
    if (!nuevos.has(p.key)) cambios.push({ tipo: 'eliminado', descripcion: p.label });
  }
  const ordenAntes = antes.filter((f) => nuevos.has(f.key)).map((f) => f.key).join();
  const ordenDespues = despues.filter((f) => previos.has(f.key)).map((f) => f.key).join();
  if (ordenAntes !== ordenDespues) cambios.push({ tipo: 'orden', descripcion: 'Orden de los campos' });
  return cambios;
}
