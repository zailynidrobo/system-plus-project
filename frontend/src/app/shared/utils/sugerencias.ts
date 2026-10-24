import { GuideValue } from '../models/guide-field';
import {
  ANTICIPACION_MINIMA_DIAS,
  PLAZO_AVISO_DIAS_HABILES,
  PLAZO_LIMITE_DIAS_HABILES,
  SuggestionStatus,
  SuggestionView,
} from '../models/suggestion';
import {
  FechaIso,
  diasHabilesEntre,
  fechaEnBogota,
  finDelDiaEnBogota,
  sumarDias,
  sumarDiasHabiles,
} from './dias-habiles';

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

/**
 * Plazos que se guardan al enviar: fin del día hábil 5 (por vencer) y del día hábil 8 (límite),
 * en Bogotá y sin contar festivos de Colombia.
 */
export function plazosDeRespuesta(enviadaEl: string): { dueSoonAt: string; dueAt: string } {
  const dia = fechaEnBogota(enviadaEl);
  return {
    dueSoonAt: finDelDiaEnBogota(sumarDiasHabiles(dia, PLAZO_AVISO_DIAS_HABILES)),
    dueAt: finDelDiaEnBogota(sumarDiasHabiles(dia, PLAZO_LIMITE_DIAS_HABILES)),
  };
}

/** Estado del plazo, como lo calcula el backend. Una vencida sigue pendiente: solo se marca. */
export function estadoDelPlazo(
  s: { status: SuggestionStatus; dueSoonAt: string; dueAt: string },
  ahora = new Date(),
): Pick<SuggestionView, 'deadlineStatus' | 'businessDaysLeft' | 'businessDaysOverdue'> {
  if (s.status !== 'Pendiente') return { deadlineStatus: null, businessDaysLeft: null, businessDaysOverdue: null };
  const hoy = fechaEnBogota(ahora);
  const limite = fechaEnBogota(s.dueAt);
  if (ahora.getTime() > new Date(s.dueAt).getTime()) {
    return { deadlineStatus: 'overdue', businessDaysLeft: 0, businessDaysOverdue: Math.max(1, diasHabilesEntre(limite, hoy)) };
  }
  return {
    deadlineStatus: ahora.getTime() > new Date(s.dueSoonAt).getTime() ? 'due_soon' : 'on_time',
    businessDaysLeft: diasHabilesEntre(hoy, limite),
    businessDaysOverdue: null,
  };
}

/** Primera fecha que el docente puede pedir: hoy en Bogotá + 14 días. */
export function fechaMinimaRequerida(ahora = new Date()): FechaIso {
  return sumarDias(fechaEnBogota(ahora), ANTICIPACION_MINIMA_DIAS);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-11-07" -> "07 nov 2026" (sin pasar por la zona horaria del navegador). */
export function fechaDeCalendario(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d} ${MESES[Number(m) - 1]} ${a}`;
}

const diasHabiles = (n: number) => `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;

/** Texto y tono del plazo de una pendiente: "Vence en N días hábiles", "Por vencer" o "Vencida · sigue pendiente". */
export function textoPlazo(
  s: Pick<SuggestionView, 'deadlineStatus' | 'businessDaysLeft'>,
): { texto: string; tono: 'ok' | 'aviso' | 'vencida' } | null {
  switch (s.deadlineStatus) {
    case 'on_time':
      return { texto: `Vence en ${diasHabiles(s.businessDaysLeft ?? 0)}`, tono: 'ok' };
    case 'due_soon':
      return { texto: s.businessDaysLeft ? `Por vencer · ${diasHabiles(s.businessDaysLeft)}` : 'Por vencer · hoy', tono: 'aviso' };
    case 'overdue':
      return { texto: 'Vencida · sigue pendiente', tono: 'vencida' };
    default:
      return null;
  }
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
