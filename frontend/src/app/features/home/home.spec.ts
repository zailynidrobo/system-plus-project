import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { Home } from './home';

describe('Inicio por rol', () => {
  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [provideRouter([]), SIN_LATENCIA] });
  });

  afterEach(limpiarSesion);

  async function abrir(correo: string) {
    await entrarComo(correo);
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    fixture.detectChanges();
    return { componente: fixture.componentInstance, html: fixture.nativeElement as HTMLElement };
  }

  it('el coordinador ve sus tareas y atajos a sus secciones y acciones', async () => {
    const { componente, html } = await abrir(CORREOS.coordinador);
    const rutas = componente.atajos().map((a) => a.ruta);
    expect(rutas).toEqual(expect.arrayContaining(['/modulos', '/guias', '/sugerencias', '/guias/nueva']));
    expect(rutas).not.toContain('/inicio');
    expect(componente.resumen()?.tareas.some((t) => t.ruta === '/sugerencias')).toBe(true);
    expect(html.textContent).toContain('Tareas pendientes');
  });

  it('el administrador tiene atajos solo a lo que su rol permite', async () => {
    const { componente } = await abrir(CORREOS.admin);
    expect(componente.atajos().map((a) => a.ruta)).toEqual(['/usuarios', '/roles', '/usuarios/nuevo']);
    expect(componente.resumen()?.indicadores[0].titulo).toBe('Usuarios registrados');
  });

  it('el docente ve sus guías asignadas y sus sugerencias propuestas', async () => {
    const { componente } = await abrir(CORREOS.docente);
    expect(componente.atajos().map((a) => a.ruta)).toEqual(['/mis-modulos', '/mis-versiones', '/mis-sugerencias']);
    expect(componente.resumen()?.indicadores.map((i) => i.titulo)).toEqual([
      'Guías disponibles',
      'Mis versiones',
      'Sugerencias en revisión',
    ]);
  });
});
