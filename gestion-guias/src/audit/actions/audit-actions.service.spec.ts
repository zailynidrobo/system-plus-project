import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { FindManyOptions, FindOperator, Repository } from 'typeorm';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../auth/keycloak-roles.guard.js';
import { Role } from '../../users/entities/user.entity.js';
import { AuditActionsController } from './audit-actions.controller.js';
import { AuditActionsService } from './audit-actions.service.js';
import { AuditEventRecord } from './audit-event.entity.js';

const POO = '11111111-1111-4111-8111-111111111111';
const BD = '22222222-2222-4222-8222-222222222222';

/** Texto de un patrón ILIKE (`%a\_b%`) a expresión regular. */
function likeToRegex(pattern: string) {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\')
      source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (char === '%') source += '.*';
    else if (char === '_') source += '.';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'is');
}

/** Evalúa las condiciones de TypeORM que usa el servicio, como lo haría PostgreSQL. */
function matches(value: unknown, condition: unknown): boolean {
  if (!(condition instanceof FindOperator)) return value === condition;
  const operand = condition.value as unknown;
  switch (condition.type) {
    case 'and':
      return (operand as FindOperator<unknown>[]).every((c) =>
        matches(value, c),
      );
    case 'moreThanOrEqual':
      return (value as Date) >= (operand as Date);
    case 'lessThanOrEqual':
      return (value as Date) <= (operand as Date);
    case 'ilike':
      return (
        typeof value === 'string' && likeToRegex(operand as string).test(value)
      );
    default:
      throw new Error(`Condición no soportada en la prueba: ${condition.type}`);
  }
}

/** Repositorio simulado en memoria: filtra, ordena y pagina igual que `findAndCount`. */
function memoryRepository(rows: AuditEventRecord[]) {
  return {
    findAndCount: async (options: FindManyOptions<AuditEventRecord>) => {
      const where = Array.isArray(options.where)
        ? options.where
        : [options.where ?? {}];
      const found = rows
        .filter((row) =>
          where.some((conditions) =>
            Object.entries(conditions).every(([key, condition]) =>
              matches(row[key as keyof AuditEventRecord], condition),
            ),
          ),
        )
        .sort(
          (a, b) =>
            b.occurredAt.getTime() - a.occurredAt.getTime() ||
            b.id.localeCompare(a.id),
        );
      const skip = options.skip ?? 0;
      return [
        found.slice(skip, skip + (options.take ?? found.length)),
        found.length,
      ];
    },
    findOneBy: async ({ id }: { id: string }) =>
      rows.find((row) => row.id === id) ?? null,
  } as unknown as Repository<AuditEventRecord>;
}

let sequence = 0;
function event(overrides: Partial<AuditEventRecord>): AuditEventRecord {
  sequence++;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    occurredAt: new Date('2026-11-05T15:00:00Z'),
    actorId: 'coord-laura',
    actorName: 'Laura Muñoz',
    actorEmail: 'laura@example.com',
    actorRole: 'coordinador',
    method: 'PATCH',
    route: '/modules/:moduleId',
    path: `/modules/${POO}`,
    area: 'Programa y módulos',
    action: 'Editar módulos',
    result: 'success',
    statusCode: 200,
    ip: '10.0.0.7',
    userAgent: 'Vitest',
    entityType: 'module',
    entityId: POO,
    entityLabel: 'Programación Orientada a Objetos',
    moduleId: POO,
    moduleName: 'Programación Orientada a Objetos',
    details: { fields: ['description'] },
    ...overrides,
  };
}

const errorCode = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    const response = (error as HttpException).getResponse() as {
      code: string;
      statusCode: number;
    };
    return `${response.statusCode} ${response.code}`;
  }
  throw new Error('Se esperaba un error');
};

