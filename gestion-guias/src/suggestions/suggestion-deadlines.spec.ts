import {
  computeDeadlines,
  deadlineInfo,
  minimumNeededBy,
} from './suggestion-deadlines.js';
import {
  DEFAULT_SUGGESTION_RULES,
  loadSuggestionRules,
} from './suggestion-rules.js';

const rules = DEFAULT_SUGGESTION_RULES;
// Viernes 30 oct 2026, 10:00 a. m. en Bogotá.
const sentAt = new Date('2026-10-30T15:00:00Z');
const { dueSoonAt, dueAt } = computeDeadlines(sentAt, rules);
const pending = { status: 'pending', dueSoonAt, dueAt };

describe('Plazos de respuesta (5 a 8 días hábiles)', () => {
  it('guarda el fin del día hábil 5 (9 nov) y del día hábil 8 (12 nov) en Bogotá', () => {
    expect(dueSoonAt.toISOString()).toBe('2026-11-10T04:59:59.999Z');
    expect(dueAt.toISOString()).toBe('2026-11-13T04:59:59.999Z');
  });

  it('on_time hasta el fin del 9 nov', () => {
    expect(
      deadlineInfo(pending, new Date('2026-11-10T04:00:00Z'), rules),
    ).toEqual({
      deadlineStatus: 'on_time',
      businessDaysLeft: 3,
      businessDaysOverdue: null,
    });
  });

  it('due_soon entre el 10 y el 12 nov', () => {
    expect(
      deadlineInfo(pending, new Date('2026-11-10T15:00:00Z'), rules),
    ).toEqual({
      deadlineStatus: 'due_soon',
      businessDaysLeft: 2,
      businessDaysOverdue: null,
    });
    expect(
      deadlineInfo(pending, new Date('2026-11-13T04:00:00Z'), rules)
        .businessDaysLeft,
    ).toBe(0);
  });

  it('overdue después del 12 nov, contando días hábiles de retraso (el 16 nov es festivo)', () => {
    expect(
      deadlineInfo(pending, new Date('2026-11-17T15:00:00Z'), rules),
    ).toEqual({
      deadlineStatus: 'overdue',
      businessDaysLeft: 0,
      businessDaysOverdue: 2,
    });
    // Sábado 14 nov: venció el jueves, así que lleva 1 día hábil (el viernes).
    expect(
      deadlineInfo(pending, new Date('2026-11-14T15:00:00Z'), rules)
        .businessDaysOverdue,
    ).toBe(1);
  });

  it('las decididas no tienen plazo', () => {
    expect(
      deadlineInfo(
        { ...pending, status: 'approved' },
        new Date('2026-12-01T15:00:00Z'),
        rules,
      ),
    ).toEqual({
      deadlineStatus: null,
      businessDaysLeft: null,
      businessDaysOverdue: null,
    });
  });

  it('la fecha requerida mínima es el envío en Bogotá + 14 días', () => {
    expect(minimumNeededBy(new Date('2026-10-24T15:00:00Z'), rules)).toBe(
      '2026-11-07',
    );
    // 23 oct a las 10 p. m. en Bogotá: cuenta desde el 23, no desde el 24 de UTC.
    expect(minimumNeededBy(new Date('2026-10-24T03:00:00Z'), rules)).toBe(
      '2026-11-06',
    );
  });
});

describe('Reglas configurables por variables de entorno', () => {
  it('usa 5, 8 y 14 por defecto', () => {
    expect(loadSuggestionRules(() => undefined)).toMatchObject({
      dueSoonBusinessDays: 5,
      dueBusinessDays: 8,
      minNoticeDays: 14,
      timeZone: 'America/Bogota',
    });
  });

  it('permite sobrescribirlas', () => {
    const env: Record<string, string> = {
      SUGGESTION_DUE_SOON_BUSINESS_DAYS: '3',
      SUGGESTION_DUE_BUSINESS_DAYS: '6',
      SUGGESTION_MIN_NOTICE_DAYS: '21',
    };
    expect(loadSuggestionRules((name) => env[name])).toMatchObject({
      dueSoonBusinessDays: 3,
      dueBusinessDays: 6,
      minNoticeDays: 21,
    });
  });

  it('rechaza valores inválidos al arrancar', () => {
    expect(() =>
      loadSuggestionRules((name) =>
        name === 'SUGGESTION_DUE_BUSINESS_DAYS' ? 'ocho' : undefined,
      ),
    ).toThrow(/SUGGESTION_DUE_BUSINESS_DAYS/);
    expect(() =>
      loadSuggestionRules((name) =>
        name === 'SUGGESTION_DUE_SOON_BUSINESS_DAYS' ? '9' : undefined,
      ),
    ).toThrow(/no puede ser mayor/);
  });
});
