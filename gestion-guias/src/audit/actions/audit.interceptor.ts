import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { Observable, mergeMap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../auth/keycloak-auth.guard.js';
import { routeKey } from '../permissions/route-permissions.js';
import { AuditContextResolver } from './audit-context.resolver.js';
import { summarizeChange } from './audit-details.js';
import { AuditLogService, describeRoute } from './audit-log.service.js';
import { AUDITED_METHODS, EXCLUDED_ROUTES } from './audit-rules.js';
import {
  AuditRequest,
  actorFromPayload,
  routePattern,
} from './request-info.js';

/**
 * Registra toda acción que cambia algo (POST, PUT, PATCH, DELETE) de un usuario con sesión
 * cuando responde 2xx. Escribe después de la respuesta exitosa, así no hay que tocar cada
 * controlador. Los accesos denegados los registra AuditForbiddenFilter y la sesión, AuthController.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly log: AuditLogService,
    private readonly resolver: AuditContextResolver,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuditRequest>();
    if (!this.shouldRecord(context, request)) return next.handle();

    // Solo llega aquí si el controlador respondió sin error.
    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        await this.recordSuccess(context, request, response);
        return response;
      }),
    );
  }

  private shouldRecord(context: ExecutionContext, request: AuditRequest) {
    const method = request.method.toUpperCase();
    if (!AUDITED_METHODS.includes(method) || !request.user?.sub) return false;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return false;
    return !EXCLUDED_ROUTES.has(
      routeKey({ method, path: routePattern(request) }),
    );
  }

  /** Nunca lanza: si algo falla, la respuesta del usuario sale igual. */
  private async recordSuccess(
    context: ExecutionContext,
    request: AuditRequest,
    response: unknown,
  ) {
    try {
      const method = request.method.toUpperCase();
      const route = routePattern(request);
      const target = {
        method,
        route,
        params: request.params ?? {},
        body: request.body,
        response,
      };
      await this.log.record({
        ...actorFromPayload(request.user!),
        ...this.log.origin(request),
        ...describeRoute(method, route),
        ...(await this.resolver.resolve(target)),
        method,
        route,
        result: 'success',
        statusCode: this.statusCode(context, method),
        details: summarizeChange(request.body, response),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la acción ${request.method} ${request.originalUrl ?? ''}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /** Nest fija el código después de los interceptores: se toma de @HttpCode o del método. */
  private statusCode(context: ExecutionContext, method: string): number {
    const declared = this.reflector.get<number | undefined>(
      HTTP_CODE_METADATA,
      context.getHandler(),
    );
    return declared ?? (method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);
  }
}
