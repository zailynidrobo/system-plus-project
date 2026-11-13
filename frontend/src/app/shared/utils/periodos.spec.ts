import {
  ahoraLocalBogota,
  aIsoBogota,
  diaDeReapertura,
  estadoPeriodo,
  fechaHoraPeriodo,
  rangoPeriodo,
  vigenciaPeriodo,
} from './periodos';

describe('periodos de bloqueo', () => {
  it('escribe las fechas como en Figma, en hora de Bogotá', () => {
    expect(fechaHoraPeriodo('2026-12-01T05:00:00.000Z')).toBe('01 dic 2026 · 12:00 a. m.');
    expect(fechaHoraPeriodo('2027-01-01T04:59:00.000Z')).toBe('31 dic 2026 · 11:59 p. m.');
  });

  it('arma el rango según cruce de mes o de año', () => {
    expect(rangoPeriodo('2026-12-01T05:00:00.000Z', '2026-12-16T04:59:00.000Z')).toBe('01 – 15 dic 2026');
    expect(rangoPeriodo('2026-11-20T05:00:00.000Z', '2026-12-16T04:59:00.000Z')).toBe('20 nov – 15 dic 2026');
    expect(rangoPeriodo('2026-12-20T05:00:00.000Z', '2027-01-10T04:59:00.000Z')).toBe('20 dic 2026 – 09 ene 2027');
  });

  it('escribe la vigencia para el aviso del docente', () => {
    expect(vigenciaPeriodo('2026-12-01T05:00:00.000Z', '2026-12-16T04:59:00.000Z')).toBe('01 dic al 15 dic 2026');
    expect(vigenciaPeriodo('2026-12-20T05:00:00.000Z', '2027-01-10T04:59:00.000Z')).toBe('20 dic 2026 al 09 ene 2027');
  });

  it('el día de reapertura es el siguiente cuando termina a las 11:59 p. m.', () => {
    expect(diaDeReapertura(aIsoBogota('2026-12-15T23:59'))).toBe('16 dic 2026');
    expect(diaDeReapertura(aIsoBogota('2026-12-15T10:00'))).toBe('15 dic 2026');
  });

  it('lo del input se toma como hora de Bogotá aunque el navegador esté en otra zona', () => {
    expect(aIsoBogota('2026-12-01T00:00')).toBe('2026-12-01T05:00:00.000Z');
    expect(ahoraLocalBogota(Date.parse('2026-12-01T05:30:00.000Z'))).toBe('2026-12-01T00:30');
  });

  it('dice si está programado, activo o finalizado', () => {
    const p = { startsAt: '2026-12-01T05:00:00.000Z', endsAt: '2026-12-16T04:59:00.000Z' };
    expect(estadoPeriodo(p, Date.parse('2026-11-30T12:00:00.000Z'))).toBe('Programado');
    expect(estadoPeriodo(p, Date.parse('2026-12-01T05:00:00.000Z'))).toBe('Activo');
    expect(estadoPeriodo(p, Date.parse('2026-12-16T04:59:00.000Z'))).toBe('Finalizado');
  });
});
