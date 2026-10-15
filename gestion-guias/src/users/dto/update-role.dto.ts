import { IsEnum } from 'class-validator';
import { Role } from '../role.js';

export class UpdateRoleDto {
  @IsEnum(Role)
  role: Role;
}
