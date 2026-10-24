import { GuideValue } from '../models/guide-field';

const texto = (v: GuideValue | undefined) => (v === null || v === undefined ? '' : String(v).trim());

const recortar = (t: string, max = 70) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}...` : t);

/** 14 -> "SUG-014" */
export function formatSuggestionCode(n: number): string {
  return `SUG-${String(n).padStart(3, '0')}`;
}

/** Al aprobar una sugerencia la guía sube una versión menor: v1.0 -> v1.1, v2.1 -> v2.2. */
export function siguienteVersion(version: string): string {
  const m = /^v(\d+)\.(\d+)$/.exec(version);
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : 'v1.1';
}

/** Suma días hábiles (lunes a viernes) a una fecha ISO. */
export function sumarDiasHabiles(iso: string, dias: number): string {
  const d = new Date(iso);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) restantes--;
  }
  return d.toISOString();
}

/**
 * Resumen corto del cambio para las tablas: si el docente agregó texto al final, muestra lo agregado;
 * si no, el valor nuevo.
 */
export function resumenCambio(actual: GuideValue, propuesto: GuideValue): string {
  const a = texto(actual);
  const p = texto(propuesto);
  if (a && p.startsWith(a) && p.length > a.length) return `Agrega «${recortar(p.slice(a.length).trim())}»`;
  if (!p) return 'Deja el campo vacío';
  return `Cambia a «${recortar(p)}»`;
}

/** Parte común inicial y texto nuevo, para resaltar lo agregado ("Ins" en Figma). */
export function partesDelCambio(actual: GuideValue, propuesto: GuideValue): { igual: string; nuevo: string } {
  const a = texto(actual);
  const p = texto(propuesto);
  if (a && p.startsWith(a)) return { igual: a, nuevo: p.slice(a.length) };
  return { igual: '', nuevo: p };
}

/** "Vence en 3 días", "Vence hoy" o "Venció hace 2 días". */
export function plazo(dueAt: string, ahora = new Date()): { texto: string; vencida: boolean } {
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((dia(new Date(dueAt)) - dia(ahora)) / 86_400_000);
  if (dias > 0) return { texto: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`, vencida: false };
  if (dias === 0) return { texto: 'Vence hoy', vencida: false };
  return { texto: `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}`, vencida: true };
}
