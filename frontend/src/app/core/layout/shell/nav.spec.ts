import { navPara } from './nav';

const etiquetas = (rol: Parameters<typeof navPara>[0]) => navPara(rol).items.map((i) => i.label);

describe('Menú lateral por rol', () => {
  it('Administrador: Usuarios, Roles y permisos y Auditoría habilitados', () => {
    const nav = navPara('ADMINISTRADOR');
    expect(nav.seccion).toBe('Administración');
    expect(etiquetas('ADMINISTRADOR')).toEqual(['Inicio', 'Usuarios', 'Roles y permisos', 'Configuración', 'Auditoría']);
    expect(nav.items.filter((i) => i.route).map((i) => i.route)).toEqual(['/inicio', '/usuarios', '/roles', '/configuracion', '/auditoria']);
  });

  it('Coordinador: Gestión académica con Programa académico y Sugerencias (con contador)', () => {
    const nav = navPara('COORDINADOR');
    expect(nav.seccion).toBe('Gestión académica');
    expect(etiquetas('COORDINADOR')).toEqual(['Inicio', 'Programa académico', 'Guías de aprendizaje', 'Sugerencias']);
    expect(nav.items.find((i) => i.label === 'Sugerencias')?.badge).toBe('sugerencias');
    expect(nav.recuadro).toBe('programa');
  });

  it('Docente y Docente Autorizado ven el mismo menú', () => {
    expect(navPara('DOCENTE')).toBe(navPara('DOCENTE_AUTORIZADO'));
    expect(navPara('DOCENTE').seccion).toBe('Mi espacio docente');
    expect(etiquetas('DOCENTE')).toEqual(['Inicio', 'Guías base', 'Mis versiones', 'Mis sugerencias']);
    expect(navPara('DOCENTE').recuadro).toBe('modulos');
    expect(navPara('DOCENTE').items.filter((i) => i.route).map((i) => i.route)).toEqual(['/inicio', '/mis-modulos', '/mis-versiones', '/mis-sugerencias']);
  });

  it('"Inicio" lleva al resumen de cada rol y el menú no muestra opciones sin desarrollar', () => {
    for (const rol of ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'DOCENTE_AUTORIZADO'] as const) {
      const items = navPara(rol).items;
      expect(items.find((i) => i.label === 'Inicio')?.route).toBe('/inicio');
      expect(items.every((i) => i.route)).toBe(true);
    }
  });
});
