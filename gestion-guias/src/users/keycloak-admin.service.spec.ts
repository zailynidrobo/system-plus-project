import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakAdminService } from './keycloak-admin.service.js';

const issuer = 'http://keycloak.test/realms/system-plus';
const adminUrl = 'http://keycloak.test/admin/realms/system-plus';

function createService(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    KEYCLOAK_ISSUER_URL: issuer,
    KEYCLOAK_ADMIN_CLIENT_ID: 'system-plus-api',
    KEYCLOAK_ADMIN_CLIENT_SECRET: 'secret',
    ...overrides,
  };
  const config = {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
  return new KeycloakAdminService(config);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const empty = (status = 204, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers });
const tokenResponse = (expiresIn = 300) =>
  json({ access_token: 'service-token', expires_in: expiresIn });

describe('KeycloakAdminService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pide un token con la cuenta de servicio y lo manda como Bearer a la API de administración', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json([]));

    await createService().listUsers();

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe(`${issuer}/protocol/openid-connect/token`);
    expect(String(tokenInit.body)).toContain('grant_type=client_credentials');
    expect(String(tokenInit.body)).toContain('client_id=system-plus-api');
    expect(String(tokenInit.body)).toContain('client_secret=secret');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${adminUrl}/users?max=1000`);
    expect(init.headers.authorization).toBe('Bearer service-token');
  });

  it('reutiliza el token mientras no venza', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([]));
    const service = createService();

    await service.listUsers();
    await service.listUsers();

    // 1 token + 2 consultas
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('pide otro token si el anterior ya casi vence', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse(10))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(tokenResponse(300))
      .mockResolvedValueOnce(json([]));
    const service = createService();

    await service.listUsers();
    await service.listUsers();

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('si Keycloak responde 401 renueva el token y reintenta una vez', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(empty(401))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json([{ id: 'u1' }]));

    const users = await createService().listUsers();

    expect(users).toEqual([{ id: 'u1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('traduce los errores de Keycloak a errores de la API', async () => {
    // Un servicio nuevo por caso: así cada uno pide su propio token y las respuestas simuladas no se cruzan.
    const getUserFailing = (response: Response) => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(response);
      return createService().getUser('u1');
    };

    await expect(getUserFailing(empty(409))).rejects.toBeInstanceOf(ConflictException);
    await expect(getUserFailing(empty(404))).rejects.toBeInstanceOf(NotFoundException);
    await expect(getUserFailing(empty(403))).rejects.toBeInstanceOf(BadGatewayException);
    await expect(
      getUserFailing(json({ errorMessage: 'Password policy not met' }, 400)),
    ).rejects.toThrow('Password policy not met');
    await expect(
      getUserFailing(json({ errorMessage: 'x' }, 400)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('si no hay secreto configurado avisa sin llamar a Keycloak', async () => {
    const service = createService({ KEYCLOAK_ADMIN_CLIENT_SECRET: undefined });

    await expect(service.listUsers()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si Keycloak rechaza las credenciales de la API lo explica', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'unauthorized_client' }, 401));

    await expect(createService().listUsers()).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('si no se puede conectar con Keycloak da 503', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(createService().listUsers()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('exige que KEYCLOAK_ISSUER_URL tenga la forma <url>/realms/<realm>', async () => {
    const service = createService({ KEYCLOAK_ISSUER_URL: 'http://keycloak.test' });

    await expect(service.listUsers()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('createUser envía la contraseña temporal y devuelve el id que viene en Location', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(empty(201, { location: `${adminUrl}/users/abc-123` }));

    const id = await createService().createUser({
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Gómez',
      password: 'Temporal#1',
      temporary: true,
    });

    expect(id).toBe('abc-123');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${adminUrl}/users`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      username: 'ana@example.com',
      email: 'ana@example.com',
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: 'Temporal#1', temporary: true }],
    });
  });

  it('updateUser conserva los datos que no cambian', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        json({ id: 'u1', username: 'ana@example.com', email: 'ana@example.com', enabled: true }),
      )
      .mockResolvedValueOnce(empty());

    await createService().updateUser('u1', { enabled: false, email: undefined });

    const [url, init] = fetchMock.mock.calls[2];
    expect(url).toBe(`${adminUrl}/users/u1`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({
      id: 'u1',
      username: 'ana@example.com',
      email: 'ana@example.com',
      enabled: false,
    });
  });

  it('setRealmRole asigna el rol nuevo y quita los otros roles de la app, sin tocar los de Keycloak', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        json([
          { id: 'r-admin', name: 'admin' },
          { id: 'r-docente', name: 'docente' },
          { id: 'r-offline', name: 'offline_access' },
        ]),
      )
      .mockResolvedValueOnce(empty())
      .mockResolvedValueOnce(empty());

    await createService().setRealmRole('u1', 'admin', ['admin', 'docente']);

    const path = `${adminUrl}/users/u1/role-mappings/realm`;
    const [addUrl, addInit] = fetchMock.mock.calls[2];
    expect([addUrl, addInit.method]).toEqual([path, 'POST']);
    expect(JSON.parse(addInit.body)).toEqual([{ id: 'r-admin', name: 'admin' }]);

    const [removeUrl, removeInit] = fetchMock.mock.calls[3];
    expect([removeUrl, removeInit.method]).toEqual([path, 'DELETE']);
    expect(JSON.parse(removeInit.body)).toEqual([{ id: 'r-docente', name: 'docente' }]);
  });

  it('setRealmRole avisa si el rol no existe en el realm', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json([{ id: 'r-docente', name: 'docente' }]));

    await expect(
      createService().setRealmRole('u1', 'admin', ['admin', 'docente']),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('listUserIdsByRole avisa si el rol no existe en el realm', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(empty(404));

    await expect(createService().listUserIdsByRole('admin')).rejects.toThrow(
      'El rol "admin" no existe en Keycloak',
    );
  });
});
