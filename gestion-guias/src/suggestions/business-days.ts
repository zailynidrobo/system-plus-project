/**
 * Días hábiles de Colombia: lunes a viernes, sin festivos (Ley 51 de 1983, "Ley Emiliani").
 * Las fechas de calendario se manejan como texto `YYYY-MM-DD` para no depender de la zona
 * horaria del servidor; `dateInZone` y `endOfDayInZone` hacen la conversión con un instante.
 */

/** Fecha de calendario `YYYY-MM-DD`. */
export type IsoDate = string;

const DAY_MS = 86_400_000;

const toUtc = (iso: IsoDate) => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const fromUtc = (ms: number): IsoDate =>
  new Date(ms).toISOString().slice(0, 10);

export function isIsoDate(value: unknown): value is IsoDate {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    fromUtc(toUtc(value)) === value
  );
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** 0 = domingo ... 6 = sábado. */
export function weekday(iso: IsoDate): number {
  return new Date(toUtc(iso)).getUTCDay();
}

/** Domingo de Pascua (algoritmo anónimo gregoriano, Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fromUtc(Date.UTC(year, month - 1, day));
}

/** Ley Emiliani: el festivo que no cae en lunes pasa al lunes siguiente. */
function nextMonday(iso: IsoDate): IsoDate {
  return addDays(iso, (8 - weekday(iso)) % 7);
}

const date = (year: number, month: number, day: number) =>
  fromUtc(Date.UTC(year, month - 1, day));

const holidaysCache = new Map<number, Set<IsoDate>>();

/** Festivos nacionales de Colombia de un año. */
export function colombianHolidays(year: number): Set<IsoDate> {
  const cached = holidaysCache.get(year);
  if (cached) return cached;

  // Fijos: no se trasladan.
  const fixed = [
    date(year, 1, 1), // Año Nuevo
    date(year, 5, 1), // Día del Trabajo
    date(year, 7, 20), // Independencia
    date(year, 8, 7), // Batalla de Boyacá
    date(year, 12, 8), // Inmaculada Concepción
    date(year, 12, 25), // Navidad
  ];
  // Trasladables al lunes siguiente.
  const movable = [
    date(year, 1, 6), // Reyes Magos
    date(year, 3, 19), // San José
    date(year, 6, 29), // San Pedro y San Pablo
    date(year, 8, 15), // Asunción de la Virgen
    date(year, 10, 12), // Día de la Raza
    date(year, 11, 1), // Todos los Santos
    date(year, 11, 11), // Independencia de Cartagena
  ].map(nextMonday);
  // Dependen de la Pascua.
  const easter = easterSunday(year);
  const easterBased = [
    addDays(easter, -3), // Jueves Santo
    addDays(easter, -2), // Viernes Santo
    nextMonday(addDays(easter, 39)), // Ascensión del Señor
    nextMonday(addDays(easter, 60)), // Corpus Christi
    nextMonday(addDays(easter, 68)), // Sagrado Corazón
  ];

  const holidays = new Set([...fixed, ...movable, ...easterBased]);
  holidaysCache.set(year, holidays);
  return holidays;
}

export function isBusinessDay(iso: IsoDate): boolean {
  const day = weekday(iso);
  if (day === 0 || day === 6) return false;
  return !colombianHolidays(Number(iso.slice(0, 4))).has(iso);
}

/** Día hábil número `days` contado desde el día siguiente a `start`. */
export function addBusinessDays(start: IsoDate, days: number): IsoDate {
  let current = start;
  let remaining = days;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isBusinessDay(current)) remaining -= 1;
  }
  return current;
}

/** Días hábiles en el intervalo (from, to]. 0 si `to` no es posterior a `from`. */
export function businessDaysBetween(from: IsoDate, to: IsoDate): number {
  let count = 0;
  for (
    let current = addDays(from, 1);
    current <= to;
    current = addDays(current, 1)
  ) {
    if (isBusinessDay(current)) count += 1;
  }
  return count;
}

/** Días de calendario de `from` a `to` (negativo si `to` es anterior). */
export function calendarDaysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "2026-11-07" -> "7 nov 2026" */
export function formatSpanishDate(iso: IsoDate): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Fecha de calendario de un instante en una zona horaria (p. ej. America/Bogota). */
export function dateInZone(instant: Date, timeZone: string): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Diferencia en ms entre la hora local de la zona y UTC en ese instante (Bogotá: -5 h). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Último milisegundo del día `iso` en la zona horaria (23:59:59.999 hora local). */
export function endOfDayInZone(iso: IsoDate, timeZone: string): Date {
  const localEnd = toUtc(iso) + DAY_MS - 1;
  let instant = localEnd - zoneOffsetMs(localEnd, timeZone);
  // Segunda pasada por si el desfase cambia ese día (horario de verano en otras zonas).
  instant = localEnd - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}
