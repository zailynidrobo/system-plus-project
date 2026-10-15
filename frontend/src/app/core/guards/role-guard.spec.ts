import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Role } from '../../shared/models/user';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { roleGuard } from './role-guard';

function ejecutar(roles: Role[]) {
  const route = { data: { roles } } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
}

const url = (r: unknown) => TestBed.inject(Router).serializeUrl(r as UrlTree);

describe('roleGuard', () => {
  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [provideRouter([]), SIN_LATENCIA] });
  });

  afterEach(limpiarSesion);

  it('sin sesión manda al login', () => {
    expect(url(ejecutar(['ADMINISTRADOR']))).toBe('/login');
  });

  it('deja pasar al rol permitido', async () => {
    await entrarComo(CORREOS.coordinador);
    expect(ejecutar(['COORDINADOR'])).toBe(true);
  });

  it('manda a "Sin acceso" (no al login) si el rol no tiene permiso', async () => {
    await entrarComo(CORREOS.docente);
    expect(url(ejecutar(['ADMINISTRADOR']))).toBe('/sin-acceso');
  });

  it('el Docente Autorizado entra donde entra el Docente', async () => {
    await entrarComo(CORREOS.autorizado);
    expect(ejecutar(['DOCENTE', 'DOCENTE_AUTORIZADO'])).toBe(true);
  });
});
