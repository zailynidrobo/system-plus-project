import { IsNotEmpty, IsString } from 'class-validator';

/** Se usa para renovar la sesión y para cerrarla. */
export class RefreshSessionDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
