import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../entities/user.entity.js';

export class CreateUserDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @MinLength(8) password: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}