import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../role.js';

export class CreateUserDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEmail() email: string;
  /** Opcional: si no se envía, la API genera una contraseña temporal y la devuelve una sola vez. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}
