import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { KeycloakUser } from './keycloak-admin.service.js';
import { Role } from './role.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let keycloak: {
    listUsers: ReturnType<typeof vi.fn>;
    listUserIdsByRole: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    getUserRealmRoles: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    setRealmRole: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    setPassword: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };
  const user: KeycloakUser = {
    id: 'keycloak-user-1',
    username: 'usuario@example.com',
    email: 'usuario@example.com',
    firstName: 'Usuario',
    enabled: true,
  };

  beforeEach(() => {
    Object.assign(user, {
      id: 'keycloak-user-1',
      username: 'usuario@example.com',
      email: 'usuario@example.com',
      firstName: 'Usuario',
      enabled: true,
    });
    keycloak = {
      listUsers: vi.fn(async () => [user]),
      listUserIdsByRole: vi.fn(async () => new Set(['keycloak-user-1'])),
      getUser: vi.fn(async () => ({ ...user })),
      getUserRealmRoles: vi.fn(async () => [Role.DOCENTE]),
      createUser: vi.fn(async () => 'keycloak-user-1'),
      setRealmRole: vi.fn(async () => undefined),
      updateUser: vi.fn(async (_id: string, changes: Partial<KeycloakUser>) => {
        Object.assign(user, changes);
      }),
      setPassword: vi.fn(async () => undefined),
      deleteUser: vi.fn(async () => undefined),
    };
    service = new UsersService(keycloak as never);
  });

  it('creates and assigns the user entirely in Keycloak', async () => {
    await expect(
      service.create({
        name: 'Usuario',
        email: ' Usuario@Example.com ',
        password: 'password123',
      }),
    ).resolves.toEqual({
      id: 'keycloak-user-1',
      name: 'Usuario',
      email: 'usuario@example.com',
      role: Role.DOCENTE,
      isActive: true,
    });

    expect(keycloak.createUser).toHaveBeenCalledWith({
      email: 'usuario@example.com',
      firstName: 'Usuario',
      password: 'password123',
      temporary: false,
    });
    expect(keycloak.setRealmRole).toHaveBeenCalledWith(
      'keycloak-user-1',
      Role.DOCENTE,
      Object.values(Role),
    );
  });

  it('generates a one-time temporary password when one is omitted', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: 'usuario@example.com',
    });
    const temporaryPassword = created.temporaryPassword;

    expect(temporaryPassword).toEqual(expect.any(String));
    if (!temporaryPassword)
      throw new Error('No se generó la contraseña temporal');
    expect(temporaryPassword).toHaveLength(12);
    expect(keycloak.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        password: temporaryPassword,
        temporary: true,
      }),
    );
  });

  it('deletes the newly created Keycloak user when role assignment fails', async () => {
    keycloak.setRealmRole.mockRejectedValueOnce(
      new Error('Role assignment failed'),
    );

    await expect(
      service.create({
        name: 'Usuario',
        email: 'usuario@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('se revirtió el alta');
    expect(keycloak.deleteUser).toHaveBeenCalledWith('keycloak-user-1');
  });

  it('reports an error if role assignment and cleanup both fail', async () => {
    keycloak.setRealmRole.mockRejectedValueOnce(
      new Error('Role assignment failed'),
    );
    keycloak.deleteUser.mockRejectedValueOnce(new Error('Delete failed'));

    await expect(
      service.create({
        name: 'Usuario',
        email: 'usuario@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('lists only users assigned an application role in Keycloak', async () => {
    keycloak.listUsers.mockResolvedValueOnce([
      user,
      { ...user, id: 'unmanaged-user', username: 'otro@example.com' },
    ]);
    keycloak.listUserIdsByRole.mockImplementation(async (role: Role) =>
      role === Role.DOCENTE ? new Set(['keycloak-user-1']) : new Set<string>(),
    );

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 'keycloak-user-1',
        name: 'Usuario',
        email: 'usuario@example.com',
        role: Role.DOCENTE,
        isActive: true,
      },
    ]);
  });

  it('updates the Keycloak profile and password', async () => {
    await expect(
      service.update('keycloak-user-1', {
        name: 'Usuario actualizado',
        email: ' ACTUALIZADO@EXAMPLE.COM ',
        password: 'newpassword123',
      }),
    ).resolves.toMatchObject({
      id: 'keycloak-user-1',
      name: 'Usuario actualizado',
      email: 'actualizado@example.com',
      role: Role.DOCENTE,
    });

    expect(keycloak.updateUser).toHaveBeenCalledWith('keycloak-user-1', {
      firstName: 'Usuario actualizado',
      email: 'actualizado@example.com',
    });
    expect(keycloak.setPassword).toHaveBeenCalledWith(
      'keycloak-user-1',
      'newpassword123',
      false,
    );
  });

  it('rejects an update with no fields', async () => {
    await expect(service.update('keycloak-user-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(keycloak.getUser).not.toHaveBeenCalled();
  });

  it('deactivates users and updates their realm role in Keycloak', async () => {
    await expect(service.deactivate('keycloak-user-1')).resolves.toMatchObject({
      isActive: false,
    });
    expect(keycloak.updateUser).toHaveBeenCalledWith('keycloak-user-1', {
      enabled: false,
    });

    await expect(
      service.updateRole('keycloak-user-1', { role: Role.ADMIN }),
    ).resolves.toMatchObject({ role: Role.ADMIN });
    expect(keycloak.setRealmRole).toHaveBeenCalledWith(
      'keycloak-user-1',
      Role.ADMIN,
      Object.values(Role),
    );
  });
});
