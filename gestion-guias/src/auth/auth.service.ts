import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto.js';
import { Role } from '../users/entities/user.entity.js';
import { KeycloakAdminService } from '../users/keycloak-admin.service.js';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  async login(dto: LoginDto) {
    const issuer = this.config.get<string>('KEYCLOAK_ISSUER_URL')?.replace(/\/+$/, '');
    const clientId = this.config.get<string>('KEYCLOAK_FRONT_CLIENT_ID', 'system-plus-front');
    if (!issuer) {
      throw new ServiceUnavailableException('Falta KEYCLOAK_ISSUER_URL para iniciar sesión');
    }
    const email = dto.email.trim().toLowerCase();
    const account = (await this.keycloak.listUsers()).find(
      (user) => user.enabled && user.email?.trim().toLowerCase() === email,
    );
    if (!account) throw new UnauthorizedException('Credenciales inválidas');

    let response: Response;
    try {
      response = await fetch(`${issuer}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: clientId,
          username: account.username,
          password: dto.password,
          scope: 'openid profile email',
        }),
      });
    } catch {
      throw new ServiceUnavailableException('No se pudo conectar con el servicio de acceso');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = (await response.json()) as TokenResponse;
    if (!token.access_token || !Number.isFinite(token.expires_in)) {
      throw new UnauthorizedException('Keycloak devolvió un token de acceso inválido');
    }
    const payload = this.decodePayload(token.access_token);
    if (!payload.sub) throw new UnauthorizedException('Token de acceso inválido');
    const role = this.roleFromPayload(payload.realm_access?.roles ?? []);
    if (!role) {
      throw new UnauthorizedException('La cuenta no tiene un rol asignado');
    }

    return {
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      user: {
        id: payload.sub,
        name: payload.name ?? payload.preferred_username ?? dto.email,
        email: payload.email ?? payload.preferred_username ?? email,
        role,
        isActive: true,
      },
    };
  }

  private decodePayload(token: string): {
    sub: string;
    name?: string;
    email?: string;
    preferred_username?: string;
    realm_access?: { roles?: string[] };
  } {
    const encoded = token.split('.')[1];
    if (!encoded) throw new UnauthorizedException('Token de acceso inválido');
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ReturnType<
        AuthService['decodePayload']
      >;
    } catch {
      throw new UnauthorizedException('Token de acceso inválido');
    }
  }

  private roleFromPayload(roles: string[]): Role | null {
    return (
      [Role.ADMIN, Role.COORDINADOR, Role.DOCENTE_AUTORIZADO, Role.DOCENTE].find((role) =>
        roles.includes(role),
      ) ?? null
    );
  }
}
