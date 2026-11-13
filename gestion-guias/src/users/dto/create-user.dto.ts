import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { Role } from '../entities/user.entity.js';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MESSAGE, FULL_NAME_PATTERN } from '../user-name.js';

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(FULL_NAME_MAX_LENGTH, { message: `El nombre admite máximo ${FULL_NAME_MAX_LENGTH} caracteres` }) @Matches(FULL_NAME_PATTERN, { message: FULL_NAME_MESSAGE }) name: string;
  @IsEmail() email: string;
  /** Opcional: si no se envía, la API genera una contraseña temporal y la devuelve una sola vez. */
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}
