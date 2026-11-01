import {
  addBusinessDays,
  businessDaysBetween,
  colombianHolidays,
  dateInZone,
  easterSunday,
  endOfDayInZone,
  formatSpanishDate,
  isBusinessDay,
  isIsoDate,
} from './business-days.js';

describe('Días hábiles y festivos de Colombia', () => {
  it('calcula la Pascua', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('lista los 18 festivos de 2026, con los trasladados al lunes', () => {
    expect([...colombianHolidays(2026)].sort()).toEqual([
      '2026-01-01', // Año Nuevo
      '2026-01-12', // Reyes (6 ene, martes -> lunes 12)
      '2026-03-23', // San José (19 mar, jueves -> lunes 23)
      '2026-04-02', // Jueves Santo
      '2026-04-03', // Viernes Santo
      '2026-05-01', // Día del Trabajo
      '2026-05-18', // Ascensión
      '2026-06-08', // Corpus Christi
      '2026-06-15', // Sagrado Corazón
      '2026-06-29', // San Pedro y San Pablo (ya es lunes)
      '2026-07-20', // Independencia
      '2026-08-07', // Batalla de Boyacá
      '2026-08-17', // Asunción (15 ago, sábado -> lunes 17)
      '2026-10-12', // Día de la Raza (ya es lunes)
      '2026-11-02', // Todos los Santos (1 nov, domingo -> lunes 2)
      '2026-11-16', // Independencia de Cartagena (11 nov, miércoles -> lunes 16)
      '2026-12-08', // Inmaculada Concepción
      '2026-12-25', // Navidad
    ]);
  });

  it.each(['2026-10-12', '2026-11-02', '2026-11-16'])(
    '%s es festivo y no es día hábil',
    (day) => {
      expect(colombianHolidays(2026).has(day)).toBe(true);
      expect(isBusinessDay(day)).toBe(false);
    },
  );

  it('los fines de semana no son hábiles; un martes normal sí', () => {
    expect(isBusinessDay('2026-10-24')).toBe(false); // sábado
    expect(isBusinessDay('2026-10-25')).toBe(false); // domingo
    expect(isBusinessDay('2026-11-03')).toBe(true);
  });

  it('desde el viernes 30 oct 2026, el día hábil 5 es el 9 nov y el 8 es el 12 nov', () => {
    expect(addBusinessDays('2026-10-30', 5)).toBe('2026-11-09');
    expect(addBusinessDays('2026-10-30', 8)).toBe('2026-11-12');
  });

  it('cuenta los días hábiles de un intervalo sin incluir el inicio', () => {
    expect(businessDaysBetween('2026-11-12', '2026-11-17')).toBe(2); // 13 y 17 (16 es festivo)
    expect(businessDaysBetween('2026-11-12', '2026-11-12')).toBe(0);
    expect(businessDaysBetween('2026-11-12', '2026-11-01')).toBe(0);
  });

  it('usa la fecha y el fin de día de Bogotá (UTC-5)', () => {
    // 23 oct 2026 a las 10:00 p. m. en Bogotá ya es 24 oct en UTC.
    expect(dateInZone(new Date('2026-10-24T03:00:00Z'), 'America/Bogota')).toBe(
      '2026-10-23',
    );
    expect(endOfDayInZone('2026-11-09', 'America/Bogota').toISOString()).toBe(
      '2026-11-10T04:59:59.999Z',
    );
  });

  it('valida y formatea fechas AAAA-MM-DD', () => {
    expect(isIsoDate('2026-11-07')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('07/11/2026')).toBe(false);
    expect(formatSpanishDate('2026-11-07')).toBe('7 nov 2026');
  });
});
