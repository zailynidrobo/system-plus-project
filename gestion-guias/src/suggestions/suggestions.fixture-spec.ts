/**
 * Base en memoria para las pruebas unitarias de HE-05. Imita lo que usan los servicios de
 * TypeORM (repositorios, EntityManager y transacciones con rollback). No es un archivo de
 * pruebas: el sufijo `-spec.ts` lo deja fuera del build y `vitest` no lo ejecuta solo.
 */
import { randomUUID } from 'node:crypto';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import type { GuideField } from '../academic/academic.entities.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { GuideEventRecord } from '../academic/entities/guide-event-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../academic/entities/personalized-guide-version-record.entity.js';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import type { Clock } from './clock.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { UserNotificationRecord } from './entities/user-notification-record.entity.js';
import { SuggestionActor } from './suggestion-actor.js';
import {
  DEFAULT_SUGGESTION_RULES,
  SuggestionRules,
} from './suggestion-rules.js';
import { SuggestionViewsService } from './suggestion-views.service.js';

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

const matches = (row: Row, where: Where = {}) =>
  Object.entries(where).every(([key, condition]) => {
    const operator = condition as { _type?: string; _value?: unknown } | null;
    if (operator?._type === 'isNull')
      return row[key] === null || row[key] === undefined;
    if (operator?._type === 'in')
      return (operator._value as unknown[]).includes(row[key]);
    return row[key] === condition;
  });

const compare = (a: unknown, b: unknown) => {
  const value = (x: unknown) =>
    x instanceof Date ? x.getTime() : (x as number | string);
  const left = value(a);
  const right = value(b);
  return left < right ? -1 : left > right ? 1 : 0;
};

export class MemoryStore {
  private tables = new Map<Function, Row[]>();
  /** Sentencias SQL directas (p. ej. el bloqueo pg_advisory_xact_lock). */
  readonly queries: { sql: string; params: unknown[] }[] = [];

  rows<T>(entity: Function): T[] {
    if (!this.tables.has(entity)) this.tables.set(entity, []);
    return this.tables.get(entity) as unknown as T[];
  }

  private find(
    entity: Function,
    options: {
      where?: Where;
      order?: Record<string, 'ASC' | 'DESC'>;
      take?: number;
    } = {},
  ) {
    let rows = this.rows<Row>(entity).filter((row) =>
      matches(row, options.where),
    );
    const [orderKey, direction] = Object.entries(options.order ?? {})[0] ?? [];
    if (orderKey) {
      rows = [...rows].sort(
        (a, b) =>
          (direction === 'DESC' ? -1 : 1) * compare(a[orderKey], b[orderKey]),
      );
    }
    return structuredClone(rows.slice(0, options.take ?? rows.length));
  }

  private save(entity: Function, input: Row | Row[]) {
    const saveOne = (item: Row) => {
      const table = this.rows<Row>(entity);
      const copy = structuredClone(item);
      const index = table.findIndex((row) => row.id === copy.id);
      if (index < 0) table.push(copy);
      else table[index] = copy;
      return structuredClone(copy);
    };
    return Array.isArray(input) ? input.map(saveOne) : saveOne(input);
  }

  readonly manager = {
    query: async (sql: string, params: unknown[] = []) => {
      this.queries.push({ sql, params });
      return [];
    },
    findOne: async (entity: Function, options: { where: Where }) =>
      this.find(entity, options)[0] ?? null,
    findOneBy: async (entity: Function, where: Where) =>
      this.find(entity, { where })[0] ?? null,
    find: async (entity: Function, options: { where?: Where } = {}) =>
      this.find(entity, options),
    save: async (entity: Function, input: Row | Row[]) =>
      this.save(entity, input),
    maximum: async (entity: Function, column: string) => {
      const values = this.rows<Row>(entity).map((row) => row[column] as number);
      return values.length ? Math.max(...values) : null;
    },
  };

  repository<T extends ObjectLiteral>(entity: Function): Repository<T> {
    const repository = {
      find: async (
        options: {
          where?: Where;
          order?: Record<string, 'ASC' | 'DESC'>;
          take?: number;
        } = {},
      ) => this.find(entity, options),
      findBy: async (where: Where) => this.find(entity, { where }),
      findOneBy: async (where: Where) =>
        this.find(entity, { where })[0] ?? null,
      countBy: async (where: Where) => this.find(entity, { where }).length,
      save: async (input: Row) => this.save(entity, input),
      update: async (where: Where, changes: Where) => {
        const rows = this.rows<Row>(entity).filter((row) =>
          matches(row, where),
        );
        rows.forEach((row) => Object.assign(row, structuredClone(changes)));
        return { affected: rows.length, raw: [], generatedMaps: [] };
      },
    };
    return repository as unknown as Repository<T>;
  }

  /** Transacción con rollback: si el callback falla, las tablas vuelven a como estaban. */
  readonly dataSource = {
    transaction: async <T>(
      callback: (manager: MemoryStore['manager']) => Promise<T>,
    ) => {
      const snapshot = new Map(
        [...this.tables].map(([entity, rows]) => [
          entity,
          structuredClone(rows),
        ]),
      );
      try {
        return await callback(this.manager);
      } catch (error) {
        this.tables = snapshot;
        throw error;
      }
    },
  } as unknown as DataSource;
}

/** Reloj que las pruebas mueven a voluntad. */
export class FakeClock implements Clock {
  private current: Date;
  constructor(iso: string) {
    this.current = new Date(iso);
  }
  now() {
    return new Date(this.current);
  }
  set(iso: string) {
    this.current = new Date(iso);
  }
}

