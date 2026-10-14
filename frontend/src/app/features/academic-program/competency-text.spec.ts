import { FormControl } from '@angular/forms';
import { COMPETENCIA_MAX, COMPETENCIA_MIN, longitudCompetencia } from './competency-text';

describe('longitudCompetencia', () => {
  const validar = (texto: string) =>
    longitudCompetencia(new FormControl(texto, { nonNullable: true }));

  it('rechaza un texto de 9 caracteres y acepta uno de 10', () => {
    expect(validar('a'.repeat(COMPETENCIA_MIN - 1))).toEqual({ corto: true });
    expect(validar('a'.repeat(COMPETENCIA_MIN))).toBeNull();
  });

  it('cuenta el texto sin espacios sobrantes', () => {
    expect(validar('   corto   ')).toEqual({ corto: true });
    expect(validar('  ' + 'a'.repeat(COMPETENCIA_MIN) + '  ')).toBeNull();
  });

  it('rechaza más de 1000 caracteres', () => {
    expect(validar('a'.repeat(COMPETENCIA_MAX))).toBeNull();
    expect(validar('a'.repeat(COMPETENCIA_MAX + 1))).toEqual({ largo: true });
  });

  it('deja el texto vacío al validador required', () => {
    expect(validar('')).toBeNull();
    expect(validar('   ')).toBeNull();
  });
});
