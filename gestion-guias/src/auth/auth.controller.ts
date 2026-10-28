import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from './public.decorator.js';
import { AuthService } from './auth.service.js';
import { ChangeTemporaryPasswordDto } from './dto/change-temporary-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshSessionDto } from './dto/refresh-session.dto.js';

/** Sesión del formulario propio de System Plus. Son rutas públicas: todavía no hay token. */
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshSessionDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshSessionDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('temporary-password')
  @HttpCode(HttpStatus.OK)
  changeTemporaryPassword(@Body() dto: ChangeTemporaryPasswordDto) {
    return this.auth.changeTemporaryPassword(dto);
  }
}
