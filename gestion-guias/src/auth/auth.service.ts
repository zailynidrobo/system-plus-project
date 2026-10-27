import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChangeTemporaryPasswordDto } from './dto/change-temporary-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Role } from '../users/entities/user.entity.js';
import { KeycloakAdminService } from '../users/keycloak-admin.service.js';

/** Respuesta del endpoint de tokens de Keycloak (solo lo que usamos). */
interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

interface AccessTokenPayload {
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

/** Sesión que recibe el front: tokens de Keycloak y los datos del usuario para el menú. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Segundos de vida del access token. */
  expiresIn: number;
  /** Segundos de vida del refresh token (la sesión se cierra si no se renueva antes). */
  refreshExpiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: true;
  };
}

/** Mensaje de Keycloak cuando la contraseña es correcta pero falta una acción, p. ej. cambiarla. */
const ACCOUNT_NOT_SET_UP = 'Account is not fully set up';
const UPDATE_PASSWORD = 'UPDATE_PASSWORD';

/** Si el usuario tiene varios roles, gana el de mayor alcance. */
const ROLE_PRIORITY = [
  Role.ADMIN,
  Role.COORDINADOR,
  Role.DOCENTE_AUTORIZADO,
  Role.DOCENTE,
];

const invalidCredentials = () =>
  new UnauthorizedException({
    code: 'CREDENCIALES_INVALIDAS',
    message: 'Credenciales inválidas',
  });

