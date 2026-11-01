import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from './entities/user.entity.js';
import { KeycloakAdminService, KeycloakUser, NewKeycloakUser } from './keycloak-admin.service.js';
import { UsersService } from './users.service.js';

/** Keycloak en memoria: imita lo justo de la API de administración para probar las reglas del servicio. */
class FakeKeycloakAdmin {
  users = new Map<string, KeycloakUser>();
  roles = new Map<string, Set<string>>();
  passwords = new Map<string, { value: string; temporary: boolean }>();
  loggedOut: string[] = [];
  failRoleAssignment = false;
  private nextId = 1;

  async listUsers() {
    return [...this.users.values()];
  }

  async listUserIdsByRole(role: string) {
    return new Set([...this.roles].filter(([, names]) => names.has(role)).map(([id]) => id));
  }

  async getUser(id: string) {
    const user = this.users.get(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async getUserRealmRoles(id: string) {
    await this.getUser(id);
    return [...(this.roles.get(id) ?? [])];
  }

  async createUser(input: NewKeycloakUser) {
    this.assertEmailFree(input.email);
    const id = `user-${this.nextId++}`;
    this.users.set(id, {
      id,
      username: input.email,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      createdTimestamp: Date.UTC(2026, 9, 13),
    });
    this.passwords.set(id, { value: input.password, temporary: input.temporary });
    return id;
  }

  async updateUser(id: string, changes: Partial<KeycloakUser>) {
    const user = await this.getUser(id);
    if (changes.email !== undefined) this.assertEmailFree(changes.email, id);
    const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
    this.users.set(id, { ...user, ...defined });
  }

  async setPassword(id: string, value: string, temporary: boolean) {
    this.passwords.set(id, { value, temporary });
  }

  async logoutUser(id: string) {
    this.loggedOut.push(id);
  }

  async deleteUser(id: string) {
    this.users.delete(id);
    this.roles.delete(id);
  }

  async setRealmRole(id: string, role: string, managedRoles: string[]) {
    if (this.failRoleAssignment) throw new Error('Keycloak no pudo asignar el rol');
    const names = this.roles.get(id) ?? new Set<string>();
    managedRoles.forEach((managed) => names.delete(managed));
    names.add(role);
    this.roles.set(id, names);
  }

  private assertEmailFree(email: string, exceptId?: string) {
    const taken = [...this.users.values()].some((u) => u.id !== exceptId && u.email === email);
    if (taken) throw new ConflictException('El correo ya está registrado');
  }
}

describe('UsersService (HE-01 sobre Keycloak)', () => {
  let keycloak: FakeKeycloakAdmin;
  let service: UsersService;

  beforeEach(() => {
    keycloak = new FakeKeycloakAdmin();
    service = new UsersService(keycloak as unknown as KeycloakAdminService);
  });

  describe('create (HU-01)', () => {
    it('crea el usuario con el rol docente por defecto, correo en minúscula y nombre separado', async () => {
      const created = await service.create({
        name: 'María Camila Rojas',
        email: 'Maria.Rojas@Example.com',
        password: 'password123',
      });

      expect(created).toMatchObject({
        name: 'María Camila Rojas',
        email: 'maria.rojas@example.com',
        role: Role.DOCENTE,
        isActive: true,
      });
      expect(keycloak.users.get(created.id)).toMatchObject({
        firstName: 'María',
        lastName: 'Camila Rojas',
      });
    });

    it('con contraseña propia no devuelve ninguna contraseña, y queda como temporal', async () => {
      const created = await service.create({
        name: 'Usuario',
        email: 'usuario@example.com',
        password: 'password123',
      });

      expect(created).not.toHaveProperty('temporaryPassword');
      expect(keycloak.passwords.get(created.id)).toEqual({ value: 'password123', temporary: true });
    });

    it('sin contraseña genera una temporal y la devuelve una sola vez', async () => {
      const created = await service.create({ name: 'Usuario', email: 'usuario@example.com' });

      expect(created.temporaryPassword).toHaveLength(12);
      expect(keycloak.passwords.get(created.id)).toEqual({
        value: created.temporaryPassword,
        temporary: true,
      });
      expect(await service.findOne(created.id)).not.toHaveProperty('temporaryPassword');
    });

    it('asigna el rol pedido', async () => {
      const created = await service.create({
        name: 'Coordinadora',
        email: 'coordinadora@example.com',
        role: Role.COORDINADOR,
      });

      expect(created.role).toBe(Role.COORDINADOR);
    });

    it('rechaza un correo ya registrado', async () => {
      await service.create({ name: 'Primero', email: 'repetido@example.com' });

      await expect(
        service.create({ name: 'Segundo', email: 'REPETIDO@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('si falla la asignación del rol, no deja el usuario creado a medias', async () => {
      keycloak.failRoleAssignment = true;

      await expect(
        service.create({ name: 'Usuario', email: 'usuario@example.com' }),
      ).rejects.toThrow('Keycloak no pudo asignar el rol');
      expect(keycloak.users.size).toBe(0);
    });
  });

  describe('findAll / findOne', () => {
    it('lista a todos con su rol y oculta las cuentas de servicio', async () => {
      await service.create({ name: 'Admin', email: 'admin@example.com', role: Role.ADMIN });
      await service.create({ name: 'Docente', email: 'docente@example.com' });
      keycloak.users.set('sa-1', {
        id: 'sa-1',
        username: 'service-account-system-plus-api',
        enabled: true,
      });
      keycloak.users.set('sin-rol', {
        id: 'sin-rol',
        username: 'sinrol@example.com',
        email: 'sinrol@example.com',
        enabled: true,
      });

      const users = await service.findAll();

      expect(users.map((u) => [u.email, u.role])).toEqual([
        ['admin@example.com', Role.ADMIN],
        ['docente@example.com', Role.DOCENTE],
        ['sinrol@example.com', null],
      ]);
    });

    it('si Keycloak le dejó varios roles, gana el de mayor jerarquía', async () => {
      const created = await service.create({ name: 'Usuario', email: 'usuario@example.com' });
      keycloak.roles.set(created.id, new Set([Role.DOCENTE, Role.COORDINADOR]));

      expect((await service.findOne(created.id)).role).toBe(Role.COORDINADOR);
    });

    it('findOne de un usuario inexistente da 404', async () => {
      await expect(service.findOne('no-existe')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findTeachers (HE-04)', () => {
    it('lista solo docentes y docentes autorizados activos, sin datos de más', async () => {
      const docente = await service.create({ name: 'Docente Uno', email: 'docente@example.com' });
      const autorizado = await service.create({
        name: 'Autorizado Uno',
        email: 'autorizado@example.com',
        role: Role.DOCENTE_AUTORIZADO,
      });
      const baja = await service.create({ name: 'Docente Baja', email: 'baja@example.com' });
      await service.deactivate(baja.id);
      await service.create({
        name: 'Coordinadora',
        email: 'coordinadora@example.com',
        role: Role.COORDINADOR,
      });

      const teachers = await service.findTeachers();

      expect(teachers.map((teacher) => teacher.id).sort()).toEqual([autorizado.id, docente.id].sort());
      expect(teachers[0]).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
      });
    });
  });

  describe('update (HU-02)', () => {
    it('actualiza nombre y correo, y no toca el rol', async () => {
      const created = await service.create({
        name: 'Usuario Anterior',
        email: 'usuario@example.com',
        role: Role.DOCENTE_AUTORIZADO,
      });

      const updated = await service.update(created.id, {
        name: 'Usuario Actualizado',
        email: 'Actualizado@example.com',
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: 'Usuario Actualizado',
        email: 'actualizado@example.com',
        role: Role.DOCENTE_AUTORIZADO,
        isActive: true,
      });
    });

    it('un nombre sin apellido borra el apellido anterior', async () => {
      const created = await service.create({ name: 'Ana María Gómez', email: 'ana@example.com' });

      const updated = await service.update(created.id, { name: 'Ana' });

      expect(updated.name).toBe('Ana');
    });

    it('cambiar la contraseña la deja como temporal', async () => {
      const created = await service.create({
        name: 'Usuario',
        email: 'usuario@example.com',
        password: 'password123',
      });

      await service.update(created.id, { password: 'newpassword123' });

      expect(keycloak.passwords.get(created.id)).toEqual({
        value: 'newpassword123',
        temporary: true,
      });
    });

    it('rechaza un correo asignado a otro usuario', async () => {
      const first = await service.create({ name: 'Primero', email: 'primero@example.com' });
      await service.create({ name: 'Segundo', email: 'segundo@example.com' });

      await expect(
        service.update(first.id, { email: 'segundo@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza una actualización vacía', async () => {
      const created = await service.create({ name: 'Usuario', email: 'usuario@example.com' });

      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deactivate (HU-03)', () => {
    it('desactiva sin borrar al usuario y cierra sus sesiones', async () => {
      const created = await service.create({ name: 'Usuario', email: 'usuario@example.com' });

      const deactivated = await service.deactivate(created.id);

      expect(deactivated.isActive).toBe(false);
      expect(await service.findAll()).toHaveLength(1);
      expect((await service.findOne(created.id)).isActive).toBe(false);
      expect(keycloak.loggedOut).toEqual([created.id]);
    });

    it('desactiva aunque no se puedan cerrar las sesiones', async () => {
      const created = await service.create({ name: 'Usuario', email: 'usuario@example.com' });
      keycloak.logoutUser = async () => {
        throw new Error('sin sesiones');
      };

      expect((await service.deactivate(created.id)).isActive).toBe(false);
    });

    it('un administrador no puede desactivarse a sí mismo', async () => {
      const admin = await service.create({ name: 'Admin', email: 'admin@example.com', role: Role.ADMIN });

      await expect(service.deactivate(admin.id, admin.id)).rejects.toBeInstanceOf(BadRequestException);
      expect((await service.findOne(admin.id)).isActive).toBe(true);
    });

    it('no deja desactivar al último administrador activo', async () => {
      const admin = await service.create({ name: 'Admin', email: 'admin@example.com', role: Role.ADMIN });

      await expect(service.deactivate(admin.id, 'otro')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sí deja desactivar a un administrador si queda otro activo', async () => {
      const a = await service.create({ name: 'Admin A', email: 'a@example.com', role: Role.ADMIN });
      const b = await service.create({ name: 'Admin B', email: 'b@example.com', role: Role.ADMIN });

      expect((await service.deactivate(b.id, a.id)).isActive).toBe(false);
    });
  });

  describe('updateRole (HU-04)', () => {
    it('reemplaza el rol anterior: el usuario queda con un solo rol', async () => {
      const created = await service.create({
        name: 'Usuario',
        email: 'usuario@example.com',
        role: Role.DOCENTE,
      });

      const updated = await service.updateRole(created.id, { role: Role.COORDINADOR });

      expect(updated.role).toBe(Role.COORDINADOR);
      expect(keycloak.roles.get(created.id)).toEqual(new Set([Role.COORDINADOR]));
    });

    it('un usuario inexistente da 404', async () => {
      await expect(
        service.updateRole('no-existe', { role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('un administrador no puede cambiarse su propio rol', async () => {
      const admin = await service.create({ name: 'Admin', email: 'admin@example.com', role: Role.ADMIN });

      await expect(
        service.updateRole(admin.id, { role: Role.DOCENTE }, admin.id),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no deja quitar el rol al último administrador activo', async () => {
      const admin = await service.create({ name: 'Admin', email: 'admin@example.com', role: Role.ADMIN });

      await expect(
        service.updateRole(admin.id, { role: Role.DOCENTE }, 'otro'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
