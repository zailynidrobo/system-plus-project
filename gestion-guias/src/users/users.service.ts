import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  KeycloakAdminService,
  type KeycloakUser,
} from './keycloak-admin.service.js';
import { Role } from './role.js';
import { generateTemporaryPassword } from './temporary-password.js';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  isActive: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly keycloak: KeycloakAdminService) {}

  private toResponse(user: KeycloakUser, role: Role | null): UserResponse {
    return {
      id: user.id,
      name: user.firstName ?? user.username,
      email: user.email ?? user.username,
      role,
      isActive: user.enabled,
    };
  }

  private async getOrFail(id: string) {
    const [user, roles] = await Promise.all([
      this.keycloak.getUser(id),
      this.keycloak.getUserRealmRoles(id),
    ]);
    const role = roles.find((candidate): candidate is Role =>
      Object.values(Role).some(
        (applicationRole) => applicationRole === candidate,
      ),
    );
    if (!role) throw new NotFoundException('Usuario no encontrado');
    return { user, role };
  }

  async create(dto: CreateUserDto) {
    const role = dto.role ?? Role.DOCENTE;
    const generatedTemporaryPassword = dto.password === undefined;
    const password = dto.password ?? generateTemporaryPassword();
    const email = dto.email.trim().toLowerCase();
    const keycloakUserId = await this.keycloak.createUser({
      email,
      firstName: dto.name,
      password,
      temporary: generatedTemporaryPassword,
    });
    try {
      await this.keycloak.setRealmRole(
        keycloakUserId,
        role,
        Object.values(Role),
      );
      return {
        id: keycloakUserId,
        name: dto.name,
        email,
        role,
        isActive: true,
        ...(generatedTemporaryPassword ? { temporaryPassword: password } : {}),
      };
    } catch {
      try {
        await this.keycloak.deleteUser(keycloakUserId);
      } catch {
        throw new InternalServerErrorException(
          'No se pudo asignar el rol y tampoco revertir el usuario creado en Keycloak',
        );
      }
      throw new InternalServerErrorException(
        'No se pudo asignar el rol en Keycloak; se revirtió el alta',
      );
    }
  }

  async findAll() {
    const [users, roleUsers] = await Promise.all([
      this.keycloak.listUsers(),
      Promise.all(
        Object.values(Role).map(
          async (role) =>
            [role, await this.keycloak.listUserIdsByRole(role)] as const,
        ),
      ),
    ]);
    const rolesByUser = new Map<string, Role>();
    for (const [role, ids] of roleUsers) {
      for (const id of ids) {
        if (!rolesByUser.has(id)) rolesByUser.set(id, role);
      }
    }
    return users
      .filter((user) => rolesByUser.has(user.id))
      .map((user) => this.toResponse(user, rolesByUser.get(user.id) ?? null));
  }

  async findOne(id: string) {
    const { user, role } = await this.getOrFail(id);
    return this.toResponse(user, role);
  }

  async findByEmail(email: string) {
    return (
      (await this.findAll()).find(
        (user) =>
          user.email.toLowerCase() === email.trim().toLowerCase() &&
          user.isActive,
      ) ?? null
    );
  }

  async update(id: string, dto: UpdateUserDto) {
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.password === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }

    const { role } = await this.getOrFail(id);
    const email = dto.email?.trim().toLowerCase();
    await this.keycloak.updateUser(id, {
      ...(dto.name === undefined ? {} : { firstName: dto.name }),
      ...(email === undefined ? {} : { email }),
    });
    if (dto.password !== undefined) {
      await this.keycloak.setPassword(id, dto.password, false);
    }
    return this.toResponse(await this.keycloak.getUser(id), role);
  }

  async deactivate(id: string) {
    const { user, role } = await this.getOrFail(id);
    if (user.enabled) await this.keycloak.updateUser(id, { enabled: false });
    return this.toResponse({ ...user, enabled: false }, role);
  }

  async updateRole(id: string, dto: { role: Role }) {
    const { user, role } = await this.getOrFail(id);
    if (role !== dto.role) {
      await this.keycloak.setRealmRole(id, dto.role, Object.values(Role));
    }
    return this.toResponse(user, dto.role);
  }
}
