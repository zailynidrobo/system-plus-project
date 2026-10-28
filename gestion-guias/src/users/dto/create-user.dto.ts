import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '../entities/user.entity.js';
import { FULL_NAME_MESSAGE, FULL_NAME_PATTERN } from '../user-name.js';

export class CreateUserDto {
  @IsString() @IsNotEmpty() @Matches(FULL_NAME_PATTERN, { message: FULL_NAME_MESSAGE }) name: string;
  @IsEmail() email: string;
  /** Opcional: si no se envía, la API genera una contraseña temporal y la devuelve una sola vez. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}
