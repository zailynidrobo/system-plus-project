import {
  buildCompetencyPrefix,
  cleanText,
  ensureUniquePrefix,
  formatCompetencyCode,
  formatModuleCode,
  normalizeForComparison,
} from './curricular-codes.js';

describe('curricular-codes (HE-02)', () => {
  it('compares module names without case or extra spaces', () => {
    expect(normalizeForComparison('  Bases   de DATOS ')).toBe(
      normalizeForComparison('Bases de Datos'),
    );
    expect(cleanText('  Bases   de Datos ')).toBe('Bases de Datos');
  });

  it('formats module and competency codes like the prototypes', () => {
    expect(formatModuleCode('TS', 6)).toBe('TS-MOD-06');
    expect(formatCompetencyCode('POO', 5)).toBe('COMP-POO-05');
    expect(formatCompetencyCode('POO', 123)).toBe('COMP-POO-123');
  });

  it.each([
    ['Programación Orientada a Objetos', 'POO'],
    ['Programación Orientada a Objetos y Patrones', 'POOP'],
    ['Bases de Datos', 'BD'],
    ['Fundamentos de programación', 'FP'],
    ['Seguridad informática y soporte técnico', 'SIST'],
    ['Redes', 'RED'],
    ['  ', 'MOD'],
  ])('builds the competency prefix of "%s" as %s', (name, prefix) => {
    expect(buildCompetencyPrefix(name)).toBe(prefix);
  });

  it('adds a numeric suffix when the prefix is already used in the program', () => {
    expect(ensureUniquePrefix('BD', [])).toBe('BD');
    expect(ensureUniquePrefix('BD', ['BD', 'BD2'])).toBe('BD3');
  });
});
