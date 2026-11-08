import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Public } from './public.decorator.js';
import { AuthService } from './auth.service.js';
import { ChangeTemporaryPasswordDto } from './dto/change-temporary-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshSessionDto } from './dto/refresh-session.dto.js';
import { SessionAuditService } from '../audit/actions/session-audit.service.js';
import type { AuditRequest } from '../audit/actions/request-info.js';

/**
 * Sesión del formulario propio de System Plus. Son rutas públicas: todavía no hay token.
 * El inicio, el cierre y el cambio de contraseña temporal quedan en el registro de auditoría
 * (HE-08-HU-01); la renovación (`refresh`) no.
 */
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: SessionAuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: AuditRequest) {
    try {
      const session = await this.auth.login(dto);
      await this.audit.loginSucceeded(request, session);
      return session;
    } catch (error) {
      await this.audit.loginFailed(request, dto.email, error);
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshSessionDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshSessionDto, @Req() request: AuditRequest) {
    await this.auth.logout(dto.refreshToken);
    await this.audit.loggedOut(request, dto.refreshToken);
  }

  @Post('temporary-password')
  @HttpCode(HttpStatus.OK)
  async changeTemporaryPassword(
    @Body() dto: ChangeTemporaryPasswordDto,
    @Req() request: AuditRequest,
  ) {
    try {
      const session = await this.auth.changeTemporaryPassword(dto);
      await this.audit.temporaryPasswordChanged(request, session);
      return session;
    } catch (error) {
      await this.audit.temporaryPasswordFailed(request, dto.email, error);
      throw error;
    }
  }
}
