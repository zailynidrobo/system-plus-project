import { FormControl } from '@angular/forms';
import { esCorreoValido, validarCorreo } from './correo';

describe('validación de correo', () => {
  it.each(['ana.perez@gmail.com', 'docente@colegio.edu.co', 'JUAN@Empresa.org', 'x@sub.dominio.co'])(
    'acepta %s (cualquier dominio)',
    (correo) => {
      expect(esCorreoValido(correo)).toBe(true);
      expect(validarCorreo(new FormControl(correo))).toBeNull();
    },
  );

  it.each(['sin-arroba.com', 'nombre@', 'nombre@dominio', 'con espacio@correo.com'])('rechaza %s', (correo) => {
    expect(validarCorreo(new FormControl(correo))).toEqual({ formato: true });
  });

  it('deja el vacío a Validators.required', () => {
    expect(validarCorreo(new FormControl(''))).toBeNull();
  });
});
