import { ROLE_PRIORITY } from '../../auth/auth.service.js';
import type { KeycloakJwtPayload } from '../../auth/keycloak.strategy.js';
import { actorFromToken } from '../../suggestions/suggestion-actor.js';
import { USER_AGENT_MAX_LENGTH } from './audit-rules.js';

/** Lo que el registro lee de una petición de Express. */
export interface AuditRequest {
  method: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  route?: { path?: unknown };
  params?: Record<string, string>;
  body?: unknown;
  user?: KeycloakJwtPayload;
}

export interface AuditActor {
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
}

const header = (request: AuditRequest, name: string) => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/** `::ffff:127.0.0.1` (IPv4 dentro de IPv6) -> `127.0.0.1`. */
export function normalizeIp(ip: string | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  return value.toLowerCase().startsWith('::ffff:') && value.includes('.')
    ? value.slice(7)
    : value;
}

/**
 * IP de origen. Detrás de un proxy (TRUST_PROXY=true) es la primera de `X-Forwarded-For`;
 * sin proxy ese encabezado lo puede inventar cualquiera, así que se usa la del socket.
 */
export function clientIp(
  request: AuditRequest,
  trustProxy: boolean,
): string | null {
  if (trustProxy) {
    const forwarded = header(request, 'x-forwarded-for')?.split(',')[0];
    const ip = normalizeIp(forwarded);
    if (ip) return ip;
  }
  return normalizeIp(request.socket?.remoteAddress);
}

export function userAgent(request: AuditRequest): string | null {
  return header(request, 'user-agent')?.slice(0, USER_AGENT_MAX_LENGTH) || null;
}

/** URL real sin query string. */
export function requestPath(request: AuditRequest): string {
  return (request.originalUrl ?? request.url ?? '').split('?')[0];
}

/** Patrón de la ruta (`/academic/guides/:id`), igual al que usa el catálogo de permisos. */
export function routePattern(request: AuditRequest): string {
  const pattern = request.route?.path;
  const path = typeof pattern === 'string' ? pattern : requestPath(request);
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** Usuario del token: `sub`, nombre visible, correo y el rol de la app de mayor alcance. */
export function actorFromPayload(payload: KeycloakJwtPayload): AuditActor {
  const roles = payload.realm_access?.roles ?? [];
  const email =
    (typeof payload.email === 'string' && payload.email) ||
    payload.preferred_username ||
    null;
  return {
    actorId: payload.sub,
    actorName: actorFromToken(payload).name,
    actorEmail: email,
    actorRole: ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null,
  };
}