/**
 * Inicio de sesión con el formulario propio de System Plus. La API recibe el correo y la
 * contraseña, los valida contra Keycloak (grant de contraseña del client del front) y le
 * devuelve al front los tokens. La API no guarda contraseñas ni sesiones: todo queda en Keycloak,
 * incluido el bloqueo por intentos fallidos.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  async login(dto: LoginDto): Promise<Session> {
    const result = await this.postToken({
      grant_type: 'password',
      username: this.normalizeEmail(dto.email),
      password: dto.password,
    });
    if (!result.ok) throw this.loginError(result.error);
    return this.toSession(result.tokens);
  }

  /** Renueva el access token. Falla si la sesión venció, se cerró o la cuenta se desactivó. */
  async refresh(refreshToken: string): Promise<Session> {
    const result = await this.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (!result.ok) {
      throw new UnauthorizedException({
        code: 'SESION_VENCIDA',
        message: 'La sesión venció. Vuelve a iniciar sesión.',
      });
    }
    return this.toSession(result.tokens);
  }

  /** Cierra la sesión en Keycloak. Si ya estaba cerrada o vencida no hay nada que hacer. */
  async logout(refreshToken: string): Promise<void> {
    try {
      await fetch(this.endpoints.logout, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          refresh_token: refreshToken,
        }),
      });
    } catch {
      // Keycloak no responde: el front igual borra la sesión y el token vence solo.
    }
  }

  /**
   * Primer ingreso de un usuario creado con contraseña temporal: comprueba la temporal, guarda
   * la nueva como definitiva y abre la sesión.
   */
  async changeTemporaryPassword(
    dto: ChangeTemporaryPasswordDto,
  ): Promise<Session> {
    const email = this.normalizeEmail(dto.email);
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException({
        code: 'CONTRASENA_REPETIDA',
        message: 'La nueva contraseña debe ser distinta de la temporal',
      });
    }

    // Con la temporal correcta Keycloak responde "Account is not fully set up"; con una
    // incorrecta, credenciales inválidas. Si inicia sesión, la cuenta no tenía nada pendiente.
    const check = await this.postToken({
      grant_type: 'password',
      username: email,
      password: dto.currentPassword,
    });
    if (check.ok) {
      throw new BadRequestException({
        code: 'CAMBIO_NO_REQUERIDO',
        message: 'Esta cuenta no tiene una contraseña temporal',
      });
    }
    if (check.error !== ACCOUNT_NOT_SET_UP) throw invalidCredentials();

    const user = await this.keycloak.findUserByEmail(email);
    if (!user?.requiredActions?.includes(UPDATE_PASSWORD))
      throw invalidCredentials();

    await this.keycloak.setPassword(user.id, dto.newPassword, false);
    return this.login({ email, password: dto.newPassword });
  }

  // ---- Conexión con Keycloak ----

  private get clientId(): string {
    return this.config.get<string>(
      'KEYCLOAK_FRONT_CLIENT_ID',
      'system-plus-front',
    );
  }

  private get endpoints() {
    const issuer = this.config
      .get<string>('KEYCLOAK_ISSUER_URL')
      ?.replace(/\/+$/, '');
    if (!issuer) {
      throw new ServiceUnavailableException({
        code: 'SERVICIO_NO_DISPONIBLE',
        message: 'Falta KEYCLOAK_ISSUER_URL para iniciar sesión',
      });
    }
    return {
      token: `${issuer}/protocol/openid-connect/token`,
      logout: `${issuer}/protocol/openid-connect/logout`,
    };
  }

  /**
   * Pide tokens a Keycloak. Devuelve los tokens, o el mensaje con el que Keycloak rechazó la
   * petición. Si Keycloak no responde o falla, lanza SERVICIO_NO_DISPONIBLE.
   */
  private async postToken(
    params: Record<string, string>,
  ): Promise<
    { ok: true; tokens: TokenResponse } | { ok: false; error: string }
  > {
    let response: Response;
    try {
      response = await fetch(this.endpoints.token, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          ...params,
          client_id: this.clientId,
          scope: 'openid',
        }),
      });
    } catch {
      throw this.unavailable();
    }
    if (response.status >= 500) throw this.unavailable();

    const body = (await response
      .json()
      .catch(() => ({}))) as Partial<TokenResponse> & {
      error_description?: string;
    };
    if (!response.ok) return { ok: false, error: body.error_description ?? '' };
    if (
      !body.access_token ||
      !body.refresh_token ||
      !Number.isFinite(body.expires_in)
    ) {
      throw this.unavailable();
    }
    return { ok: true, tokens: body as TokenResponse };
  }

  private loginError(error: string): HttpException {
    if (error === ACCOUNT_NOT_SET_UP) {
      return new ForbiddenException({
        code: 'CAMBIO_CONTRASENA_REQUERIDO',
        message: 'Debes cambiar tu contraseña temporal antes de ingresar',
      });
    }
    // Contraseña incorrecta, usuario inexistente, desactivado o bloqueado por intentos: mismo
    // mensaje, para no revelar cuál fue el dato que falló (HU-05).
    return invalidCredentials();
  }

  private unavailable() {
    return new ServiceUnavailableException({
      code: 'SERVICIO_NO_DISPONIBLE',
      message: 'No se pudo conectar con el servicio de acceso',
    });
  }

  private toSession(tokens: TokenResponse): Session {
    const payload = this.decodePayload(tokens.access_token);
    const role = ROLE_PRIORITY.find((candidate) =>
      (payload.realm_access?.roles ?? []).includes(candidate),
    );
    if (!payload.sub) throw this.unavailable();
    if (!role) {
      throw new ForbiddenException({
        code: 'SIN_ROL',
        message: 'La cuenta no tiene un rol asignado',
      });
    }

    const email = payload.email ?? payload.preferred_username ?? '';
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      refreshExpiresIn: tokens.refresh_expires_in,
      user: {
        id: payload.sub,
        name: payload.name?.trim() || email,
        email,
        role,
        isActive: true,
      },
    };
  }

  /**
   * Lee el contenido del access token. No hace falta verificar la firma: el token llega
   * directamente de Keycloak, y cada petición posterior del front sí se valida (KeycloakStrategy).
   */
  private decodePayload(token: string): AccessTokenPayload {
    try {
      const encoded = token.split('.')[1] ?? '';
      return JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as AccessTokenPayload;
    } catch {
      throw this.unavailable();
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
