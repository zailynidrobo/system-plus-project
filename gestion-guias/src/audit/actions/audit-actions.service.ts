import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  And,
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Role } from '../../users/entities/user.entity.js';
import { ROLE_LABELS } from '../permissions/role-permissions.service.js';
import { AuditEventRecord } from './audit-event.entity.js';
import { auditNotFound } from './audit-errors.js';
import {
  AuditActionsFilters,
  ListAuditActionsQuery,
  parseAuditActionsQuery,
} from './dto/list-audit-actions.query.js';

/** Fila del registro, tal como la recibe el front (SYS-73). */
export interface AuditActionItem {
  id: string;
  occurredAt: Date;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    role: string | null;
    /** Etiqueta del rol (Administrador, Coordinador Académico...), la misma de HE-08-HU-02. */
    roleLabel: string | null;
  };
  area: string;
  action: string;
  result: AuditEventRecord['result'];
  statusCode: number;
  ip: string | null;
  entity: { type: string | null; id: string | null; label: string | null };
  module: { id: string; name: string | null } | null;
}

export interface AuditActionDetail extends AuditActionItem {
  method: string;
  route: string;
  path: string;
  userAgent: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditActionsPage {
  items: AuditActionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditFilterOptions {
  users: { id: string; name: string | null; email: string | null }[];
  modules: { id: string; name: string | null }[];
  areas: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `%` y `_` del texto buscado se toman literalmente. */
const contains = (q: string) => ILike(`%${q.replace(/[\\%_]/g, '\\$&')}%`);

/** HE-08-HU-01: consulta del registro de auditoría. Solo lectura; los eventos no se editan. */
@Injectable()
export class AuditActionsService {
  constructor(
    @InjectRepository(AuditEventRecord)
    private readonly events: Repository<AuditEventRecord>,
  ) {}

  /** Registro paginado, del más reciente al más antiguo. */
  async findAll(query: ListAuditActionsQuery): Promise<AuditActionsPage> {
    const filters = parseAuditActionsQuery(query);
    const [records, total] = await this.events.findAndCount({
      where: this.where(filters),
      order: { occurredAt: 'DESC', id: 'DESC' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    });
    return {
      items: records.map((record) => this.toItem(record)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async findOne(id: string): Promise<AuditActionDetail> {
    const record = UUID.test(id) ? await this.events.findOneBy({ id }) : null;
    if (!record) {
      throw auditNotFound('NOT_FOUND', 'El evento de auditoría no existe');
    }
    return {
      ...this.toItem(record),
      method: record.method,
      route: record.route,
      path: record.path,
      userAgent: record.userAgent,
      details: record.details,
    };
  }

  /** Opciones de los filtros, sacadas de lo que ya está registrado. */
  async filterOptions(): Promise<AuditFilterOptions> {
    // DISTINCT ON se queda con el nombre más reciente de cada usuario y de cada módulo.
    const [users, modules, areas] = await Promise.all([
      this.events
        .createQueryBuilder('event')
        .distinctOn(['event.actorId'])
        .select('event.actorId', 'id')
        .addSelect('event.actorName', 'name')
        .addSelect('event.actorEmail', 'email')
        .where('event.actorId IS NOT NULL')
        .orderBy('event.actorId')
        .addOrderBy('event.occurredAt', 'DESC')
        .getRawMany<AuditFilterOptions['users'][number]>(),
      this.events
        .createQueryBuilder('event')
        .distinctOn(['event.moduleId'])
        .select('event.moduleId', 'id')
        .addSelect('event.moduleName', 'name')
        .where('event.moduleId IS NOT NULL')
        .orderBy('event.moduleId')
        .addOrderBy('event.occurredAt', 'DESC')
        .getRawMany<AuditFilterOptions['modules'][number]>(),
      this.events
        .createQueryBuilder('event')
        .select('DISTINCT event.area', 'area')
        .getRawMany<{ area: string }>(),
    ]);
    const byName = (a: { name: string | null }, b: { name: string | null }) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'es');
    return {
      users: users.sort(byName),
      modules: modules.sort(byName),
      areas: areas
        .map((row) => row.area)
        .sort((a, b) => a.localeCompare(b, 'es')),
    };
  }

  /** Filtros combinados con Y; `q` busca en cualquiera de sus columnas (O). */
  private where(
    filters: AuditActionsFilters,
  ): FindOptionsWhere<AuditEventRecord> | FindOptionsWhere<AuditEventRecord>[] {
    const base: FindOptionsWhere<AuditEventRecord> = {};
    if (filters.userId) base.actorId = filters.userId;
    if (filters.moduleId) base.moduleId = filters.moduleId;
    if (filters.area) base.area = filters.area;
    if (filters.result) base.result = filters.result;
    if (filters.from && filters.to) {
      base.occurredAt = And(
        MoreThanOrEqual(filters.from),
        LessThanOrEqual(filters.to),
      );
    } else if (filters.from) {
      base.occurredAt = MoreThanOrEqual(filters.from);
    } else if (filters.to) {
      base.occurredAt = LessThanOrEqual(filters.to);
    }
    if (!filters.q) return base;
    const q = contains(filters.q);
    return (['actorName', 'actorEmail', 'action', 'entityLabel'] as const).map(
      (column) => ({ ...base, [column]: q }),
    );
  }

  private toItem(record: AuditEventRecord): AuditActionItem {
    return {
      id: record.id,
      occurredAt: record.occurredAt,
      user: {
        id: record.actorId,
        name: record.actorName,
        email: record.actorEmail,
        role: record.actorRole,
        roleLabel: ROLE_LABELS[record.actorRole as Role] ?? null,
      },
      area: record.area,
      action: record.action,
      result: record.result,
      statusCode: record.statusCode,
      ip: record.ip,
      entity: {
        type: record.entityType,
        id: record.entityId,
        label: record.entityLabel,
      },
      module: record.moduleId
        ? { id: record.moduleId, name: record.moduleName }
        : null,
    };
  }
}
