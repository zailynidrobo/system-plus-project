// Días hábiles de Colombia (lunes a viernes, sin festivos; Ley Emiliani). Es la misma lógica de
// gestion-guias/src/suggestions/business-days.ts: el mock la usa para calcular los plazos de HE-05.
// Las fechas de calendario son texto AAAA-MM-DD para no depender de la zona horaria del navegador.

export type FechaIso = string;

const DIA_MS = 86_400_000;

const aUtc = (iso: FechaIso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const deUtc = (ms: number): FechaIso => new Date(ms).toISOString().slice(0, 10);

export const sumarDias = (iso: FechaIso, dias: number): FechaIso => deUtc(aUtc(iso) + dias * DIA_MS);

/** 0 = domingo ... 6 = sábado */
export const diaSemana = (iso: FechaIso) => new Date(aUtc(iso)).getUTCDay();

export function domingoDePascua(anio: number): FechaIso {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return deUtc(Date.UTC(anio, mes - 1, dia));
}

const lunesSiguiente = (iso: FechaIso) => sumarDias(iso, (8 - diaSemana(iso)) % 7);
const fecha = (a: number, m: number, d: number) => deUtc(Date.UTC(a, m - 1, d));
const cache = new Map<number, Set<FechaIso>>();

export function festivosDeColombia(anio: number): Set<FechaIso> {
  const guardados = cache.get(anio);
  if (guardados) return guardados;
  const pascua = domingoDePascua(anio);
  const festivos = new Set([
    // Fijos
    fecha(anio, 1, 1), fecha(anio, 5, 1), fecha(anio, 7, 20), fecha(anio, 8, 7), fecha(anio, 12, 8), fecha(anio, 12, 25),
    // Trasladables al lunes
    ...[fecha(anio, 1, 6), fecha(anio, 3, 19), fecha(anio, 6, 29), fecha(anio, 8, 15), fecha(anio, 10, 12), fecha(anio, 11, 1), fecha(anio, 11, 11)].map(lunesSiguiente),
    // Según la Pascua: jueves y viernes santo; Ascensión, Corpus Christi y Sagrado Corazón al lunes
    sumarDias(pascua, -3), sumarDias(pascua, -2),
    lunesSiguiente(sumarDias(pascua, 39)), lunesSiguiente(sumarDias(pascua, 60)), lunesSiguiente(sumarDias(pascua, 68)),
  ]);
  cache.set(anio, festivos);
  return festivos;
}

export function esDiaHabil(iso: FechaIso): boolean {
  const d = diaSemana(iso);
  return d !== 0 && d !== 6 && !festivosDeColombia(Number(iso.slice(0, 4))).has(iso);
}

/** Día hábil número `dias` contado desde el día siguiente a `inicio`. */
export function sumarDiasHabiles(inicio: FechaIso, dias: number): FechaIso {
  let actual = inicio;
  for (let faltan = dias; faltan > 0; ) {
    actual = sumarDias(actual, 1);
    if (esDiaHabil(actual)) faltan--;
  }
  return actual;
}

/** Días hábiles en (desde, hasta]. */
export function diasHabilesEntre(desde: FechaIso, hasta: FechaIso): number {
  let n = 0;
  for (let d = sumarDias(desde, 1); d <= hasta; d = sumarDias(d, 1)) if (esDiaHabil(d)) n++;
  return n;
}

export const ZONA_HORARIA = 'America/Bogota';

/** Fecha de calendario de un instante en Bogotá. */
export function fechaEnBogota(instante: Date | string): FechaIso {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(instante),
  );
}

/** 23:59:59.999 de ese día en Bogotá (UTC-5, sin horario de verano). */
export function finDelDiaEnBogota(iso: FechaIso): string {
  return new Date(aUtc(iso) + DIA_MS - 1 + 5 * 3_600_000).toISOString();
}
