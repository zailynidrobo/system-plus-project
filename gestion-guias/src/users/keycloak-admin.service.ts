import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Usuario tal como lo devuelve la API de administración de Keycloak (solo lo que usamos). */
export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
}

export interface KeycloakRole {
  id: string;
  name: string;
}

export interface NewKeycloakUser {
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
  /** Si es true, Keycloak obliga a cambiar la contraseña en el primer ingreso. */
  temporary: boolean;
}

export interface KeycloakUserChanges {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

/** Máximo de usuarios que se piden por consulta (Keycloak devuelve 100 si no se indica). */
const MAX_RESULTS = 1000;
const TOKEN_MARGIN_SECONDS = 30;

/**
 * Cliente de la API de administración de Keycloak. La API se identifica con su propia cuenta de
 * servicio (client credentials), no con el token del usuario que hace la petición.
 * Los usuarios y sus roles viven en Keycloak; aquí no se guarda nada.
 */
@Injectable()
export class KeycloakAdminService {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async listUsers(): Promise<KeycloakUser[]> {
    const response = await this.request('GET', `/users?max=${MAX_RESULTS}`);
    return (await response.json()) as KeycloakUser[];
  }

  /** Ids de los usuarios que tienen un rol de realm. */
  async listUserIdsByRole(role: string): Promise<Set<string>> {
    const response = await this.request(
      'GET',
      `/roles/${encodeURIComponent(role)}/users?max=${MAX_RESULTS}`,
      undefined,
      `El rol "${role}" no existe en Keycloak. Créalo en el realm.`,
    );
    const users = (await response.json()) as { id: string }[];
    return new Set(users.map((user) => user.id));
  }

  async getUser(id: string): Promise<KeycloakUser> {
    const response = await this.request('GET', `/users/${encodeURIComponent(id)}`);
    return (await response.json()) as KeycloakUser;
  }

  /** Nombres de los roles de realm asignados directamente al usuario. */
  async getUserRealmRoles(id: string): Promise<string[]> {
    const response = await this.request(
      'GET',
      `/users/${encodeURIComponent(id)}/role-mappings/realm`,
    );
    const roles = (await response.json()) as KeycloakRole[];
    return roles.map((role) => role.name);
  }

  /** Crea el usuario ya habilitado y con el correo verificado. Devuelve su id. */
  async createUser(user: NewKeycloakUser): Promise<string> {
    const response = await this.request('POST', '/users', {
      username: user.email,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: user.password, temporary: user.temporary }],
    });

    const fromLocation = response.headers.get('location')?.split('/').pop();
    if (fromLocation) return fromLocation;

