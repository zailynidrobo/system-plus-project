import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { capturarError, limpiarSesion } from '../../../../testing/test-helpers';
import { TokenStorage } from '../token-storage';
import { HttpAuthProvider } from './http-auth-provider';

const API = `${environment.apiUrl}/auth`;

const sesion = (accessToken = 'access-1', refreshToken = 'refresh-1', expiresIn = 300) => ({
  accessToken,
  refreshToken,
  expiresIn,
  refreshExpiresIn: 1800,
  user: {
    id: '0a1b2c3d-0000-0000-0000-000000000000',
    name: 'Laura Coordinadora',
    email: 'coordinador@example.com',
    role: 'coordinador',
    isActive: true,
  },
});

describe('HttpAuthProvider', () => {
  let provider: HttpAuthProvider;
  let storage: TokenStorage;
  let backend: HttpTestingController;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    provider = TestBed.inject(HttpAuthProvider);
    storage = TestBed.inject(TokenStorage);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    limpiarSesion();
  });

  async function entrar(expiresIn = 300) {
    const usuario = firstValueFrom(
      provider.login({ correo: 'coordinador@example.com', contrasena: 'x' }, false),
    );
    backend.expectOne(`${API}/login`).flush(sesion('access-1', 'refresh-1', expiresIn));
    return usuario;
  }

  it('inicia sesión con la API y guarda el usuario y los tokens', async () => {
    const usuario = await entrar();

    expect(usuario).toMatchObject({
      nombre: 'Laura Coordinadora',
      correo: 'coordinador@example.com',
      rol: 'COORDINADOR',
      keycloakId: '0a1b2c3d-0000-0000-0000-000000000000',
    });
    expect(provider.token()).toBe('access-1');
    expect(storage.getRenovacion()?.refreshToken).toBe('refresh-1');
  });

  it('pasa el código de error de la API a la pantalla', async () => {
    const error = capturarError(
      provider.login({ correo: 'a@example.com', contrasena: 'x' }, false),
    );
    backend
      .expectOne(`${API}/login`)
      .flush({ code: 'CAMBIO_CONTRASENA_REQUERIDO' }, { status: 403, statusText: 'Forbidden' });

    expect((await error).code).toBe('CAMBIO_CONTRASENA_REQUERIDO');
  });

  it('si la API no responde, el error es de servicio y no de credenciales', async () => {
    const error = capturarError(
      provider.login({ correo: 'a@example.com', contrasena: 'x' }, false),
    );
    backend.expectOne(`${API}/login`).error(new ProgressEvent('error'), { status: 0 });

    expect((await error).code).toBe('SERVICIO_NO_DISPONIBLE');
  });

  it('usa el token tal cual mientras le quede tiempo', async () => {
    await entrar(300);

    expect(await firstValueFrom(provider.tokenVigente())).toBe('access-1');
    backend.expectNone(`${API}/refresh`);
  });

  it('renueva el token cuando está por vencer, una sola vez aunque lo pidan varias peticiones', async () => {
    await entrar(10);

    const primera = firstValueFrom(provider.tokenVigente());
    const segunda = firstValueFrom(provider.tokenVigente());
    const req = backend.expectOne(`${API}/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(sesion('access-2', 'refresh-2'));

    expect(await primera).toBe('access-2');
    expect(await segunda).toBe('access-2');
    expect(storage.getRenovacion()?.refreshToken).toBe('refresh-2');
  });

  it('si la sesión ya no se puede renovar, la borra', async () => {
    await entrar(10);

    const token = firstValueFrom(provider.tokenVigente());
    backend
      .expectOne(`${API}/refresh`)
      .flush({ code: 'SESION_VENCIDA' }, { status: 401, statusText: 'Unauthorized' });

    expect(await token).toBeNull();
    expect(provider.restaurarSesion()).toBeNull();
  });

  it('si la API está caída al renovar, sigue con el token actual', async () => {
    await entrar(10);

    const token = firstValueFrom(provider.tokenVigente());
    backend.expectOne(`${API}/refresh`).error(new ProgressEvent('error'), { status: 0 });

    expect(await token).toBe('access-1');
    expect(provider.restaurarSesion()).not.toBeNull();
  });

  it('al cerrar sesión borra los datos y cierra la sesión en Keycloak', async () => {
    await entrar();

    provider.logout();

    expect(provider.token()).toBeNull();
    const req = backend.expectOne(`${API}/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('cambia la contraseña temporal y abre la sesión', async () => {
    const usuario = firstValueFrom(
      provider.cambiarContrasenaTemporal(
        {
          correo: 'nuevo@example.com',
          contrasenaTemporal: 'Temporal123',
          contrasenaNueva: 'Definitiva123',
        },
        false,
      ),
    );
    const req = backend.expectOne(`${API}/temporary-password`);
    expect(req.request.body).toEqual({
      email: 'nuevo@example.com',
      currentPassword: 'Temporal123',
      newPassword: 'Definitiva123',
    });
    req.flush(sesion());

    expect((await usuario).rol).toBe('COORDINADOR');
    expect(provider.token()).toBe('access-1');
  });
});
