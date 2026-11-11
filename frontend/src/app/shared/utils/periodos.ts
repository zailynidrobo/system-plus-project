import { GuideEditLock } from '../models/guide-edit-lock';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// bogota no tiene horario de verano, siempre es utc-5
const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function partes(iso: string) {
  const p = Object.fromEntries(formato.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { anio: +p['year'], mes: +p['month'], dia: +p['day'], hora: +p['hour'] % 24, minuto: +p['minute'] };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** "01 dic 2026" en hora de Bogotá. */
export function diaPeriodo(iso: string): string {
  const f = partes(iso);
  return `${dos(f.dia)} ${MESES[f.mes - 1]} ${f.anio}`;
}

/** "01 dic 2026 · 12:00 a. m." en hora de Bogotá. */
export function fechaHoraPeriodo(iso: string): string {
  const f = partes(iso);
  const sufijo = f.hora < 12 ? 'a. m.' : 'p. m.';
  return `${diaPeriodo(iso)} · ${f.hora % 12 || 12}:${dos(f.minuto)} ${sufijo}`;
}

/** "01 – 15 dic 2026", o con mes y año de cada lado si el periodo cruza de mes o de año. */
export function rangoPeriodo(inicio: string, fin: string): string {
  const a = partes(inicio);
  const b = partes(fin);
  if (a.anio === b.anio && a.mes === b.mes) return `${dos(a.dia)} – ${dos(b.dia)} ${MESES[b.mes - 1]} ${b.anio}`;
  if (a.anio === b.anio) return `${dos(a.dia)} ${MESES[a.mes - 1]} – ${dos(b.dia)} ${MESES[b.mes - 1]} ${b.anio}`;
  return `${diaPeriodo(inicio)} – ${diaPeriodo(fin)}`;
}

/** Día en que se vuelve a poder editar: el periodo termina en `fin` (ej. 15 dic 11:59 p. m. -> 16 dic). */
export function diaDeReapertura(fin: string): string {
  return diaPeriodo(new Date(Date.parse(fin) + 60_000).toISOString());
}

/** Lo que escribe el admin en un input datetime-local ("2026-12-01T00:00") es hora de Bogotá -> instante ISO. */
export function aIsoBogota(local: string): string {
  return new Date(`${local}:00-05:00`).toISOString();
}

/** Ahora mismo como "AAAA-MM-DDTHH:mm" de Bogotá, para el mínimo de los inputs. */
export function ahoraLocalBogota(ahora = Date.now()): string {
  const f = partes(new Date(ahora).toISOString());
  return `${f.anio}-${dos(f.mes)}-${dos(f.dia)}T${dos(f.hora)}:${dos(f.minuto)}`;
}

export type EstadoPeriodo = 'Programado' | 'Activo' | 'Finalizado';

export function estadoPeriodo(p: Pick<GuideEditLock, 'startsAt' | 'endsAt'>, ahora = Date.now()): EstadoPeriodo {
  if (Date.parse(p.endsAt) <= ahora) return 'Finalizado';
  if (Date.parse(p.startsAt) > ahora) return 'Programado';
  return 'Activo';
}

/** "01 dic al 15 dic 2026" (con el año en cada lado si cambia). */
export function vigenciaPeriodo(inicio: string, fin: string): string {
  const a = partes(inicio);
  const b = partes(fin);
  const dia = (f: typeof a) => `${dos(f.dia)} ${MESES[f.mes - 1]}`;
  return a.anio === b.anio ? `${dia(a)} al ${dia(b)} ${b.anio}` : `${diaPeriodo(inicio)} al ${diaPeriodo(fin)}`;
}
