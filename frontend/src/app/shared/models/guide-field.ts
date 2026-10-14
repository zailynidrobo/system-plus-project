// Campo del formulario de guías. Mismo modelo que el backend:
// gestion-guias/src/academic/dto/guide-field.dto.ts

export type GuideFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

// Nombres de Figma (editor de campos). "Opción múltiple" y "Archivo" no existen en el backend.
export const FIELD_TYPE_LABELS: Record<GuideFieldType, string> = {
  text: 'Texto corto',
  textarea: 'Área de texto',
  number: 'Número',
  date: 'Fecha',
  select: 'Lista desplegable',
};

export const FIELD_TYPE_ICONS: Record<GuideFieldType, string> = {
  text: 'type',
  textarea: 'type',
  number: 'hash',
  date: 'calendar',
  select: 'list',
};

export interface GuideField {
  key: string;
  label: string;
  type: GuideFieldType;
  required: boolean;
  /** Solo para type = 'select'. */
  options?: string[];
  // Propiedades del editor de Figma (HE-03-HU-04). No existen en el DTO del backend:
  // el ValidationPipe con whitelist las descartaría hasta que el backend las agregue.
  /** Texto de ayuda para el docente. */
  help?: string;
  /** Límite de caracteres (text y textarea). */
  maxLength?: number;
  /** Si el docente puede cambiarlo en su versión adaptada (HE-04). Por defecto sí. */
  teacherEditable?: boolean;
}

/** Estructura del formulario de guías de un módulo (o de una competencia). */
export interface FieldConfig {
  moduleId: number;
  /** null = estructura de todo el módulo. */
  competencyId: number | null;
  fields: GuideField[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

/** Descripción corta del tipo para el editor: "Área de texto · máx. 500 caracteres". */
export function describirCampo(f: GuideField): string {
  const base = FIELD_TYPE_LABELS[f.type];
  if (f.type === 'select') return `${base} · ${f.options?.length ?? 0} opciones`;
  if (f.maxLength) return `${base} · máx. ${f.maxLength} caracteres`;
  return base;
}

export type GuideValue = string | number | null;

/** Valores de una guía, por key de campo. */
export type GuideContent = Record<string, GuideValue>;

/** Campos obligatorios sin valor. */
export function camposFaltantes(fields: GuideField[], content: GuideContent): GuideField[] {
  return fields.filter((f) => {
    if (!f.required) return false;
    const v = content[f.key];
    return v === null || v === undefined || String(v).trim() === '';
  });
}
