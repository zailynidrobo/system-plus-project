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

/** "05 nov 2026 · 10:32 a. m." en hora de Bogotá, sin importar la zona del navegador. */
export function fechaHoraBogota(iso: string | null | undefined): string {
  if (!iso) return '';
  const f = partes(iso);
  const sufijo = f.hora < 12 ? 'a. m.' : 'p. m.';
  const hora = `${f.hora % 12 || 12}:${String(f.minuto).padStart(2, '0')} ${sufijo}`;
  return `${String(f.dia).padStart(2, '0')} ${MESES[f.mes - 1]} ${f.anio} · ${hora}`;
}

/** "2026-11-05", el día en Bogotá de un instante (lo que usan los filtros from y to). */
export function diaBogota(iso: string): string {
  const f = partes(iso);
  return `${f.anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;
}

/** Nombre para mostrar: el correo cuando no hay nombre (inicio de sesión fallido). */
export function nombreAuditoria(u: { name: string | null; email: string | null }): string {
  return u.name || u.email || 'Usuario desconocido';
}

/** "08 oct 2026 · 11:02:14" en hora de Bogotá, con segundos y 24 horas como en Figma. */
export function fechaHoraSegundosBogota(iso: string | null | undefined): string {
  if (!iso) return '';
  const base = fechaHoraBogota(iso).split(' · ')[0];
  const f = new Date(iso);
  const hms = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(f);
  return `${base} · ${hms.replace(/^0(\d:)/, '$1')}`;
}

/** 1248 -> "1.248" */
export const numero = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const PALABRAS_SUELTAS = new Set(['a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'y', 'e', 'en', 'para', 'por', 'con']);

/** "Programación Orientada a Objetos" -> "POO" (las palabras sueltas como "de" o "a" no cuentan). */
export function siglas(nombre: string | null | undefined): string {
  if (!nombre) return '';
  const letras = nombre
    .split(/\s+/)
    .filter((p) => p && !PALABRAS_SUELTAS.has(p.toLowerCase()))
    .map((p) => p[0].toUpperCase());
  return letras.length > 1 ? letras.join('') : nombre;
}

/** Iniciales del avatar: del nombre y, si no hay, de las dos primeras letras del correo. */
export function inicialesAuditoria(u: { name: string | null; email: string | null }): string {
  const partes = (u.name ?? '').split(/\s+/).filter(Boolean);
  if (partes.length) return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  return (u.email ?? '?').slice(0, 2).toUpperCase();
}

export type TonoAccion = 'base' | 'ok' | 'warn' | 'neutral' | 'off';

/** Color de la etiqueta de la acción: crear/publicar/aprobar en verde, roles en amarillo, sesión en gris. */
export function tonoAccion(e: { action: string; area: string; result: string }): TonoAccion {
  if (e.result !== 'success') return 'off';
  if (e.area === 'Sesión') return 'neutral';
  if (/\broles?\b|permisos/i.test(e.action)) return 'warn';
  if (/^(Crear|Publicar|Aprobar|Registrar|Adjuntar|Reactivar)\b/.test(e.action)) return 'ok';
  return 'base';
}

/** Suma o resta días a un día "AAAA-MM-DD" (sin mirar la zona horaria del navegador). */
export function sumarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export const hoyBogota = (): string => diaBogota(new Date().toISOString());

/** Una celda de csv: entre comillas si trae coma, comillas o salto de línea. */
const celda = (v: string | number | null | undefined): string => {
  const t = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

interface FilaCsv {
  occurredAt: string;
  user: { name: string | null; email: string | null; roleLabel: string | null };
  action: string;
  area: string;
  result: string;
  entity: { label: string | null } | null;
  module: { name: string } | null;
  ip: string | null;
}

/** Texto del csv con la fila de títulos; el resultado va con su nombre en español. */
export function aCsv(eventos: FilaCsv[], resultados: Record<string, string>): string {
  const filas = [['Fecha y hora', 'Usuario', 'Correo', 'Rol', 'Acción', 'Área', 'Elemento', 'Módulo', 'IP de origen', 'Resultado']];
  for (const e of eventos) {
    filas.push([
      fechaHoraSegundosBogota(e.occurredAt),
      e.user.name ?? '',
      e.user.email ?? '',
      e.user.roleLabel ?? '',
      e.action,
      e.area,
      e.entity?.label ?? '',
      e.module?.name ?? '',
      e.ip ?? '',
      resultados[e.result] ?? e.result,
    ]);
  }
  return filas.map((f) => f.map(celda).join(',')).join('\r\n');
}
