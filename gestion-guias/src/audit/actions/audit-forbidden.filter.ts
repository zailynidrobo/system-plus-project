import {
  ArgumentsHost,
  Catch,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { AuditContextResolver } from './audit-context.resolver.js';
import { AuditLogService, describeRoute } from './audit-log.service.js';
import { AUDITED_METHODS, AUDIT_DENIED_READS } from './audit-rules.js';
import {
  AuditRequest,
  actorFromPayload,
  routePattern,
} from './request-info.js';

/**
 * Registra los accesos denegados (403) de usuarios con sesión: alguien intentó una acción que su
 * rol no permite. Los guards se ejecutan antes que los interceptores, por eso se captura aquí.
 * Después responde exactamente lo mismo que el filtro por defecto de Nest.
 */
@Catch(ForbiddenException)
@Injectable()
export class AuditForbiddenFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AuditForbiddenFilter.name);

  constructor(
    private readonly log: AuditLogService,
    private readonly resolver: AuditContextResolver,
  ) {
    super();
  }

  /** Responde cuando termina de registrar, para que el evento ya esté guardado al recibir el 403. */
  override catch(exception: ForbiddenException, host: ArgumentsHost): void {
    void this.recordDenied(exception, host).finally(() =>
      super.catch(exception, host),
    );
  }

  /** Nunca lanza: si no se puede registrar, el usuario recibe su 403 igual. */
  private async recordDenied(
    exception: ForbiddenException,
    host: ArgumentsHost,
  ) {
    if (host.getType() !== 'http') return;
    const request = host.switchToHttp().getRequest<AuditRequest>();
    try {
      const method = request.method.toUpperCase();
      const route = routePattern(request);
      // Sin sesión no hay a quién atribuirlo. Los 403 del login (p. ej. una cuenta sin rol) ya
      // los registra AuthController como inicio de sesión fallido.
      if (!request.user?.sub || route.startsWith('/auth')) return;
      if (!AUDIT_DENIED_READS && !AUDITED_METHODS.includes(method)) return;

      const context = await this.resolver
        .resolve({
          method,
          route,
          params: request.params ?? {},
          body: request.body,
        })
        .catch(() => ({}));
      await this.log.record({
        ...actorFromPayload(request.user),
        ...this.log.origin(request),
        ...describeRoute(method, route),
        ...context,
        method,
        route,
        result: 'denied',
        statusCode: exception.getStatus(),
        details: { reason: exception.message },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el acceso denegado a ${request.method} ${request.originalUrl ?? ''}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
