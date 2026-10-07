import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service.js';

describe('UsersService HU-02 and HU-03', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  it('updates user data and hashes a changed password', async () => {
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
    const storedUser = service.findByEmail('actualizado@example.com');

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Usuario actualizado',
      email: 'actualizado@example.com',
      isActive: true,
    });
    expect(updated).not.toHaveProperty('password');
    expect(storedUser).toBeDefined();
    if (!storedUser) throw new Error('No se encontró el usuario actualizado');
    await expect(bcrypt.compare('newpassword123', storedUser.password)).resolves.toBe(true);
  });

  it('rejects an email already assigned to another user', async () => {
    const first = await service.create({
      name: 'Primero',
      email: 'primero@example.com',
      password: 'password123',
    });
    await service.create({
      name: 'Segundo',
      email: 'segundo@example.com',
      password: 'password123',
    });

    await expect(
      service.update(first.id, { email: 'segundo@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an empty update', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: 'usuario@example.com',
      password: 'password123',
    });

    await expect(service.update(created.id, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deactivates without deleting the user or exposing them through active email lookup', async () => {
    const created = await service.create({
      name: 'Usuario',
      email: 'usuario@example.com',
      password: 'password123',
    });

    const deactivated = service.deactivate(created.id);

    expect(deactivated.isActive).toBe(false);
    expect(service.findAll()).toHaveLength(1);
    expect(service.findOne(created.id).isActive).toBe(false);
    expect(service.findByEmail('usuario@example.com')).toBeUndefined();
  });
});
