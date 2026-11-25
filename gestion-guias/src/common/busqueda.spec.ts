import {
  normalizarBusqueda,
  patronContiene,
  sqlSinTildes,
} from './busqueda.js';

describe('búsqueda sin tildes', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizarBusqueda('Programación ÁREA Ñandú')).toBe(
      'programacion area nandu',
    );
  });

  it('arma un patrón "contiene" con los comodines escapados', () => {
    expect(patronContiene('  Inglés 100%_ ')).toBe('%ingles 100\\%\\_%');
  });

  it('compara la columna sin tildes en SQL', () => {
    expect(sqlSinTildes('module.name')).toBe(
      "translate(lower(module.name), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')",
    );
  });
});
