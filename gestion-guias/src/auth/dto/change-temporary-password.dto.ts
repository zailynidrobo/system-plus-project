import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Primer ingreso de un usuario creado con contraseña temporal. */
export class ChangeTemporaryPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(/[A-ZÁÉÍÓÚÑ]/, {
    message: 'La contraseña debe tener al menos una mayúscula',
  })
  @Matches(/[a-záéíóúñ]/, {
    message: 'La contraseña debe tener al menos una minúscula',
  })
  @Matches(/\d/, { message: 'La contraseña debe tener al menos un número' })
  newPassword: string;
}
