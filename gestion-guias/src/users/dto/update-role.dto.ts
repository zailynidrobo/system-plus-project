import { IsEnum } from 'class-validator';
import { Role } from '../entities/user.entity.js';

export class UpdateRoleDto {
  @IsEnum(Role) role: Role;
}
