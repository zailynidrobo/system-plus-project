import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role, User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  private users: User[] = [];

  private safe(user: User) {
    const { password: _password, ...rest } = user;
    return rest;
  }

  private getOrFail(id: string) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto) { // HU-01
    if (this.users.some((u) => u.email === dto.email)) {
      throw new ConflictException('El correo ya está registrado');
    }
    const user: User = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      role: dto.role ?? Role.DOCENTE,
      isActive: true,
    };
    this.users.push(user);
    return this.safe(user);
  }

  findAll() {
    return this.users.map((u) => this.safe(u));
  }

  findOne(id: string) {
    return this.safe(this.getOrFail(id));
  }

  findByEmail(email: string) {
    return this.users.find((u) => u.email === email && u.isActive);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = this.getOrFail(id);

    if (dto.name === undefined && dto.email === undefined && dto.password === undefined) {
      throw new BadRequestException('Debe proporcionar al menos un dato para actualizar');
    }

    if (dto.email !== undefined && this.users.some((u) => u.id !== id && u.email === dto.email)) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword =
      dto.password === undefined ? undefined : await bcrypt.hash(dto.password, 10);

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (hashedPassword !== undefined) user.password = hashedPassword;

    return this.safe(user);
  }

  deactivate(id: string) { // HU-03
    const user = this.getOrFail(id);
    user.isActive = false;
    return this.safe(user);
  }

  updateRole(id: string, dto: { role: Role }) { // HU-04
    const user = this.getOrFail(id);
    user.role = dto.role;
    return this.safe(user);
  }
}