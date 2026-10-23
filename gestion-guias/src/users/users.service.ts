import { BadRequestException, Injectable } from '@nestjs/common';
import { Role, User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { KeycloakAdminService, KeycloakUser } from './keycloak-admin.service.js';
import { generateTemporaryPassword } from './temporary-password.js';
import { joinName, splitName } from './user-name.js';

const ROLES = Object.values(Role);

// HE-01 exige un solo rol activo. Si en Keycloak llegara a tener varios, gana el de mayor jerarquía.
const ROLE_PRIORITY: Role[] = [
  Role.ADMIN,
  Role.COORDINADOR,
  Role.DOCENTE_AUTORIZADO,
  Role.DOCENTE,
];

/** Respuesta de la creación: la contraseña solo viaja si la generó la API. */
export type CreatedUser = User & { temporaryPassword?: string };

/** Gestión de usuarios (HE-01) sobre Keycloak: ahí viven las cuentas, las contraseñas y los roles. */
@Injectable()
export class UsersService {
  constructor(private readonly keycloak: KeycloakAdminService) {}

  private pickRole(roleNames: string[]): Role | null {
    return ROLE_PRIORITY.find((role) => roleNames.includes(role)) ?? null;
  }

  private toUser(user: KeycloakUser, role: Role | null): User {
    return {
      id: user.id,
      name: joinName(user),
      email: user.email ?? user.username,
      role,
      isActive: user.enabled,
      createdAt: user.createdTimestamp
        ? new Date(user.createdTimestamp).toISOString()
        : undefined,
    };
  }

  async create(dto: CreateUserDto): Promise<CreatedUser> { // HU-01
    const generated = dto.password === undefined;
    const password = dto.password ?? generateTemporaryPassword();

    // La contraseña es siempre temporal: quien la recibe debe cambiarla en su primer ingreso.
    const id = await this.keycloak.createUser({
      email: dto.email.trim().toLowerCase(),
      ...splitName(dto.name),
      password,
      temporary: true,
    });

    try {
      await this.keycloak.setRealmRole(id, dto.role ?? Role.DOCENTE, ROLES);
    } catch (error) {
      // Sin rol la cuenta no serviría: se deshace para no dejar usuarios a medias.
      await this.keycloak.deleteUser(id).catch(() => undefined);
      throw error;
    }

    const created = await this.findOne(id);
    return generated ? { ...created, temporaryPassword: password } : created;
  }

  async findAll(): Promise<User[]> {
    // Una consulta por rol en vez de una por usuario: son 4 en total, sin importar cuántos usuarios haya.
    const [users, roleMembers] = await Promise.all([
      this.keycloak.listUsers(),
      Promise.all(
        ROLES.map(async (role) => [role, await this.keycloak.listUserIdsByRole(role)] as const),
      ),
    ]);

    return users
      .filter((user) => !user.username.startsWith('service-account-'))
      .map((user) => {
        const roles = roleMembers.filter(([, ids]) => ids.has(user.id)).map(([role]) => role);
        return this.toUser(user, this.pickRole(roles));
      });
  }

  /** Docentes activos que coordinación puede asignar a un módulo (HE-04). */
  async findTeachers(): Promise<Pick<User, 'id' | 'name' | 'email' | 'role'>[]> {
    const users = await this.findAll();
    return users
      .filter(
        (user) =>
          user.isActive &&
          (user.role === Role.DOCENTE || user.role === Role.DOCENTE_AUTORIZADO),
      )
      .map(({ id, name, email, role }) => ({ id, name, email, role }));
  }

  async findOne(id: string): Promise<User> {
    const [user, roleNames] = await Promise.all([
      this.keycloak.getUser(id),
      this.keycloak.getUserRealmRoles(id),
    ]);
    return this.toUser(user, this.pickRole(roleNames));
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.name === undefined && dto.email === undefined && dto.password === undefined) {
      throw new BadRequestException('Debe proporcionar al menos un dato para actualizar');
    }

    if (dto.name !== undefined || dto.email !== undefined) {
      const name = dto.name === undefined ? undefined : splitName(dto.name);
      await this.keycloak.updateUser(id, {
        email: dto.email?.trim().toLowerCase(),
        firstName: name?.firstName,
        // Si el nombre nuevo no trae apellido, se borra el anterior para que no queden mezclados
        lastName: name ? (name.lastName ?? '') : undefined,
      });
    }

    if (dto.password !== undefined) {
      // Quien cambia la contraseña es un administrador, así que el usuario debe cambiarla al ingresar.
      await this.keycloak.setPassword(id, dto.password, true);
    }

    return this.findOne(id);
  }

  async deactivate(id: string): Promise<User> { // HU-03
    await this.keycloak.updateUser(id, { enabled: false });
    // Desactivar no borra al usuario; solo impide nuevos ingresos y cierra sus sesiones abiertas.
    await this.keycloak.logoutUser(id).catch(() => undefined);
    return this.findOne(id);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<User> { // HU-04
    await this.keycloak.getUser(id);
    await this.keycloak.setRealmRole(id, dto.role, ROLES);
    return this.findOne(id);
  }
}
