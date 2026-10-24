import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockDb } from './core/mock/mock-db';
import { routes } from './app.routes';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../testing/test-helpers';

describe('Rutas: redirección por rol', () => {
  let harness: RouterTestingHarness;
  const urlActual = () => TestBed.inject(Router).url;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), SIN_LATENCIA] });
    harness = await RouterTestingHarness.create();
  });

  afterEach(limpiarSesion);

  it('sin sesión, una ruta protegida lleva al login', async () => {
    await harness.navigateByUrl('/modulos');
    expect(urlActual()).toBe('/login');
  });

  it.each([
    [CORREOS.admin, '/inicio'],
    [CORREOS.coordinador, '/inicio'],
    [CORREOS.docente, '/inicio'],
    [CORREOS.autorizado, '/inicio'],
  ])('%s entra a %s desde la ruta vacía', async (correo, destino) => {
    await entrarComo(correo);
    await harness.navigateByUrl('/');
    expect(urlActual()).toBe(destino);
  });

  it('un rol sin permiso va a "Sin acceso" y no al login', async () => {
    await entrarComo(CORREOS.docente);
    await harness.navigateByUrl('/usuarios');
    expect(urlActual()).toBe('/sin-acceso');
  });

  it.each([
    [CORREOS.docente, '/sugerencias'],
    [CORREOS.docente, '/guias'],
    [CORREOS.coordinador, '/mis-versiones'],
    [CORREOS.coordinador, '/mis-sugerencias'],
    [CORREOS.admin, '/sugerencias'],
  ])('%s no puede abrir %s', async (correo, ruta) => {
    await entrarComo(correo);
    await harness.navigateByUrl(ruta);
    expect(urlActual()).toBe('/sin-acceso');
  });

  it.each([
    [CORREOS.autorizado, '/mis-versiones'],
    [CORREOS.autorizado, '/mis-sugerencias'],
    [CORREOS.coordinador, '/sugerencias'],
  ])('%s sí puede abrir %s', async (correo, ruta) => {
    await entrarComo(correo);
    await harness.navigateByUrl(ruta);
    expect(urlActual()).toBe(ruta);
  });

  it('con sesión, /login redirige al inicio del rol', async () => {
    await entrarComo(CORREOS.coordinador);
    await harness.navigateByUrl('/login');
    expect(urlActual()).toBe('/inicio');
  });

  it('"Asignar rol" vive bajo Roles y permisos; la ruta anterior redirige', async () => {
    await entrarComo(CORREOS.admin);
    await harness.navigateByUrl('/usuarios/2/rol');
    expect(urlActual()).toBe('/roles/2');
  });

  it('una ruta desconocida lleva al inicio del rol', async () => {
    await entrarComo(CORREOS.admin);
    await harness.navigateByUrl('/no-existe');
    expect(urlActual()).toBe('/inicio');
  });

  it('un cambio de rol se aplica en la siguiente navegación, sin volver a iniciar sesión', async () => {
    const docente = await entrarComo(CORREOS.docente);
    await harness.navigateByUrl('/mis-modulos');

    const db = TestBed.inject(MockDb);
    db.usuarios = db.usuarios.map((u) => (u.id === docente.id ? { ...u, rol: 'COORDINADOR' } : u));

    await harness.navigateByUrl('/modulos');
    expect(urlActual()).toBe('/modulos');
  });
});
