import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MockDb } from '../mock/mock-db';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { Auth } from './auth';
import { TokenStorage } from './token-storage';

describe('Auth (login simulado)', () => {
  let auth: Auth;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    auth = TestBed.inject(Auth);
  });

  afterEach(limpiarSesion);

  it('inicia sesión con los usuarios de prueba y no expone la contraseña', async () => {
    const usuario = await entrarComo(CORREOS.coordinador);

    expect(usuario.nombre).toBe('Laura Muñoz');
    expect(usuario.rol).toBe('COORDINADOR');
    expect('contrasena' in usuario).toBe(false);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.token()).toBe('token-falso-' + usuario.id);
  });

  it('usa los nombres de Figma para el docente', async () => {
    expect((await entrarComo(CORREOS.docente)).nombre).toBe('Julián Andrés Ospina');
  });

  it('da el mismo error genérico para contraseña incorrecta, correo inexistente o usuario desactivado', async () => {
    const malaClave = await capturarError(auth.login({ correo: CORREOS.admin, contrasena: 'x' }));
    const noExiste = await capturarError(auth.login({ correo: 'nadie@example.com', contrasena: '123456' }));
    const inactivo = await capturarError(auth.login({ correo: CORREOS.inactivo, contrasena: '123456' }));

    for (const err of [malaClave, noExiste, inactivo]) expect(err.code).toBe('CREDENCIALES_INVALIDAS');
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('"Mantener sesión iniciada" guarda en localStorage; si no, en sessionStorage', async () => {
    await entrarComo(CORREOS.admin, true);
    expect(localStorage.getItem('athena_token')).not.toBeNull();

    auth.logout();
    await entrarComo(CORREOS.admin, false);
    expect(localStorage.getItem('athena_token')).toBeNull();
    expect(sessionStorage.getItem('athena_token')).not.toBeNull();
  });

  it('refrescar aplica un cambio de rol sin volver a iniciar sesión', async () => {
    const docente = await entrarComo(CORREOS.docente);
    const db = TestBed.inject(MockDb);
    db.usuarios = db.usuarios.map((u) => (u.id === docente.id ? { ...u, rol: 'DOCENTE_AUTORIZADO' } : u));

    const refrescado = await firstValueFrom(auth.refrescar());

    expect(refrescado?.rol).toBe('DOCENTE_AUTORIZADO');
    expect(auth.user()?.rol).toBe('DOCENTE_AUTORIZADO');
    expect(TestBed.inject(TokenStorage).getUser()?.rol).toBe('DOCENTE_AUTORIZADO');
  });

  it('refrescar cierra la sesión si el usuario fue desactivado', async () => {
    const docente = await entrarComo(CORREOS.docente);
    const db = TestBed.inject(MockDb);
    db.usuarios = db.usuarios.map((u) => (u.id === docente.id ? { ...u, activo: false } : u));

    expect(await firstValueFrom(auth.refrescar())).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.token()).toBeNull();
  });

  it('logout borra la sesión', async () => {
    await entrarComo(CORREOS.admin, true);
    auth.logout();

    expect(auth.user()).toBeNull();
    expect(auth.token()).toBeNull();
  });
});
