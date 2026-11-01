import { navPara } from './nav';

const etiquetas = (rol: Parameters<typeof navPara>[0]) => navPara(rol).items.map((i) => i.label);

describe('Menú lateral por rol', () => {
  it('Administrador: Usuarios y Roles y permisos habilitados', () => {
    const nav = navPara('ADMINISTRADOR');
    expect(nav.seccion).toBe('Administración');
    expect(etiquetas('ADMINISTRADOR')).toEqual(['Inicio', 'Usuarios', 'Roles y permisos', 'Auditoría']);
    expect(nav.items.filter((i) => i.route).map((i) => i.route)).toEqual(['/inicio', '/usuarios', '/roles']);
  });

  it('Coordinador: Gestión académica con Programa académico y Sugerencias (con contador)', () => {
    const nav = navPara('COORDINADOR');
    expect(nav.seccion).toBe('Gestión académica');
    expect(etiquetas('COORDINADOR')).toEqual(['Inicio', 'Programa académico', 'Guías de aprendizaje', 'Sugerencias', 'Reportes']);
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

  it('"Inicio" lleva al resumen de cada rol; "Reportes" sigue deshabilitado', () => {
    const coordinador = navPara('COORDINADOR').items;
    expect(coordinador.find((i) => i.label === 'Inicio')?.route).toBe('/inicio');
    expect(coordinador.find((i) => i.label === 'Reportes')?.route).toBeNull();
  });
});
