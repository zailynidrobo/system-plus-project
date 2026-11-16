import { complementoDe, conservaTextoBase, unirComplemento } from './complemento';

describe('Complemento del docente autorizado', () => {
  it('separa y vuelve a unir el texto base y el complemento', () => {
    const valor = unirComplemento('Taller de modelado', 'Incluye un caso local.');
    expect(valor).toBe('Taller de modelado\n\nIncluye un caso local.');
    expect(complementoDe(valor, 'Taller de modelado')).toBe('Incluye un caso local.');
    expect(unirComplemento('Taller de modelado', '   ')).toBe('Taller de modelado');
  });

  it('un texto que ya no empieza por la base se toma completo como complemento', () => {
    expect(complementoDe('Clase magistral', 'Aprendizaje basado en proyectos')).toBe('Clase magistral');
  });

  it('exige conservar la base solo en campos de texto con contenido base', () => {
    expect(conservaTextoBase('textarea', 'Base', 'Base y algo más')).toBe(true);
    expect(conservaTextoBase('textarea', 'Base', 'Otra cosa')).toBe(false);
    expect(conservaTextoBase('select', 'Por proyecto', 'Por evidencias')).toBe(true);
    expect(conservaTextoBase('text', '', 'Libre')).toBe(true);
  });
});