    const found = await this.request(
      'GET',
      `/users?email=${encodeURIComponent(user.email)}&exact=true`,
    );
    const [first] = (await found.json()) as KeycloakUser[];
    if (!first) throw new BadGatewayException('Keycloak creó el usuario pero no devolvió su id');
    return first.id;
  }

  /** Cambia solo los campos enviados; el resto del usuario queda igual. */
  async updateUser(id: string, changes: KeycloakUserChanges): Promise<void> {
    const current = await this.getUser(id);
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    await this.request('PUT', `/users/${encodeURIComponent(id)}`, { ...current, ...defined });
  }

  async setPassword(id: string, password: string, temporary: boolean): Promise<void> {
    await this.request('PUT', `/users/${encodeURIComponent(id)}/reset-password`, {
      type: 'password',
      value: password,
      temporary,
    });
  }

  /** Cierra todas las sesiones abiertas del usuario. */
  async logoutUser(id: string): Promise<void> {
    await this.request('POST', `/users/${encodeURIComponent(id)}/logout`);
  }

  async deleteUser(id: string): Promise<void> {
    await this.request('DELETE', `/users/${encodeURIComponent(id)}`);
  }

  /**
   * Deja al usuario con un solo rol de la app: asigna `role` y quita los demás de `managedRoles`.
   * Los roles propios de Keycloak (offline_access, etc.) no se tocan.
   */
  async setRealmRole(id: string, role: string, managedRoles: string[]): Promise<void> {
    const response = await this.request('GET', `/roles?max=${MAX_RESULTS}`);
    const all = (await response.json()) as KeycloakRole[];

    const wanted = all.find((candidate) => candidate.name === role);
    if (!wanted) throw new BadGatewayException(`El rol "${role}" no existe en Keycloak`);
    const toRemove = all.filter(
      (candidate) => candidate.name !== role && managedRoles.includes(candidate.name),
    );

    const path = `/users/${encodeURIComponent(id)}/role-mappings/realm`;
    await this.request('POST', path, [{ id: wanted.id, name: wanted.name }]);
    if (toRemove.length) {
      await this.request(
        'DELETE',
        path,
        toRemove.map((candidate) => ({ id: candidate.id, name: candidate.name })),
      );
    }
  }

  // ---- Conexión con Keycloak ----

  /** `KEYCLOAK_ISSUER_URL` (<url>/realms/<realm>) → direcciones del token y de la API de administración. */
  private get endpoints() {
    const issuer = this.config.get<string>('KEYCLOAK_ISSUER_URL')?.replace(/\/+$/, '');
    const match = issuer ? /^(.*)\/realms\/([^/]+)$/.exec(issuer) : null;
    if (!issuer || !match) {
      throw new ServiceUnavailableException(
        'KEYCLOAK_ISSUER_URL debe tener la forma <url>/realms/<realm>',
      );
    }
    return {
      tokenUrl: `${issuer}/protocol/openid-connect/token`,
      adminUrl: `${match[1]}/admin/realms/${match[2]}`,
    };
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) return this.cachedToken.value;

    const clientId = this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID', 'system-plus-api');
    const clientSecret = this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_SECRET');
    if (!clientSecret) {
      throw new ServiceUnavailableException(
        'Falta KEYCLOAK_ADMIN_CLIENT_SECRET para administrar usuarios en Keycloak',
      );
    }

    const response = await this.send(this.endpoints.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!response.ok) {
      throw new BadGatewayException(
        'Keycloak rechazó las credenciales de administración de la API (revisa KEYCLOAK_ADMIN_CLIENT_ID y KEYCLOAK_ADMIN_CLIENT_SECRET)',
      );
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      value: data.access_token,
      expiresAt: now + (data.expires_in - TOKEN_MARGIN_SECONDS) * 1000,
    };
    return data.access_token;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new ServiceUnavailableException('No se pudo conectar con Keycloak');
    }
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    notFoundMessage = 'Usuario no encontrado',
  ): Promise<Response> {
    const url = `${this.endpoints.adminUrl}${path}`;
    const call = async () =>
      this.send(url, {
        method,
        headers: {
          authorization: `Bearer ${await this.getToken()}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    let response = await call();
    if (response.status === 401) {
      // El token de la cuenta de servicio pudo vencer o revocarse: se pide uno nuevo una vez.
      this.cachedToken = null;
      response = await call();
    }
    if (!response.ok) throw await this.toHttpException(response, notFoundMessage);
    return response;
  }

  private async toHttpException(response: Response, notFoundMessage: string) {
    const detail = await response.text().catch(() => '');
    switch (response.status) {
      case 400:
        return new BadRequestException(this.readMessage(detail) ?? 'Keycloak rechazó los datos enviados');
      case 403:
        return new BadGatewayException(
          'La cuenta de servicio de la API no tiene permisos suficientes en Keycloak (necesita manage-users, view-users, query-users y view-realm)',
        );
      case 404:
        return new NotFoundException(notFoundMessage);
      case 409:
        return new ConflictException('El correo ya está registrado');
      default:
        return new BadGatewayException(`Keycloak respondió con el estado ${response.status}`);
    }
  }

  private readMessage(detail: string): string | undefined {
    try {
      const parsed = JSON.parse(detail) as { errorMessage?: string; error?: string };
      return parsed.errorMessage ?? parsed.error;
    } catch {
      return undefined;
    }
  }
}
