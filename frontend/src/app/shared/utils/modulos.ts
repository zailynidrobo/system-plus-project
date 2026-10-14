import { ModuleStatus } from '../models/academic-module';
import { fechaCorta } from './fechas';

// Íconos por módulo como en Figma (braces para POO, database para Bases de Datos, ...)
const ICONO_POR_SIGLA: Record<string, string> = {
  POO: 'braces',
  BD: 'database',
  FP: 'code',
  RC: 'network',
  ME: 'wrench',
  SIS: 'shield-check',
  SIST: 'shield-check',
};

export function iconoModulo(sigla: string): string {
  return ICONO_POR_SIGLA[sigla] ?? 'book-open';
}

/** Clase de la pill de estado (Activo verde, Borrador dorado, Inhabilitado rojo). */
export function pillEstadoModulo(status: ModuleStatus): string {
  return { active: 'ui-pill--ok', draft: 'ui-pill--warn', inactive: 'ui-pill--off' }[status];
}

/** "Hoy, 10:21" o "18 sep 2026". */
export function cuando(iso: string): string {
  const d = new Date(iso);
  if (d.toDateString() !== new Date().toDateString()) return fechaCorta(iso);
  return `Hoy, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
