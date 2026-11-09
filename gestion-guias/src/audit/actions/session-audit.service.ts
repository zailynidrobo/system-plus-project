import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Session } from '../../auth/auth.service.js';
import { UsersService } from '../../users/users.service.js';
import { AuditLogService } from './audit-log.service.js';
import { SESSION_ACTIONS, SESSION_AREA } from './audit-rules.js';
import type { AuditRequest } from './request-info.js';

type SessionAction = (typeof SESSION_ACTIONS)[keyof typeof SESSION_ACTIONS];

/** Código de error de la respuesta (`CREDENCIALES_INVALIDAS`...) para saber por qué falló. */
function failure(error: unknown) {
  if (!(error instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      reason: 'ERROR_INTERNO',
    };
  }
  const body = error.getResponse();
  const code =
    typeof body === 'object' && body !== null && 'code' in body
      ? String((body as { code: unknown }).code)
      : error.message;
  return { statusCode: error.getStatus(), reason: code };
}

/** `sub` del refresh token de Keycloak (sin verificar la firma: la valida Keycloak al cerrar). */
function subjectOf(refreshToken: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(refreshToken.split('.')[1] ?? '', 'base64url').toString(
        'utf8',
      ),
    ) as { sub?: unknown };
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Inicio y cierre de sesión en el registro de auditoría (HE-08-HU-01). Son rutas públicas,
 * por eso no las cubre AuditInterceptor y las registra AuthController. Nunca guarda contraseñas
 * ni tokens; tampoco registra la renovación de la sesión (`/auth/refresh`).
 */
@Injectable()
export class SessionAuditService {
  constructor(
    private readonly log: AuditLogService,
    private readonly users: UsersService,
  ) {}

  loginSucceeded(request: AuditRequest, session: Session) {
    return this.succeeded(request, SESSION_ACTIONS.login, session);
  }

  /** Guarda el correo que se intentó, nunca la contraseña. */
  loginFailed(request: AuditRequest, email: unknown, error: unknown) {
    return this.failed(request, SESSION_ACTIONS.loginFailed, email, error);
  }

  temporaryPasswordChanged(request: AuditRequest, session: Session) {
    return this.succeeded(request, SESSION_ACTIONS.temporaryPassword, session);
  }

  temporaryPasswordFailed(
    request: AuditRequest,
    email: unknown,
    error: unknown,
  ) {
    return this.failed(
      request,
      SESSION_ACTIONS.temporaryPasswordFailed,
      email,
      error,
    );
  }

  /** El usuario sale del refresh token; nombre, correo y rol se buscan en Keycloak si responde. */
  async loggedOut(request: AuditRequest, refreshToken: string) {
    const actorId = subjectOf(refreshToken);
    const user = actorId
      ? await this.users.findOne(actorId).catch(() => null)
      : null;
    await this.log.record({
      ...this.log.origin(request),
      ...this.event(SESSION_ACTIONS.logout),
      actorId,
      actorName: user?.name ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      result: 'success',
      statusCode: HttpStatus.NO_CONTENT,
      entityType: 'session',
      entityId: actorId,
      entityLabel: user?.email ?? null,
    });
  }

  private succeeded(
    request: AuditRequest,
    action: SessionAction,
    session: Session,
  ) {
    const { user } = session;
    return this.log.record({
      ...this.log.origin(request),
      ...this.event(action),
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      result: 'success',
      statusCode: HttpStatus.OK,
      entityType: 'session',
      entityId: user.id,
      entityLabel: user.email,
    });
  }

  private failed(
    request: AuditRequest,
    action: SessionAction,
    email: unknown,
    error: unknown,
  ) {
    const attempted =
      typeof email === 'string' ? email.trim().toLowerCase() || null : null;
    const { statusCode, reason } = failure(error);
    return this.log.record({
      ...this.log.origin(request),
      ...this.event(action),
      actorId: null,
      actorName: null,
      actorEmail: attempted,
      actorRole: null,
      result: 'failed',
      statusCode,
      entityType: 'session',
      entityId: null,
      entityLabel: attempted,
      details: { reason },
    });
  }

  private event(action: SessionAction) {
    return {
      method: 'POST',
      route: action.route,
      area: SESSION_AREA,
      action: action.action,
    };
  }
}
