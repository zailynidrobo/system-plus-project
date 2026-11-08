import { IsOptional, IsString } from 'class-validator';
import {
  addDays,
  endOfDayInZone,
  isIsoDate,
} from '../../../suggestions/business-days.js';
import { AUDIT_RESULTS, AuditResult } from '../audit-event.entity.js';
import { auditBadRequest } from '../audit-errors.js';
import {
  AUDIT_TIME_ZONE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../audit-rules.js';

/**
 * Filtros de `GET /audit/actions`. Aquí solo se aceptan como texto; `parseAuditActionsQuery`
 * los valida y responde 400 con un `code` claro para que el front no dependa del mensaje.
 */
export class ListAuditActionsQuery {
  /** `sub` de Keycloak del usuario. */
  @IsOptional() @IsString() userId?: string;
  /** Módulo curricular (CA-02). */
  @IsOptional() @IsString() moduleId?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() result?: string;
  /** `YYYY-MM-DD` en hora de Bogotá, incluida. */
  @IsOptional() @IsString() from?: string;
  /** `YYYY-MM-DD` en hora de Bogotá, incluida. */
  @IsOptional() @IsString() to?: string;
  /** Busca en el nombre o correo del usuario, la acción y sobre qué se hizo. */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

export interface AuditActionsFilters {
  userId?: string;
  moduleId?: string;
  area?: string;
  result?: AuditResult;
  /** Primer instante del día `from` en Bogotá. */
  from?: Date;
  /** Último instante del día `to` en Bogotá. */
  to?: Date;
  q?: string;
  page: number;
  pageSize: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Q_MAX_LENGTH = 150;

const text = (value: string | undefined) => value?.trim() || undefined;

function positiveInteger(value: string | undefined, name: string) {
  if (value === undefined || value.trim() === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw auditBadRequest(
      'INVALID_PAGE',
      `${name} debe ser un número entero mayor que 0`,
    );
  }
  return number;
}

function date(value: string | undefined, name: string) {
  const iso = text(value);
  if (iso === undefined) return undefined;
  if (!isIsoDate(iso)) {
    throw auditBadRequest(
      'INVALID_DATE',
      `${name} debe ser una fecha válida con el formato AAAA-MM-DD`,
    );
  }
  return iso;
}

export function parseAuditActionsQuery(
  query: ListAuditActionsQuery,
): AuditActionsFilters {
  const result = text(query.result);
  if (result !== undefined && !AUDIT_RESULTS.includes(result as AuditResult)) {
    throw auditBadRequest(
      'INVALID_RESULT',
      `El resultado debe ser uno de: ${AUDIT_RESULTS.join(', ')}`,
    );
  }
  const moduleId = text(query.moduleId);
  if (moduleId !== undefined && !UUID.test(moduleId)) {
    throw auditBadRequest('INVALID_MODULE', 'El módulo no es válido');
  }

  const from = date(query.from, 'La fecha inicial');
  const to = date(query.to, 'La fecha final');
  if (from && to && from > to) {
    throw auditBadRequest(
      'INVALID_DATE_RANGE',
      'La fecha inicial no puede ser posterior a la fecha final',
    );
  }

  const pageSize = positiveInteger(query.pageSize, 'pageSize');
  return {
    userId: text(query.userId),
    moduleId,
    area: text(query.area),
    result: result as AuditResult | undefined,
    // Inicio del día = fin del día anterior + 1 ms, en hora de Bogotá.
    from: from
      ? new Date(
          endOfDayInZone(addDays(from, -1), AUDIT_TIME_ZONE).getTime() + 1,
        )
      : undefined,
    to: to ? endOfDayInZone(to, AUDIT_TIME_ZONE) : undefined,
    q: text(query.q)?.slice(0, Q_MAX_LENGTH),
    page: positiveInteger(query.page, 'page') ?? 1,
    pageSize: Math.min(pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