export const JULIAN: SuggestionActor = {
  id: 'teacher-julian',
  name: 'Julián Andrés Ospina',
  roles: ['docente'],
};
export const PAOLA: SuggestionActor = {
  id: 'teacher-paola',
  name: 'Paola Valencia',
  roles: ['docente_autorizado'],
};
export const CARLOS: SuggestionActor = {
  id: 'teacher-carlos',
  name: 'Carlos Ramírez',
  roles: ['docente'],
};
export const LAURA: SuggestionActor = {
  id: 'coord-laura',
  name: 'Laura Muñoz',
  roles: ['coordinador'],
};
export const DIANA: SuggestionActor = {
  id: 'admin-diana',
  name: 'Diana Ruiz',
  roles: ['admin'],
};

export const FIELDS: GuideField[] = [
  {
    key: 'intensidad',
    label: 'Intensidad horaria',
    type: 'select',
    required: true,
    options: ['40 horas · 10 semanas', '60 horas · 15 semanas'],
  },
  {
    key: 'criterios',
    label: 'Criterios de evaluación',
    type: 'textarea',
    required: true,
    maxLength: 120,
  },
  {
    key: 'recursos',
    label: 'Recursos y bibliografía',
    type: 'textarea',
    required: false,
  },
  { key: 'semanas', label: 'Semanas', type: 'number', required: false },
];

export const JUSTIFICATION =
  'La sustentación permite evaluar la comprensión real del estudiante.';

/** Escenario base: módulo POO con una guía publicada en v1.0 y Julián, Paola y Carlos asignados. */
export function createScenario(
  options: { now?: string; rules?: Partial<SuggestionRules> } = {},
) {
  const store = new MemoryStore();
  // Viernes 30 oct 2026, 10:00 a. m. en Bogotá.
  const clock = new FakeClock(options.now ?? '2026-10-30T15:00:00.000Z');
  const rules: SuggestionRules = {
    ...DEFAULT_SUGGESTION_RULES,
    ...options.rules,
  };

  const module = {
    id: randomUUID(),
    name: 'Programación Orientada a Objetos',
    competencyPrefix: 'POO',
  } as CurricularModule;
  store.rows<CurricularModule>(CurricularModule).push(module);

  const addGuide = (overrides: Partial<AcademicGuideRecord> = {}) => {
    const guide = {
      id: randomUUID(),
      code: 'GB-POO-01',
      moduleId: module.id,
      moduleName: module.name,
      competencyId: null,
      competencyName: null,
      title: 'Guía base · Programación Orientada a Objetos',
      content: {
        intensidad: '40 horas · 10 semanas',
        criterios: 'Evidencia de producto: aplicación CRUD.',
        recursos: 'Documentación oficial de Java SE.',
        semanas: 10,
      },
      fields: FIELDS,
      structureVersion: 1,
      version: 'v1.0',
      status: 'published',
      createdById: LAURA.id,
      createdByName: LAURA.name,
      updatedById: LAURA.id,
      updatedByName: LAURA.name,
      publishedById: LAURA.id,
      publishedByName: LAURA.name,
      createdAt: new Date('2026-09-01T12:00:00Z'),
      updatedAt: new Date('2026-09-01T12:00:00Z'),
      publishedAt: new Date('2026-09-01T12:00:00Z'),
      ...overrides,
    } as AcademicGuideRecord;
    store.rows<AcademicGuideRecord>(AcademicGuideRecord).push(guide);
    return guide;
  };
  const assign = (teacherId: string, moduleId = module.id) =>
    store
      .rows<ModuleTeacherAssignmentRecord>(ModuleTeacherAssignmentRecord)
      .push({ id: randomUUID(), moduleId, teacherId });
  const addVersion = (guide: AcademicGuideRecord, teacherId: string) => {
    const version = {
      id: randomUUID(),
      baseGuideId: guide.id,
      moduleId: guide.moduleId,
      moduleName: guide.moduleName,
      teacherId,
      title: guide.title,
      name: `Mi versión ${teacherId}`,
      baseContent: structuredClone(guide.content),
      baseFields: guide.fields,
      content: { criterios: 'Mi propio criterio' },
      fields: [],
      createdAt: new Date('2026-09-10T12:00:00Z'),
      updatedAt: new Date('2026-09-10T12:00:00Z'),
    } as PersonalizedGuideVersionRecord;
    store
      .rows<PersonalizedGuideVersionRecord>(PersonalizedGuideVersionRecord)
      .push(version);
    return version;
  };

  const guide = addGuide();
  assign(JULIAN.id);
  assign(PAOLA.id);
  assign(CARLOS.id);

  const views = new SuggestionViewsService(
    store.repository(SuggestionRecord),
    store.repository(AcademicGuideRecord),
    store.repository(CurricularModule),
    clock,
    rules,
  );

  return {
    store,
    clock,
    rules,
    module,
    guide,
    views,
    addGuide,
    assign,
    addVersion,
    suggestions: () => store.rows<SuggestionRecord>(SuggestionRecord),
    notifications: () =>
      store.rows<UserNotificationRecord>(UserNotificationRecord),
    events: () => store.rows<GuideEventRecord>(GuideEventRecord),
    guideRow: (id = guide.id) =>
      store
        .rows<AcademicGuideRecord>(AcademicGuideRecord)
        .find((g) => g.id === id)!,
    versions: () =>
      store.rows<PersonalizedGuideVersionRecord>(
        PersonalizedGuideVersionRecord,
      ),
  };
}

export type Scenario = ReturnType<typeof createScenario>;

/** Atrapa el error HTTP de Nest y devuelve su cuerpo `{ statusCode, code, message }`. */
export async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const response = (error as { getResponse?: () => unknown }).getResponse?.();
    return response as { statusCode: number; code?: string; message: string };
  }
  throw new Error('Se esperaba un error');
}