describe('Consulta del registro de auditoría (HE-08-HU-01)', () => {
  let rows: AuditEventRecord[];
  let service: AuditActionsService;

  beforeEach(() => {
    rows = [
      event({ occurredAt: new Date('2026-11-05T15:00:00Z') }),
      event({
        occurredAt: new Date('2026-11-05T16:00:00Z'),
        method: 'PATCH',
        route: '/academic/guides/:id/publish',
        area: 'Guías base',
        action: 'Publicar guías',
        entityType: 'guide',
        entityLabel: 'GB-POO-01 · Guía de clases',
      }),
      event({
        occurredAt: new Date('2026-11-05T17:00:00Z'),
        moduleId: BD,
        moduleName: 'Bases de Datos',
        entityLabel: 'Bases de Datos',
      }),
      event({
        occurredAt: new Date('2026-11-05T18:00:00Z'),
        actorId: 'teacher-julian',
        actorName: 'Julián Ospina',
        actorEmail: 'julian@example.com',
        actorRole: 'docente',
        result: 'denied',
        statusCode: 403,
      }),
      event({
        occurredAt: new Date('2026-11-05T19:00:00Z'),
        actorId: null,
        actorName: null,
        actorEmail: 'intruso@example.com',
        actorRole: null,
        method: 'POST',
        route: '/auth/login',
        area: 'Sesión',
        action: 'Inicio de sesión fallido',
        result: 'failed',
        statusCode: 401,
        entityType: 'session',
        entityId: null,
        entityLabel: 'intruso@example.com',
        moduleId: null,
        moduleName: null,
      }),
    ];
    service = new AuditActionsService(memoryRepository(rows));
  });

  it('CA-01: cada evento trae usuario, acción, fecha y hora e IP de origen', async () => {
    const { items } = await service.findAll({});
    const publish = items.find((item) => item.action === 'Publicar guías')!;
    expect(publish).toEqual({
      id: expect.any(String),
      occurredAt: new Date('2026-11-05T16:00:00Z'),
      user: {
        id: 'coord-laura',
        name: 'Laura Muñoz',
        email: 'laura@example.com',
        role: 'coordinador',
        roleLabel: 'Coordinador Académico',
      },
      area: 'Guías base',
      action: 'Publicar guías',
      result: 'success',
      statusCode: 200,
      ip: '10.0.0.7',
      entity: { type: 'guide', id: POO, label: 'GB-POO-01 · Guía de clases' },
      module: { id: POO, name: 'Programación Orientada a Objetos' },
    });
    const login = items.find((item) => item.area === 'Sesión')!;
    expect(login.module).toBeNull();
    expect(login.user.roleLabel).toBeNull();
  });

  it('del más reciente al más antiguo', async () => {
    const { items, total } = await service.findAll({});
    expect(total).toBe(5);
    const times = items.map((item) => item.occurredAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('CA-02: filtrar por módulo solo devuelve las acciones de ese módulo', async () => {
    const { items, total } = await service.findAll({ moduleId: POO });
    expect(total).toBe(3);
    expect(items.every((item) => item.module?.id === POO)).toBe(true);
  });

  it('filtra por usuario, área y resultado', async () => {
    const julian = await service.findAll({ userId: 'teacher-julian' });
    expect(julian.items.map((item) => item.user.name)).toEqual([
      'Julián Ospina',
    ]);

    const sesion = await service.findAll({ area: 'Sesión' });
    expect(sesion.items.map((item) => item.action)).toEqual([
      'Inicio de sesión fallido',
    ]);

    const denegados = await service.findAll({ result: 'denied' });
    expect(denegados.items.map((item) => item.statusCode)).toEqual([403]);
  });

  it('las fechas son de Bogotá y `to` queda incluido', async () => {
    rows.push(
      // 4 nov, 11:30 p. m. en Bogotá.
      event({ occurredAt: new Date('2026-11-05T04:30:00Z'), action: 'antes' }),
      // 5 nov, 11:59 p. m. en Bogotá.
      event({
        occurredAt: new Date('2026-11-06T04:59:00Z'),
        action: 'al final del día',
      }),
      // 6 nov, 12:00 a. m. en Bogotá.
      event({
        occurredAt: new Date('2026-11-06T05:00:00Z'),
        action: 'después',
      }),
    );
    const { items } = await service.findAll({
      from: '2026-11-05',
      to: '2026-11-05',
    });
    const actions = items.map((item) => item.action);
    expect(actions).toContain('al final del día');
    expect(actions).not.toContain('antes');
    expect(actions).not.toContain('después');
    expect(items).toHaveLength(6);

    const desde = await service.findAll({ from: '2026-11-06' });
    expect(desde.items.map((item) => item.action)).toEqual(['después']);
  });

  it('`q` busca en el nombre o correo del usuario, la acción y sobre qué se hizo', async () => {
    const byName = await service.findAll({ q: 'julián' });
    expect(byName.total).toBe(1);
    const byEmail = await service.findAll({ q: 'INTRUSO@' });
    expect(byEmail.total).toBe(1);
    const byAction = await service.findAll({ q: 'publicar' });
    expect(byAction.total).toBe(1);
    const byEntity = await service.findAll({ q: 'GB-POO-01' });
    expect(byEntity.total).toBe(1);
    // `%` se busca literal, no como comodín.
    expect((await service.findAll({ q: '%' })).total).toBe(0);
  });

  it('pagina con 20 por defecto y como máximo 100', async () => {
    for (let i = 0; i < 25; i++) {
      rows.push(event({ occurredAt: new Date(Date.UTC(2026, 9, 1, 0, i)) }));
    }
    const first = await service.findAll({});
    expect(first).toMatchObject({ total: 30, page: 1, pageSize: 20 });
    expect(first.items).toHaveLength(20);

    const second = await service.findAll({ page: '2', pageSize: '20' });
    expect(second.items).toHaveLength(10);
    expect(second.items[0].occurredAt.getTime()).toBeLessThan(
      first.items[19].occurredAt.getTime(),
    );

    expect((await service.findAll({ pageSize: '500' })).pageSize).toBe(100);
  });

  it('valida los filtros con códigos claros', async () => {
    expect(await errorCode(service.findAll({ from: '2026-02-30' }))).toBe(
      '400 INVALID_DATE',
    );
    expect(await errorCode(service.findAll({ to: '05/11/2026' }))).toBe(
      '400 INVALID_DATE',
    );
    expect(
      await errorCode(
        service.findAll({ from: '2026-11-06', to: '2026-11-05' }),
      ),
    ).toBe('400 INVALID_DATE_RANGE');
    expect(await errorCode(service.findAll({ result: 'ok' }))).toBe(
      '400 INVALID_RESULT',
    );
    expect(await errorCode(service.findAll({ moduleId: 'poo' }))).toBe(
      '400 INVALID_MODULE',
    );
    expect(await errorCode(service.findAll({ page: '0' }))).toBe(
      '400 INVALID_PAGE',
    );
    expect(await errorCode(service.findAll({ pageSize: 'diez' }))).toBe(
      '400 INVALID_PAGE',
    );
  });

  it('el detalle trae `details` y responde 404 si el evento no existe', async () => {
    const detail = await service.findOne(rows[0].id);
    expect(detail).toMatchObject({
      method: 'PATCH',
      route: '/modules/:moduleId',
      path: `/modules/${POO}`,
      userAgent: 'Vitest',
      details: { fields: ['description'] },
    });
    expect(
      await errorCode(service.findOne('99999999-9999-4999-8999-999999999999')),
    ).toBe('404 NOT_FOUND');
    expect(await errorCode(service.findOne('no-existe'))).toBe('404 NOT_FOUND');
  });

  it('el registro es solo para el administrador', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AuditActionsController)).toEqual([
      Role.ADMIN,
    ]);
  });
});
