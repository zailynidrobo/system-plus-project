import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role, User } from './entities/user.entity.js';
import { KeycloakUsersService } from './keycloak-users.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let users: User[];
  let keycloak: {
    createUser: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
    changeRole: ReturnType<typeof vi.fn>;
    setEnabled: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    users = [];
    const repository = {
      find: vi.fn(async () => [...users]),
      findOneBy: vi.fn(
        async (where: Partial<User>) =>
          users.find((user) =>
            Object.entries(where).every(
              ([key, value]) => user[key as keyof User] === value,
            ),
          ) ?? null,
      ),
      save: vi.fn(async (user: User) => {
        if (!user.id) user.id = `user-${users.length + 1}`;
        const index = users.findIndex((stored) => stored.id === user.id);
        if (index === -1) users.push(user);
        else users[index] = user;
        return user;
      }),
    };
    keycloak = {
      createUser: vi.fn(async () => 'keycloak-user-1'),
      updateUser: vi.fn(async () => undefined),
      resetPassword: vi.fn(async () => undefined),
      changeRole: vi.fn(async () => undefined),
      setEnabled: vi.fn(async () => undefined),
      deleteUser: vi.fn(async () => undefined),
    };
    service = new UsersService(
      repository as unknown as Repository<User>,
      keycloak as unknown as KeycloakUsersService,
    );
  });

  it('creates a Keycloak account and stores its linked record in PostgreSQL', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: ' Usuario@Example.com ',
      password: 'password123',
    });

    expect(created).toMatchObject({
      id: 'user-1',
      name: 'Usuario',
      email: 'usuario@example.com',
      role: Role.DOCENTE,
      isActive: true,
    });
    expect(created).not.toHaveProperty('password');
    expect(created).not.toHaveProperty('keycloakUserId');
    expect(keycloak.createUser).toHaveBeenCalledWith({
      name: 'Usuario',
      email: 'usuario@example.com',
      password: 'password123',
      role: Role.DOCENTE,
    });
    expect(await bcrypt.compare('password123', users[0].password)).toBe(true);
    expect(users[0].keycloakUserId).toBe('keycloak-user-1');
  });

  it('rejects duplicate emails before creating an identity in Keycloak', async () => {
    await service.create({
      name: 'Primero',
      email: 'primero@example.com',
      password: 'password123',
    });

    await expect(
      service.create({
        name: 'Duplicado',
        email: 'PRIMERO@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(keycloak.createUser).toHaveBeenCalledTimes(1);
  });

  it('updates local data and synchronizes profile and password with Keycloak', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: 'usuario@example.com',
      password: 'password123',
    });

    const updated = await service.update(created.id, {
      name: 'Usuario actualizado',
      email: 'actualizado@example.com',
      password: 'newpassword123',
    });
    const storedUser = await service.findByEmail('ACTUALIZADO@example.com');

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Usuario actualizado',
      email: 'actualizado@example.com',
      isActive: true,
    });
    expect(updated).not.toHaveProperty('password');
    expect(storedUser).toBeDefined();
    expect(storedUser).toBeDefined();
    if (!storedUser) throw new Error('No se encontró el usuario actualizado');
    await expect(
      bcrypt.compare('newpassword123', storedUser.password),
    ).resolves.toBe(true);
    expect(keycloak.updateUser).toHaveBeenCalledWith('keycloak-user-1', {
      email: 'actualizado@example.com',
      firstName: 'Usuario actualizado',
      enabled: true,
    });
    expect(keycloak.resetPassword).toHaveBeenCalledWith(
      'keycloak-user-1',
      'newpassword123',
    );
  });

  it('rejects an update with no fields', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: 'usuario@example.com',
      password: 'password123',
    });

    await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('synchronizes role changes and deactivation to Keycloak', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: 'usuario@example.com',
      password: 'password123',
    });

    const roleUpdated = await service.updateRole(created.id, {
      role: Role.COORDINADOR,
    });
    expect(roleUpdated.role).toBe(Role.COORDINADOR);
    expect(keycloak.changeRole).toHaveBeenCalledWith(
      'keycloak-user-1',
      Role.DOCENTE,
      Role.COORDINADOR,
    );

    const deactivated = await service.deactivate(created.id);
    expect(deactivated.isActive).toBe(false);
    expect(keycloak.setEnabled).toHaveBeenCalledWith('keycloak-user-1', false);
    expect(await service.findAll()).toHaveLength(1);
    expect((await service.findOne(created.id)).isActive).toBe(false);
    expect(await service.findByEmail('usuario@example.com')).toBeNull();
  });

  it('reverts the newly created Keycloak account if database persistence fails', async () => {
    const repository = service['users'];
    vi.spyOn(repository, 'save').mockRejectedValueOnce(
      new Error('database down'),
    );
    service = new UsersService(
      repository,
      keycloak as unknown as KeycloakUsersService,
    );

    await expect(
      service.create({
        name: 'Usuario',
        email: 'usuario@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('se revirtió el alta en Keycloak');
    expect(keycloak.deleteUser).toHaveBeenCalledWith('keycloak-user-1');
  });
});
