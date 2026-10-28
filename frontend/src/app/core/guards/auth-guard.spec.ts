import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import { MockDb } from '../mock/mock-db';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { authGuard } from './auth-guard';

async function ejecutar(): Promise<unknown> {
  const r = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return isObservable(r) ? firstValueFrom(r as Observable<unknown>) : r;
}

const url = (r: unknown) => TestBed.inject(Router).serializeUrl(r as UrlTree);

describe('authGuard', () => {
  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [provideRouter([]), SIN_LATENCIA] });
  });

  afterEach(limpiarSesion);

  it('sin sesión manda al login', async () => {
    expect(url(await ejecutar())).toBe('/login');
  });

  it('con sesión activa deja pasar', async () => {
    await entrarComo(CORREOS.admin);
    expect(await ejecutar()).toBe(true);
  });

  it('si el usuario fue desactivado durante la sesión, lo saca al login con un aviso', async () => {
    const docente = await entrarComo(CORREOS.docente);
    const db = TestBed.inject(MockDb);
    db.usuarios = db.usuarios.map((u) => (u.id === docente.id ? { ...u, activo: false } : u));

    expect(url(await ejecutar())).toBe('/login?motivo=sesion-vencida');
  });
});
