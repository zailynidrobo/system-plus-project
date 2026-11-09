import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { CLOCK, type Clock } from '../../suggestions/clock.js';
import { PERMISSION_CATALOG } from '../permissions/permission-catalog.js';
import { routeKey } from '../permissions/route-permissions.js';
import { sanitizeDetails } from './audit-details.js';
import {
  AuditEntityType,
  AuditEventRecord,
  AuditResult,
} from './audit-event.entity.js';
import {
  AuditActor,
  AuditRequest,
  clientIp,
  requestPath,
  userAgent,
} from './request-info.js';

/** Datos de un evento antes de guardarlo. Lo que falte queda en null. */
export interface AuditEventInput extends Partial<AuditActor> {
  method: string;
  route: string;
  path: string;
  area: string;
  action: string;
  result: AuditResult;
  statusCode: number;
  ip?: string | null;
  userAgent?: string | null;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  entityLabel?: string | null;
  moduleId?: string | null;
  moduleName?: string | null;
  details?: Record<string, unknown> | null;
}

/** Área y nombre legible de una ruta, tomados del catálogo de HE-08-HU-02. */
export function describeRoute(method: string, route: string) {
  const key = routeKey({ method, path: route });
  return PERMISSION_CATALOG[key] ?? { area: 'Otros', action: key };
}

const cut = (value: string | null | undefined, length: number) =>
  value ? value.slice(0, length) : null;

/**
 * Escribe el registro de auditoría (HE-08-HU-01).
 *
 * Escribir el registro nunca rompe la acción del usuario: si la base de datos falla, el error se
 * reporta con el Logger y la respuesta sale igual. Se prefirió perder un evento a impedir que
 * un coordinador publique una guía porque la tabla de auditoría no está disponible.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly trustProxy: boolean;

  constructor(
    @InjectRepository(AuditEventRecord)
    private readonly events: Repository<AuditEventRecord>,
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService,
  ) {
    this.trustProxy = config.get<string>('TRUST_PROXY', 'false') === 'true';
  }

  /** Desde dónde se hizo la petición: IP, navegador y URL real. */
  origin(request: AuditRequest) {
    return {
      ip: clientIp(request, this.trustProxy),
      userAgent: userAgent(request),
      path: requestPath(request),
    };
  }

  async record(input: AuditEventInput): Promise<void> {
    try {
      // `details` es jsonb libre: TypeORM no sabe tipar su forma parcial.
      await this.events.insert(
        this.toRecord(input) as QueryDeepPartialEntity<AuditEventRecord>,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar el evento de auditoría "${input.action}" ` +
          `(${input.method} ${input.path}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toRecord(input: AuditEventInput): AuditEventRecord {
    return {
      id: randomUUID(),
      occurredAt: this.clock.now(),
      actorId: cut(input.actorId, 255),
      actorName: cut(input.actorName, 150),
      actorEmail: cut(input.actorEmail, 254),
      actorRole: cut(input.actorRole, 30),
      method: input.method,
      route: input.route.slice(0, 250),
      path: input.path.slice(0, 500),
      area: input.area.slice(0, 60),
      action: input.action.slice(0, 150),
      result: input.result,
      statusCode: input.statusCode,
      ip: cut(input.ip, 45),
      userAgent: cut(input.userAgent, 300),
      entityType: input.entityType ?? null,
      entityId: cut(input.entityId, 255),
      entityLabel: cut(input.entityLabel, 300),
      moduleId: input.moduleId ?? null,
      moduleName: cut(input.moduleName, 150),
      details: sanitizeDetails(input.details),
    };
  }
}
