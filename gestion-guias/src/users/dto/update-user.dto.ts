import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MESSAGE, FULL_NAME_PATTERN } from '../user-name.js';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FULL_NAME_MAX_LENGTH, { message: `El nombre admite máximo ${FULL_NAME_MAX_LENGTH} caracteres` })
  @Matches(FULL_NAME_PATTERN, { message: FULL_NAME_MESSAGE })
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}