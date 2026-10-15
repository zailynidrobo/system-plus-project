import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Role, User } from './entities/user.entity.js';
import { KeycloakUsersService } from './keycloak-users.service.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly keycloakUsers: KeycloakUsersService,
  ) {}

  private safe(user: User) {
    const {
      password: _password,
      keycloakUserId: _keycloakUserId,
      ...rest
    } = user;
    return rest;
  }

  private async getOrFail(id: string) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findOneBy({ email })) {
      throw new ConflictException('El correo ya está registrado');
    }

    const role = dto.role ?? Role.DOCENTE;
    const keycloakUserId = await this.keycloakUsers.createUser({
      name: dto.name,
      email,
      password: dto.password,
      role,
    });
    try {
      const user = await this.users.save({
        name: dto.name,
        email,
        password: await bcrypt.hash(dto.password, 10),
        role,
        isActive: true,
        keycloakUserId,
      });
      return this.safe(user);
    } catch {
      try {
        await this.keycloakUsers.deleteUser(keycloakUserId);
      } catch {
        throw new InternalServerErrorException(
          'No se pudo guardar el usuario y tampoco revertirlo en Keycloak',
        );
      }
      throw new InternalServerErrorException(
        'No se pudo guardar el usuario en PostgreSQL; se revirtió el alta en Keycloak',
      );
    }
  }

  async findAll() {
    return (await this.users.find()).map((user) => this.safe(user));
  }

  async findOne(id: string) {
    return this.safe(await this.getOrFail(id));
  }

  async findByEmail(email: string) {
    const user = await this.users.findOneBy({
      email: email.trim().toLowerCase(),
      isActive: true,
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.getOrFail(id);
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.password === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }

    const oldUser = Object.assign(new User(), user);
    const email = dto.email?.trim().toLowerCase();
    if (email !== undefined) {
      const duplicate = await this.users.findOneBy({ email });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('El correo ya está registrado');
      }
    }

    const updatedName = dto.name ?? user.name;
    const updatedEmail = email ?? user.email;
    const hashedPassword =
      dto.password === undefined
        ? undefined
        : await bcrypt.hash(dto.password, 10);
    await this.keycloakUsers.updateUser(user.keycloakUserId, {
      email: updatedEmail,
      firstName: updatedName,
      enabled: user.isActive,
    });
    if (dto.name !== undefined) user.name = dto.name;
    if (email !== undefined) user.email = email;
    if (hashedPassword !== undefined) user.password = hashedPassword;

    let saved: User;
    try {
      saved = await this.users.save(user);
    } catch {
      await this.restoreKeycloakProfile(oldUser);
      throw new InternalServerErrorException(
        'No se pudo guardar la edición en PostgreSQL; se restauró el perfil de Keycloak',
      );
    }

    if (dto.password !== undefined) {
      try {
        await this.keycloakUsers.resetPassword(
          saved.keycloakUserId,
          dto.password,
        );
      } catch (error) {
        try {
          await this.users.save(oldUser);
          await this.restoreKeycloakProfile(oldUser);
        } catch {
          throw new InternalServerErrorException(
            'Falló el cambio de contraseña y no se pudo restaurar el estado anterior; verifica ambos sistemas',
          );
        }
        throw error;
      }
    }
    return this.safe(saved);
  }

  async deactivate(id: string) {
    const user = await this.getOrFail(id);
    if (!user.isActive) return this.safe(user);

    await this.keycloakUsers.setEnabled(user.keycloakUserId, false);
    user.isActive = false;
    try {
      return this.safe(await this.users.save(user));
    } catch {
      try {
        await this.keycloakUsers.setEnabled(user.keycloakUserId, true);
      } catch {
        throw new InternalServerErrorException(
          'No se pudo guardar la desactivación ni reactivar la cuenta en Keycloak',
        );
      }
      throw new InternalServerErrorException(
        'No se pudo guardar la desactivación en PostgreSQL; se reactivó la cuenta de Keycloak',
      );
    }
  }

  async updateRole(id: string, dto: { role: Role }) {
    const user = await this.getOrFail(id);
    if (user.role === dto.role) return this.safe(user);

    const oldRole = user.role;
    await this.keycloakUsers.changeRole(user.keycloakUserId, oldRole, dto.role);
    user.role = dto.role;
    try {
      return this.safe(await this.users.save(user));
    } catch {
      try {
        await this.keycloakUsers.changeRole(
          user.keycloakUserId,
          dto.role,
          oldRole,
        );
      } catch {
        throw new InternalServerErrorException(
          'No se pudo guardar ni restaurar el rol; verifica PostgreSQL y Keycloak',
        );
      }
      throw new InternalServerErrorException(
        'No se pudo guardar el rol en PostgreSQL; se restauró el rol de Keycloak',
      );
    }
  }

  private async restoreKeycloakProfile(user: User) {
    await this.keycloakUsers.updateUser(user.keycloakUserId, {
      email: user.email,
      firstName: user.name,
      enabled: user.isActive,
    });
  }
}
