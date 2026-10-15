import { generateTemporaryPassword } from './temporary-password.js';
import { joinName, splitName } from './user-name.js';

describe('generateTemporaryPassword', () => {
  it('genera 12 caracteres con mayúscula, minúscula, número y símbolo', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTemporaryPassword();

      expect(password).toHaveLength(12);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!#$%*?]/);
    }
  });

  it('no repite contraseñas', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()));

    expect(passwords.size).toBe(100);
  });
});

describe('splitName / joinName', () => {
  it('la primera palabra es el nombre y el resto el apellido', () => {
    expect(splitName('María Camila Rojas')).toEqual({ firstName: 'María', lastName: 'Camila Rojas' });
  });

  it('un nombre de una sola palabra no trae apellido', () => {
    expect(splitName('  Ana ')).toEqual({ firstName: 'Ana' });
  });

  it('une nombre y apellido, o usa el nombre de usuario si no hay ninguno', () => {
    expect(joinName({ firstName: 'Ana', lastName: 'Gómez', username: 'ana@example.com' })).toBe(
      'Ana Gómez',
    );
    expect(joinName({ username: 'ana@example.com' })).toBe('ana@example.com');
  });
});
