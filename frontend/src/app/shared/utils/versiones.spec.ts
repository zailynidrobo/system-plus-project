import { diferencia } from './versiones';

describe('diferencia (comparación de versiones)', () => {
  it('sin cambios no marca nada', () => {
    expect(diferencia('igual', 'igual')).toEqual({ inicio: 'igual', cambio: '', fin: '' });
  });

  it('marca lo que se agregó al final', () => {
    expect(diferencia('a b c', 'a b c d')).toEqual({ inicio: 'a b c', cambio: ' d', fin: '' });
  });

  it('marca la palabra que cambió en el medio', () => {
    expect(diferencia('uno dos tres', 'uno cuatro tres')).toEqual({ inicio: 'uno ', cambio: 'cuatro', fin: ' tres' });
  });

  it('si el campo estaba vacío, todo lo nuevo es cambio', () => {
    expect(diferencia('', 'texto nuevo')).toEqual({ inicio: '', cambio: 'texto nuevo', fin: '' });
  });
});
