import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from './entities/user.entity.js';
import { KeycloakUsersService } from './keycloak-users.service.js';

describe('KeycloakUsersService', () => {
  let service: KeycloakUsersService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const values: Record<string, string> = {
      KEYCLOAK_ISSUER_URL: 'http://localhost:8080/realms/system-plus',
      KEYCLOAK_ADMIN_CLIENT_ID: 'system-plus-user-admin',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'test-secret',
    };
    service = new KeycloakUsersService({
      get: vi.fn((key: string) => values[key]),
    } as unknown as ConfigService);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a service token and provisions a Keycloak user with its realm role', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ access_token: 'service-token', expires_in: 300 }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: {
            location:
              'http://localhost:8080/admin/realms/system-plus/users/user-1',
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: 'role-1', name: Role.DOCENTE }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      service.createUser({
        name: 'Docente',
        email: 'docente@example.com',
        password: 'password123',
        role: Role.DOCENTE,
      }),
    ).resolves.toBe('user-1');

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0][0]).toContain(
      '/realms/system-plus/protocol/openid-connect/token',
    );
    expect(fetchMock.mock.calls[0][1].body.toString()).toContain(
      'grant_type=client_credentials',
    );
    expect(fetchMock.mock.calls[1][1].body).toContain('"temporary":false');
    expect(fetchMock.mock.calls[3][1].method).toBe('POST');
    expect(fetchMock.mock.calls[4][1].method).toBe('PUT');
  });

  it('reports a duplicate account from Keycloak as a conflict', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ access_token: 'service-token', expires_in: 300 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 409 }));

    await expect(
      service.createUser({
        name: 'Duplicado',
        email: 'duplicado@example.com',
        password: 'password123',
        role: Role.DOCENTE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports rejected service-account permissions explicitly', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ access_token: 'service-token', expires_in: 300 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    await expect(
      service.createUser({
        name: 'Docente',
        email: 'docente@example.com',
        password: 'password123',
        role: Role.DOCENTE,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns Keycloak validation details for rejected user edits', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ access_token: 'service-token', expires_in: 300 }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { errorMessage: 'Email is already used' },
          { status: 400 },
        ),
      );

    await expect(
      service.updateUser('user-1', {
        email: 'used@example.com',
        firstName: 'Usuario',
        enabled: true,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Keycloak rechazó los datos enviados: Email is already used',
      },
      status: 400,
    });
  });

  it('does not send the username attribute when updating a Keycloak profile', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ access_token: 'service-token', expires_in: 300 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await service.updateUser('user-1', {
      email: 'updated@example.com',
      firstName: 'Usuario editado',
      enabled: true,
    });

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({
      email: 'updated@example.com',
      firstName: 'Usuario editado',
      enabled: true,
    });
    expect(body).not.toHaveProperty('username');
  });
});
