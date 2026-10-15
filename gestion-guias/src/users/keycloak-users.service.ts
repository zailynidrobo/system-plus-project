import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from './entities/user.entity.js';

interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

interface KeycloakUserRepresentation {
  email: string;
  firstName?: string;
}

@Injectable()
export class KeycloakUsersService {
  private cachedToken?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) {
    const response = await this.request(
      `${this.adminRoot()}/users`,
      {
        method: 'POST',
        body: JSON.stringify({
          username: input.email,
          email: input.email,
          firstName: input.name,
          enabled: false,
          credentials: [
            { type: 'password', value: input.password, temporary: false },
          ],
        }),
      },
      [201],
    );
    const keycloakUserId = response.headers.get('location')?.split('/').pop();
    if (!keycloakUserId) {
      throw new InternalServerErrorException(
        'Keycloak creó el usuario, pero no devolvió su identificador',
      );
    }

    try {
      await this.assignRole(keycloakUserId, input.role);
      await this.updateUser(keycloakUserId, {
        email: input.email,
        firstName: input.name,
        enabled: true,
      });
    } catch (error) {
      try {
        await this.deleteUser(keycloakUserId);
      } catch {
        throw new InternalServerErrorException(
          'No se pudo completar el alta ni revertir el usuario creado en Keycloak',
        );
      }
      throw error;
    }
    return keycloakUserId;
  }

  async updateUser(
    keycloakUserId: string,
    input: {
      email: string;
      firstName: string;
      enabled: boolean;
    },
  ) {
    await this.request(
      `${this.adminRoot()}/users/${encodeURIComponent(keycloakUserId)}`,
      { method: 'PUT', body: JSON.stringify(input) },
      [204],
    );
  }

  async resetPassword(keycloakUserId: string, password: string) {
    await this.request(
      `${this.adminRoot()}/users/${encodeURIComponent(keycloakUserId)}/reset-password`,
      {
        method: 'PUT',
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary: false,
        }),
      },
      [204],
    );
  }

  async changeRole(keycloakUserId: string, oldRole: Role, newRole: Role) {
    const oldRepresentation = await this.getRole(oldRole);
    await this.request(
      `${this.adminRoot()}/users/${encodeURIComponent(keycloakUserId)}/role-mappings/realm`,
      {
        method: 'DELETE',
        body: JSON.stringify([oldRepresentation]),
      },
      [204],
    );
    try {
      await this.assignRole(keycloakUserId, newRole);
    } catch (error) {
      try {
        await this.assignRole(keycloakUserId, oldRole);
      } catch {
        throw new InternalServerErrorException(
          'No se pudo asignar el nuevo rol ni restaurar el rol anterior en Keycloak',
        );
      }
      throw error;
    }
  }

  async setEnabled(keycloakUserId: string, enabled: boolean) {
    const response = await this.request(
      `${this.adminRoot()}/users/${encodeURIComponent(keycloakUserId)}`,
      { method: 'GET' },
      [200],
    );
    const user = (await response.json()) as KeycloakUserRepresentation;
    await this.updateUser(keycloakUserId, {
      email: user.email,
      firstName: user.firstName ?? '',
      enabled,
    });
  }

  async deleteUser(keycloakUserId: string) {
    await this.request(
      `${this.adminRoot()}/users/${encodeURIComponent(keycloakUserId)}`,
      { method: 'DELETE' },
      [204, 404],
    );
  }

  private async assignRole(keycloakUserId: string, role: Role) {
    const representation = await this.getRole(role);
    await this.request(
      `${this.adminRoot()}/users/${encodeURIComponent(keycloakUserId)}/role-mappings/realm`,
      {
        method: 'POST',
        body: JSON.stringify([representation]),
      },
      [204],
    );
  }

  private async getRole(role: Role) {
    const response = await this.request(
      `${this.adminRoot()}/roles/${encodeURIComponent(role)}`,
      { method: 'GET' },
      [200],
    );
    return (await response.json()) as KeycloakRoleRepresentation;
  }

  private async request(
    url: string,
    init: RequestInit,
    acceptedStatuses: number[],
  ) {
    const token = await this.accessToken();
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Content-Type', 'application/json');
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo conectar con la Admin API de Keycloak',
      );
    }
    if (acceptedStatuses.includes(response.status)) return response;
    if (response.status === 409) {
      throw new ConflictException('El correo ya está registrado en Keycloak');
    }
    if (response.status === 401 || response.status === 403) {
      this.cachedToken = undefined;
      throw new ServiceUnavailableException(
        'Keycloak rechazó las credenciales o permisos del cliente administrativo',
      );
    }
    if (response.status === 400) {
      const detail = await this.badRequestDetail(response);
      throw new BadRequestException(
        detail
          ? `Keycloak rechazó los datos enviados: ${detail}`
          : `Keycloak rechazó la solicitud ${init.method ?? 'GET'} a la Admin API (400); revisa los datos del usuario y los logs de Keycloak`,
      );
    }
    throw new ServiceUnavailableException(
      `La Admin API de Keycloak respondió con estado ${response.status}`,
    );
  }

  private async badRequestDetail(response: Response) {
    try {
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object') return undefined;

      const record = body as Record<string, unknown>;
      const message = record.errorMessage ?? record.error_description;
      if (typeof message !== 'string') return undefined;

      const sanitized = message
        .replace(/[\r\n\t]+/g, ' ')
        .trim()
        .slice(0, 300);
      return sanitized || undefined;
    } catch {
      return undefined;
    }
  }

  private async accessToken() {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 5000) {
      return this.cachedToken.value;
    }
    const issuer = this.config.get<string>('KEYCLOAK_ISSUER_URL');
    const clientId = this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID');
    const clientSecret = this.config.get<string>(
      'KEYCLOAK_ADMIN_CLIENT_SECRET',
    );
    if (!issuer || !clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Configura KEYCLOAK_ADMIN_CLIENT_ID y KEYCLOAK_ADMIN_CLIENT_SECRET para administrar usuarios',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `${issuer.replace(/\/+$/, '')}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo solicitar un token administrativo a Keycloak',
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Keycloak rechazó la autenticación del cliente administrativo (${response.status})`,
      );
    }
    const token = (await response.json()) as KeycloakTokenResponse;
    this.cachedToken = {
      value: token.access_token,
      expiresAt: now + token.expires_in * 1000,
    };
    return token.access_token;
  }

  private adminRoot() {
    const issuer = this.config.get<string>('KEYCLOAK_ISSUER_URL');
    if (!issuer) {
      throw new ServiceUnavailableException(
        'KEYCLOAK_ISSUER_URL no está configurado',
      );
    }
    const match = issuer.replace(/\/+$/, '').match(/^(.*)\/realms\/([^/]+)$/);
    if (!match) {
      throw new ServiceUnavailableException(
        'KEYCLOAK_ISSUER_URL debe terminar en /realms/<realm>',
      );
    }
    return `${match[1]}/admin/realms/${encodeURIComponent(match[2])}`;
  }
}
