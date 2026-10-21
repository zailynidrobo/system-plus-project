import {
  buildCompetencyPrefix,
  ensureUniquePrefix,
  formatCompetencyCode,
  formatModuleCode,
  normalizeForComparison,
} from './curricular';

describe('Reglas curriculares (mismo contrato que el backend)', () => {
  it.each([
    ['Programación Orientada a Objetos', 'POO'],
    ['Bases de Datos', 'BD'],
    ['Redes y conectividad', 'RC'],
    ['Seguridad informática y soporte técnico', 'SIST'],
    ['Redes', 'RED'],
  ])('sigla de "%s" → %s', (nombre, sigla) => {
    expect(buildCompetencyPrefix(nombre)).toBe(sigla);
  });

  it('agrega un número si la sigla ya existe', () => {
    expect(ensureUniquePrefix('BD', ['BD', 'POO'])).toBe('BD2');
    expect(ensureUniquePrefix('RC', ['BD'])).toBe('RC');
  });

  it('compara sin distinguir mayúsculas ni espacios de más', () => {
    expect(normalizeForComparison('  bases   DE datos ')).toBe(normalizeForComparison('Bases de Datos'));
  });

  it('formatea los códigos con dos dígitos', () => {
    expect(formatModuleCode('TS', 6)).toBe('TS-MOD-06');
    expect(formatCompetencyCode('POO', 5)).toBe('COMP-POO-05');
  });
});
