import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { KeycloakAdminService } from '../users/keycloak-admin.service.js';

const issuer = 'http://keycloak.test/realms/system-plus';

function accessToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.firma`;
}

const COORDINADOR = accessToken({
  sub: 'id-coordinador',
  name: 'Laura Coordinadora',
  email: 'coordinador@example.com',
  realm_access: { roles: ['offline_access', 'coordinador'] },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const tokens = (access = COORDINADOR) =>
  json({
    access_token: access,
    expires_in: 300,
    refresh_token: 'refresh-1',
    refresh_expires_in: 1800,
  });
const rejected = (description: string, status = 400) =>
  json({ error: 'invalid_grant', error_description: description }, status);

function createService(keycloak: Partial<KeycloakAdminService> = {}) {
  const values: Record<string, string> = { KEYCLOAK_ISSUER_URL: issuer };
  const config = {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
  return new AuthService(config, keycloak as KeycloakAdminService);
}

const errorCode = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as { getResponse(): { code: string } }).getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('AuthService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('login', () => {
    it('valida el correo y la contraseña con Keycloak y devuelve la sesión con el rol', async () => {
      fetchMock.mockResolvedValueOnce(tokens());

      const session = await createService().login({
        email: '  Coordinador@Example.com ',
        password: '12345678',
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${issuer}/protocol/openid-connect/token`);
      const body = new URLSearchParams(String(init.body));
      expect(body.get('grant_type')).toBe('password');
      expect(body.get('client_id')).toBe('system-plus-front');
      expect(body.get('username')).toBe('coordinador@example.com');
      expect(session).toEqual({
        accessToken: COORDINADOR,
        refreshToken: 'refresh-1',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        user: {
          id: 'id-coordinador',
          name: 'Laura Coordinadora',
          email: 'coordinador@example.com',
          role: 'coordinador',
          isActive: true,
        },
      });
    });

    it('no consulta la lista de usuarios para iniciar sesión', async () => {
      const listUsers = vi.fn();
      fetchMock.mockResolvedValueOnce(tokens());

      await createService({ listUsers }).login({
        email: 'c@example.com',
        password: 'x',
      });

      expect(listUsers).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      'Invalid user credentials',
      'Account disabled',
      'Account temporarily disabled',
    ])(
      'responde con el mismo error genérico cuando Keycloak dice "%s"',
      async (description) => {
        fetchMock.mockResolvedValueOnce(rejected(description, 401));

        const promise = createService().login({
          email: 'c@example.com',
          password: 'x',
        });

        await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
        expect(await errorCode(promise)).toBe('CREDENCIALES_INVALIDAS');
      },
    );

    it('avisa que hay que cambiar la contraseña temporal', async () => {
      fetchMock.mockResolvedValueOnce(rejected('Account is not fully set up'));

      const promise = createService().login({
        email: 'nuevo@example.com',
        password: 'Temp1234',
      });

      expect(await errorCode(promise)).toBe('CAMBIO_CONTRASENA_REQUERIDO');
    });

    it('rechaza una cuenta sin rol de la app', async () => {
      fetchMock.mockResolvedValueOnce(
        tokens(
          accessToken({
            sub: 'x',
            realm_access: { roles: ['offline_access'] },
          }),
        ),
      );

      const promise = createService().login({
        email: 'c@example.com',
        password: 'x',
      });

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('elige el rol de mayor alcance si la cuenta tiene varios', async () => {
      fetchMock.mockResolvedValueOnce(
        tokens(
          accessToken({
            sub: 'x',
            realm_access: { roles: ['docente', 'admin'] },
          }),
        ),
      );

      const session = await createService().login({
        email: 'c@example.com',
        password: 'x',
      });

      expect(session.user.role).toBe('admin');
    });

    it('responde SERVICIO_NO_DISPONIBLE si Keycloak no contesta o falla', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(
        createService().login({ email: 'c@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      fetchMock.mockResolvedValueOnce(json({}, 503));
      await expect(
        createService().login({ email: 'c@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('refresh', () => {
    it('renueva la sesión con el refresh token', async () => {
      fetchMock.mockResolvedValueOnce(tokens());

      const session = await createService().refresh('refresh-0');

      const body = new URLSearchParams(String(fetchMock.mock.calls[0][1].body));
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('refresh-0');
      expect(session.refreshToken).toBe('refresh-1');
    });

    it('responde SESION_VENCIDA si Keycloak ya no acepta el refresh token', async () => {
      fetchMock.mockResolvedValueOnce(rejected('Session not active'));

      expect(await errorCode(createService().refresh('viejo'))).toBe(
        'SESION_VENCIDA',
      );
    });
  });

  describe('logout', () => {
    it('cierra la sesión en Keycloak', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await createService().logout('refresh-1');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${issuer}/protocol/openid-connect/logout`);
      expect(String(init.body)).toContain('refresh_token=refresh-1');
    });

    it('no falla si Keycloak no responde', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(
        createService().logout('refresh-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('changeTemporaryPassword', () => {
    const dto = {
      email: 'nuevo@example.com',
      currentPassword: 'Temporal123',
      newPassword: 'Definitiva123',
    };

    it('guarda la nueva contraseña como definitiva y abre la sesión', async () => {
      const findUserByEmail = vi
        .fn()
        .mockResolvedValue({
          id: 'id-nuevo',
          requiredActions: ['UPDATE_PASSWORD'],
        });
      const setPassword = vi.fn().mockResolvedValue(undefined);
      fetchMock
        .mockResolvedValueOnce(rejected('Account is not fully set up'))
        .mockResolvedValueOnce(tokens());

      const session = await createService({
        findUserByEmail,
        setPassword,
      }).changeTemporaryPassword(dto);

      expect(setPassword).toHaveBeenCalledWith(
        'id-nuevo',
        'Definitiva123',
        false,
      );
      const loginBody = new URLSearchParams(
        String(fetchMock.mock.calls[1][1].body),
      );
      expect(loginBody.get('password')).toBe('Definitiva123');
      expect(session.user.role).toBe('coordinador');
    });

    it('no cambia nada si la contraseña temporal es incorrecta', async () => {
      const setPassword = vi.fn();
      fetchMock.mockResolvedValueOnce(
        rejected('Invalid user credentials', 401),
      );

      const promise = createService({ setPassword }).changeTemporaryPassword(
        dto,
      );

      expect(await errorCode(promise)).toBe('CREDENCIALES_INVALIDAS');
      expect(setPassword).not.toHaveBeenCalled();
    });

    it('no cambia nada si la cuenta no tiene una contraseña temporal', async () => {
      const setPassword = vi.fn();
      fetchMock.mockResolvedValueOnce(tokens());

      const promise = createService({ setPassword }).changeTemporaryPassword(
        dto,
      );

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      expect(setPassword).not.toHaveBeenCalled();
    });

    it('exige que la nueva contraseña sea distinta de la temporal', async () => {
      const promise = createService().changeTemporaryPassword({
        ...dto,
        newPassword: dto.currentPassword,
      });

      expect(await errorCode(promise)).toBe('CONTRASENA_REPETIDA');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
