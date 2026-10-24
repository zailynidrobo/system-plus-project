import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { AcademicService } from './academic.service.js';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import { GuideEventRecord } from './entities/guide-event-record.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../academic-program/entities/curricular-module.entity.js';
import { Competency } from '../academic-program/entities/competency.entity.js';
import { GuideFieldConfigRecord } from './entities/guide-field-config-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from './entities/personalized-guide-version-record.entity.js';
import { GuideSupportMaterialRecord } from './entities/guide-support-material-record.entity.js';

/** Quien sube materiales en las pruebas de HE-03. */
const COORDINADOR = { id: 'coord-1', name: 'Coordinación', roles: ['coordinador'] };

function memoryRepository<T extends { id: string }>() {
  const records: T[] = [];
  // Igual que TypeORM: las consultas no devuelven registros con borrado lógico (`deletedAt`).
  const live = () =>
    records.filter(
      (record) => !(record as { deletedAt?: Date | null }).deletedAt,
    );
  const matches = (record: T, where: FindOptionsWhere<T>) =>
    Object.entries(where).every(([key, condition]) => {
      const operator = condition as { _type?: string } | null;
      const databaseValue = record[key as keyof T];
      if (operator?._type === 'isNull') return databaseValue === null;
      if (operator?._type === 'in') {
        const values = (operator as { _value?: unknown[] })._value ?? [];
        return values.includes(databaseValue);
      }
      if (operator?._type === 'ilike') {
        const patternValue = (operator as { _value?: unknown })._value;
        const pattern =
          typeof patternValue === 'string'
            ? patternValue.replace(/^%|%$/g, '').replace(/\\/g, '')
            : '';
        return String(databaseValue ?? '')
          .toLocaleLowerCase()
          .includes(pattern.toLocaleLowerCase());
      }
      return databaseValue === condition;
    });

  const repository = {
    find: async (options?: {
      where?: FindOptionsWhere<T>;
      withDeleted?: boolean;
    }) => {
      const available = options?.withDeleted ? records : live();
      return options?.where
        ? available.filter((record) => matches(record, options.where!))
        : [...available];
    },
    findBy: async (where: FindOptionsWhere<T>) =>
      live().filter((record) => matches(record, where)),
    findAndCount: async (options: {
      where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
      order?: Record<string, 'ASC' | 'DESC'>;
      skip?: number;
      take?: number;
    }) => {
      const filtered = live()
        .filter((record) =>
          Array.isArray(options.where)
            ? options.where.some((where) => matches(record, where))
            : options.where
              ? matches(record, options.where)
              : true,
        )
        .sort((left, right) => {
          const direction = options.order?.['updatedAt'];
          if (!direction) return 0;
          const a = String(left['updatedAt'] ?? '');
          const b = String(right['updatedAt'] ?? '');
          return direction === 'DESC' ? b.localeCompare(a) : a.localeCompare(b);
        });
      const total = filtered.length;
      const start = options.skip ?? 0;
      return [filtered.slice(start, start + (options.take ?? total)), total] as const;
    },
    findOne: async (options: {
      where: FindOptionsWhere<T>;
      withDeleted?: boolean;
    }) =>
      (options.withDeleted ? records : live()).find((record) =>
        matches(record, options.where),
      ) ?? null,
    findOneBy: async (where: FindOptionsWhere<T>) =>
      live().find((record) => matches(record, where)) ?? null,
    countBy: async (where: FindOptionsWhere<T>) =>
      live().filter((record) => matches(record, where)).length,
    findByIds: async (ids: string[]) =>
      records.filter((record) => ids.includes(record.id)),
    save: async (record: T | T[]) => {
      const saveOne = (item: T) => {
        const index = records.findIndex((existing) => existing.id === item.id);
        if (index < 0) records.push(item);
        else records[index] = item;
        return item;
      };
      return Array.isArray(record) ? record.map(saveOne) : saveOne(record);
    },
    remove: async (record: T) => {
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) records.splice(index, 1);
      return record;
    },
    delete: async (criteria: string | FindOptionsWhere<T>) => {
      const where =
        typeof criteria === 'string'
          ? ({ id: criteria } as FindOptionsWhere<T>)
          : criteria;
      const toDelete = records.filter((record) => matches(record, where));
      for (const record of toDelete) {
        records.splice(records.indexOf(record), 1);
      }
      return { affected: toDelete.length, raw: [] };
    },
  };

  return repository as unknown as Repository<T>;
}

describe('AcademicService HE-03 sobre módulos y competencias de HE-02', () => {
  let service: AcademicService;
  let repositories: [
    Repository<CurricularModule>,
    Repository<Competency>,
    Repository<GuideFieldConfigRecord>,
    Repository<AcademicGuideRecord>,
    Repository<PersonalizedGuideVersionRecord>,
    Repository<ModuleTeacherAssignmentRecord>,
    Repository<GuideSupportMaterialRecord>,
    Repository<GuideEventRecord>,
  ];
  let dataSource: DataSource;

  beforeEach(() => {
    repositories = [
      memoryRepository<CurricularModule>(),
      memoryRepository<Competency>(),
      memoryRepository<GuideFieldConfigRecord>(),
      memoryRepository<AcademicGuideRecord>(),
      memoryRepository<PersonalizedGuideVersionRecord>(),
      memoryRepository<ModuleTeacherAssignmentRecord>(),
      memoryRepository<GuideSupportMaterialRecord>(),
      memoryRepository<GuideEventRecord>(),
    ];
    const repositoryFor = (entity: Function) => {
      if (entity === CurricularModule) return repositories[0];
      if (entity === Competency) return repositories[1];
      if (entity === GuideFieldConfigRecord) return repositories[2];
      if (entity === AcademicGuideRecord) return repositories[3];
      if (entity === GuideEventRecord) return repositories[7];
      throw new Error(`Unexpected entity: ${entity.name}`);
    };
    const manager = {
      findOne: (
        entity: Function,
        options: { where: FindOptionsWhere<{ id: string }> },
      ) => repositoryFor(entity).findOne(options),
      findOneBy: (entity: Function, where: FindOptionsWhere<{ id: string }>) =>
        repositoryFor(entity).findOneBy(where),
      countBy: (entity: Function, where: FindOptionsWhere<{ id: string }>) =>
        repositoryFor(entity).countBy(where),
      find: (
        entity: Function,
        options: { where: FindOptionsWhere<{ id: string }> },
      ) => repositoryFor(entity).find(options),
      save: (entity: Function, record: { id: string }) =>
        repositoryFor(entity).save(record),
    };
    dataSource = {
      transaction: <T>(
        callback: (transactionManager: typeof manager) => Promise<T>,
      ) => callback(manager),
    } as unknown as DataSource;
    service = new AcademicService(...repositories, dataSource);
  });

  /** Módulo de HE-02 ya guardado (en producción lo crea `CurricularModulesService`). */
  const seedModule = async (
    name: string,
    status: CurricularModuleStatus = CurricularModuleStatus.ACTIVE,
    withCompetency = true,
  ) => {
    const record = {
      id: randomUUID(),
      programId: randomUUID(),
      code: 'TS-MOD-01',
      sequence: 1,
      name,
      normalizedName: name.toLowerCase(),
      description: null,
      status,
      competencyPrefix: 'MOD',
      competencySequence: 0,
      guideSequence: 0,
    } as unknown as CurricularModule;
    const saved = await (repositories[0] as Repository<CurricularModule>).save(
      record,
    );
    // HE-02 solo habilita guías en módulos con al menos una competencia activa.
    if (withCompetency) {
      await seedCompetency(saved, 'Competencia base del módulo');
    }
    return saved;
  };

  /** Competencia de HE-02 ya guardada, asociada a un solo módulo. */
  const seedCompetency = async (
    module: CurricularModule,
    text: string,
    code = 'COMP-MOD-01',
  ) => {
    const record = {
      id: randomUUID(),
      moduleId: module.id,
      code,
      sequence: 1,
      text,
      normalizedText: text.toLowerCase(),
      version: 1,
      deletedAt: null,
    } as unknown as Competency;
    return (repositories[1] as Repository<Competency>).save(record);
  };

  const createGuide = async (
    module: CurricularModule,
    content: Record<string, unknown> = {},
  ) => {
    const competency = await (
      repositories[1] as Repository<Competency>
    ).findOneBy({
      moduleId: module.id,
    });
    if (!competency) throw new Error('Test module must have a competency');
    return service.createGuide({
      moduleId: module.id,
      competencyId: competency.id,
      content,
    });
  };

  it('assigns codes to existing guides during startup', async () => {
    const module = await seedModule('Legado');
    const legacyGuide = await (
      repositories[3] as Repository<AcademicGuideRecord>
    ).save({
      id: randomUUID(),
      code: null,
      moduleId: module.id,
      moduleName: module.name,
      competencyId: null,
      competencyName: null,
      title: 'Guía anterior',
      content: {},
      fields: [],
      structureVersion: 1,
      version: 'v0',
      status: 'draft',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: null,
    });

    await service.onModuleInit();

    expect(await service.findGuide(legacyGuide.id)).toMatchObject({
      code: 'GB-MOD-01',
      title: 'Guía anterior',
    });
    expect(module.guideSequence).toBe(1);
  });

  it('assigns codes to legacy guides whose module was deleted', async () => {
    const orphanedGuide = await (
      repositories[3] as Repository<AcademicGuideRecord>
    ).save({
      id: randomUUID(),
      code: null,
      moduleId: randomUUID(),
      moduleName: 'Programación Orientada a Objetos',
      competencyId: null,
      competencyName: 'COMP-POO-04 · Diseño orientado a objetos',
      title: 'Guía huérfana',
      content: {},
      fields: [],
      structureVersion: 1,
      version: 'v0',
      status: 'draft',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: null,
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(await service.findGuide(orphanedGuide.id)).toMatchObject({
      code: 'GB-POO-01',
      title: 'Guía huérfana',
    });
  });

  it('requires an existing active HE-02 module to create a guide', async () => {
    const draftModule = await seedModule(
      'Borrador',
      CurricularModuleStatus.DRAFT,
    );
    const inactiveModule = await seedModule(
      'Inhabilitado',
      CurricularModuleStatus.INACTIVE,
    );
    const emptyModule = await seedModule(
      'Sin competencias',
      CurricularModuleStatus.ACTIVE,
      false,
    );
    const guide = async (moduleId: string) => {
      const competency = await (
        repositories[1] as Repository<Competency>
      ).findOneBy({
        moduleId,
      });
      return service.createGuide({
        moduleId,
        competencyId: competency?.id ?? randomUUID(),
        content: {},
      });
    };
    const errorCode = (code: string) => ({
      response: expect.objectContaining({ code }) as unknown,
    });

    await expect(guide(randomUUID())).rejects.toThrow(NotFoundException);
    await expect(guide('no-es-un-uuid')).rejects.toThrow(NotFoundException);
    await expect(guide(draftModule.id)).rejects.toMatchObject(
      errorCode('MODULE_NOT_ACTIVE'),
    );
    await expect(guide(inactiveModule.id)).rejects.toMatchObject(
      errorCode('MODULE_NOT_ACTIVE'),
    );
    await expect(guide(emptyModule.id)).rejects.toMatchObject(
      errorCode('MODULE_WITHOUT_COMPETENCIES'),
    );
  });

  it('only accepts competencies that belong to the guide module and still exist', async () => {
    const module = await seedModule('Programación');
    const other = await seedModule('Bases de datos');
    const own = await seedCompetency(module, 'Aplica estructuras de control');
    const foreign = await seedCompetency(other, 'Diseña esquemas relacionales');
    const create = (competencyId: string) =>
      service.createGuide({
        moduleId: module.id,
        competencyId,
        content: {},
      });

    await expect(create(foreign.id)).rejects.toThrow(
      'La competencia no está asociada a este módulo',
    );
    await expect(create(randomUUID())).rejects.toThrow(NotFoundException);
    await expect(
      service.configureCompetencyGuideFields(module.id, foreign.id, {
        fields: [],
      }),
    ).rejects.toThrow(BadRequestException);

    own.deletedAt = new Date();
    await expect(create(own.id)).rejects.toThrow(NotFoundException);
  });

  it('uses the institutional default fields for API-created guides when no structure exists', async () => {
    const module = await seedModule('Programación');
    const competency = await (
      repositories[1] as Repository<Competency>
    ).findOneBy({ moduleId: module.id });
    if (!competency) throw new Error('Test module must have a competency');

    const config = await service.getBaseGuideFields(module.id, competency.id);
    const draft = await service.createGuide({
      moduleId: module.id,
      competencyId: competency.id,
      content: {
        intensidad: '40 horas · 10 semanas',
        evaluacion: 'Por proyecto',
        objetivos: 'Diseñar soluciones.',
        metodologia: 'Aula invertida',
        criterios: 'Proyecto final.',
      },
    });

    expect(config).toMatchObject({
      moduleId: module.id,
      version: 1,
      origin: 'predeterminada',
    });
    expect(config.fields.map((field) => field.key)).toEqual([
      'intensidad',
      'evaluacion',
      'objetivos',
      'metodologia',
      'criterios',
      'recursos',
    ]);
    expect(draft).toMatchObject({
      status: 'draft',
      structureVersion: 1,
      fields: config.fields,
    });
  });

  it('enforces configured maximum lengths when saving guide content', async () => {
    const module = await seedModule('Programación');
    const competency = await (
      repositories[1] as Repository<Competency>
    ).findOneBy({ moduleId: module.id });
    if (!competency) throw new Error('Test module must have a competency');
    await service.configureModuleGuideFields(module.id, {
      fields: [
        {
          key: 'summary',
          label: 'Resumen',
          type: 'text',
          required: false,
          maxLength: 3,
        },
      ],
    });

    await expect(
      service.createGuide({
        moduleId: module.id,
        competencyId: competency.id,
        content: { summary: 'largo' },
      }),
    ).rejects.toThrow('no puede superar 3 caracteres');
  });

  it('creates, edits, and publishes a guide with competency-specific fields', async () => {
    const module = await seedModule('Historia');
    const competency = await seedCompetency(
      module,
      'Fuentes históricas',
      'COMP-HIS-01',
    );
    expect(await service.previewNextGuideCode(module.id)).toEqual({
      code: 'GB-MOD-01',
    });
    await service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'summary', label: 'Resumen', type: 'text', required: true },
      ],
    });
    await service.configureCompetencyGuideFields(module.id, competency.id, {
      fields: [
        {
          key: 'sourceType',
          label: 'Tipo de fuente',
          type: 'select',
          required: true,
          options: ['primaria', 'secundaria'],
        },
        { key: 'year', label: 'Año', type: 'number', required: false },
      ],
    });

    const draft = await service.createGuide({
      moduleId: module.id,
      competencyId: competency.id,
      content: {},
    });
    expect(draft).toMatchObject({
      code: 'GB-MOD-01',
      title: 'Guía base · Historia',
      structureVersion: 3,
      version: 'v0',
    });
    expect(await service.previewNextGuideCode(module.id)).toEqual({
      code: 'GB-MOD-02',
    });

    await expect(
      service.updateGuide(draft.id, {
        content: { summary: 'No está configurado' },
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.publishGuide(draft.id)).rejects.toThrow(
      BadRequestException,
    );

    await service.updateGuide(draft.id, {
      content: { sourceType: 'secundaria', year: 2020 },
    });
    const published = await service.publishGuide(draft.id);

    expect(published).toMatchObject({
      title: 'Guía base · Historia',
      code: 'GB-MOD-01',
      structureVersion: 3,
      version: 'v1.0',
      competencyDeleted: false,
      status: 'published',
      moduleName: 'Historia',
      competencyName: 'COMP-HIS-01 · Fuentes históricas',
      content: { sourceType: 'secundaria', year: 2020 },
    });
    expect(published.publishedAt).toBeDefined();
    expect(
      await service.findGuideEventsForUser(draft.id, 'coordinator', [
        'coordinador',
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Guía creada como borrador' }),
        expect.objectContaining({ title: 'Tipo de fuente editado' }),
        expect.objectContaining({ title: 'Guía publicada' }),
      ]),
    );
    competency.deletedAt = new Date();
    expect(await service.findGuide(draft.id)).toMatchObject({
      competencyDeleted: true,
      competencyName: 'COMP-HIS-01 · Fuentes históricas',
    });
    await expect(
      service.updateGuide(draft.id, { title: 'Cambio' }),
    ).rejects.toThrow(ConflictException);
  });

  it('preserves published guide snapshots when a module is deactivated', async () => {
    const module = await seedModule('Literatura');
    const draft = await createGuide(module, {
      intensidad: '40 horas · 10 semanas',
      evaluacion: 'Por proyecto',
      objetivos: 'Analizar textos.',
      metodologia: 'Aula invertida',
      criterios: 'Ensayo final.',
    });
    await service.publishGuide(draft.id);
    module.status = CurricularModuleStatus.INACTIVE;

    expect(await service.findGuide(draft.id)).toMatchObject({
      moduleName: 'Literatura',
      status: 'published',
    });
    await expect(createGuide(module)).rejects.toThrow(BadRequestException);
  });

  it('isolates a teacher-owned version from the published guide and other teachers', async () => {
    const module = await seedModule('Ciencias');
    await service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'activity', label: 'Actividad', type: 'text', required: true },
      ],
    });
    await service.configureTeacherGuideFields(module.id, {
      fields: [
        {
          key: 'lessonPlan',
          label: 'Plan de clases',
          type: 'textarea',
          required: false,
          section: 'Planeación',
        },
      ],
    });
    const draft = await createGuide(module, {
      activity: 'Experimento base',
    });
    await service.publishGuide(draft.id);
    await service.assignTeacherToModule(module.id, 'teacher-1');
    await service.assignTeacherToModule(module.id, 'teacher-2');

    const version = await service.createPersonalizedVersion(
      draft.id,
      'teacher-1',
    );
    const edited = await service.updatePersonalizedVersion(
      version.id,
      'teacher-1',
      { content: { lessonPlan: 'Clase 1: práctica guiada' } },
    );

    expect(edited.content).toEqual({
      lessonPlan: 'Clase 1: práctica guiada',
    });
    expect(edited.baseContent).toEqual({ activity: 'Experimento base' });
    expect((await service.findGuide(draft.id)).content).toEqual({
      activity: 'Experimento base',
    });
    await expect(
      service.findPersonalizedVersionForTeacher(version.id, 'teacher-2'),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.createPersonalizedVersion(draft.id, 'unassigned-teacher'),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updatePersonalizedVersion(version.id, 'teacher-1', {
        content: { unknown: 'No configurado' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('names teacher versions, rejects repeated names and fields the teacher cannot edit', async () => {
    const module = await seedModule('Matemáticas');
    await service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'activity', label: 'Actividad', type: 'text', required: true },
      ],
    });
    await service.configureTeacherGuideFields(module.id, {
      fields: [
        {
          key: 'hours',
          label: 'Intensidad horaria',
          type: 'text',
          required: false,
          teacherEditable: false,
        },
        {
          key: 'lessonPlan',
          label: 'Plan de clases',
          type: 'textarea',
          required: false,
        },
      ],
    });
    const draft = await createGuide(module, { activity: 'Base' });
    await service.publishGuide(draft.id);
    await service.assignTeacherToModule(module.id, 'teacher-1');
    await service.assignTeacherToModule(module.id, 'teacher-2');

    const version = await service.createPersonalizedVersion(
      draft.id,
      'teacher-1',
      '  Grupo   2026-1 ',
    );
    expect(version.name).toBe('Grupo 2026-1');

    await expect(
      service.createPersonalizedVersion(draft.id, 'teacher-1', 'grupo 2026-1'),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.createPersonalizedVersion(draft.id, 'teacher-1', '   '),
    ).rejects.toThrow(BadRequestException);
    // Otro docente sí puede usar el mismo nombre.
    await expect(
      service.createPersonalizedVersion(draft.id, 'teacher-2', 'Grupo 2026-1'),
    ).resolves.toMatchObject({ name: 'Grupo 2026-1' });
    // Sin nombre se usa el de la guía base.
    const unnamed = await service.createPersonalizedVersion(
      draft.id,
      'teacher-2',
    );
    expect(unnamed.name).toBe(unnamed.title);

    await expect(
      service.updatePersonalizedVersion(version.id, 'teacher-1', {
        content: { hours: '99' },
      }),
    ).rejects.toThrow(BadRequestException);
    const edited = await service.updatePersonalizedVersion(
      version.id,
      'teacher-1',
      { content: { lessonPlan: 'Clase 1' } },
    );
    expect(edited.content).toEqual({ lessonPlan: 'Clase 1' });
  });

  it('uses the base guide fields when coordination has not configured the teacher form', async () => {
    const module = await seedModule('Matemáticas');
    await service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'activity', label: 'Actividad', type: 'text', required: true },
      ],
    });
    const draft = await createGuide(module, { activity: 'Base' });
    await service.publishGuide(draft.id);
    await service.assignTeacherToModule(module.id, 'teacher-1');

    const version = await service.createPersonalizedVersion(
      draft.id,
      'teacher-1',
      'Grupo A',
    );
    expect(version.fields.map((field) => field.key)).toEqual(['activity']);
    const edited = await service.updatePersonalizedVersion(
      version.id,
      'teacher-1',
      { content: { activity: 'Mi actividad' } },
    );
    expect(edited.content).toEqual({ activity: 'Mi actividad' });
  });

  it('tells a teacher which modules are assigned and how many guides stay hidden', async () => {
    const assigned = await seedModule('Asignado');
    const other = await seedModule('Otro módulo');
    await service.configureModuleGuideFields(assigned.id, {
      fields: [{ key: 'a', label: 'A', type: 'text', required: false }],
    });
    await service.configureModuleGuideFields(other.id, {
      fields: [{ key: 'a', label: 'A', type: 'text', required: false }],
    });
    const mine = await createGuide(assigned, { a: 'x' });
    const theirs = await createGuide(other, { a: 'y' });
    await service.publishGuide(mine.id);
    await service.publishGuide(theirs.id);
    await service.assignTeacherToModule(assigned.id, 'teacher-1');

    expect(await service.findAssignmentsForTeacher('teacher-1')).toEqual({
      moduleIds: [assigned.id],
      hidden: { total: 1, modules: ['Otro módulo'] },
    });
    expect(await service.findAssignmentsForTeacher('nobody')).toEqual({
      moduleIds: [],
      hidden: { total: 2, modules: ['Asignado', 'Otro módulo'] },
    });
  });

  it('lets docente_autorizado read guides like a docente', async () => {
    const module = await seedModule('Autorizado');
    await service.configureModuleGuideFields(module.id, {
      fields: [{ key: 'a', label: 'A', type: 'text', required: false }],
    });
    const guide = await createGuide(module, { a: 'x' });
    await service.publishGuide(guide.id);
    await service.assignTeacherToModule(module.id, 'authorized-1');

    const page = await service.findGuidesForUser(
      {},
      'authorized-1',
      ['docente_autorizado'],
    );
    expect(page.total).toBe(1);
    await expect(
      service.findGuideForUser(guide.id, 'authorized-1', ['docente_autorizado']),
    ).resolves.toMatchObject({ id: guide.id });
  });

  it('counts versions from other teachers in the same module without exposing them', async () => {
    const module = await seedModule('Aislamiento');
    await service.configureModuleGuideFields(module.id, {
      fields: [{ key: 'a', label: 'A', type: 'text', required: false }],
    });
    const guide = await createGuide(module, { a: 'x' });
    await service.publishGuide(guide.id);
    await service.assignTeacherToModule(module.id, 'teacher-1');
    await service.assignTeacherToModule(module.id, 'teacher-2');
    const mine = await service.createPersonalizedVersion(guide.id, 'teacher-1');
    await service.createPersonalizedVersion(guide.id, 'teacher-2', 'Otra');

    expect(
      await service.findPersonalizedVersionIsolation(mine.id, 'teacher-1'),
    ).toEqual({
      moduleName: 'Aislamiento',
      otherVersions: 1,
      otherTeachers: 1,
    });
    await expect(
      service.findPersonalizedVersionIsolation(mine.id, 'teacher-2'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('loads stored guides and personalized versions through a fresh service instance', async () => {
    const module = await seedModule('Persistencia');
    await service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'summary', label: 'Resumen', type: 'text', required: true },
      ],
    });
    await service.configureTeacherGuideFields(module.id, {
      fields: [
        {
          key: 'notes',
          label: 'Notas docentes',
          type: 'textarea',
          required: false,
        },
      ],
    });
    const draft = await createGuide(module, {
      summary: 'Contenido institucional',
    });
    await service.publishGuide(draft.id);
    await service.assignTeacherToModule(module.id, 'teacher-1');
    const version = await service.createPersonalizedVersion(
      draft.id,
      'teacher-1',
    );
    await service.updatePersonalizedVersion(version.id, 'teacher-1', {
      content: { notes: 'Contenido del docente' },
    });

    const restartedService = new AcademicService(...repositories, dataSource);

    expect(await restartedService.findGuide(draft.id)).toMatchObject({
      title: 'Guía base · Persistencia',
      status: 'published',
    });
    expect(
      await restartedService.findGuidesForUser({}, 'teacher-1', ['docente']),
    ).toMatchObject({
      total: 1,
      items: [{ id: draft.id, status: 'published' }],
    });
    expect(
      await restartedService.findPersonalizedVersionsForTeacher('teacher-1'),
    ).toMatchObject([
      {
        id: version.id,
        content: { notes: 'Contenido del docente' },
      },
    ]);
  });

  it('filters and paginates guides, reports summary and preserves author names', async () => {
    const module = await seedModule('Autores');
    await service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'detalle', label: 'Detalle', type: 'text', required: false },
      ],
    });
    const created = await service.createGuide(
      {
        moduleId: module.id,
        competencyId: (await repositories[1].findOneBy({ moduleId: module.id }))!.id,
        content: {},
      },
      { id: 'creator-1', name: 'Juliana Díaz' },
    );
    const draft = await createGuide(module, {});
    await service.publishGuide(created.id, {
      id: 'publisher-1',
      name: 'Sofía Gómez',
    });

    const page = await service.findGuidesForUser(
      { search: 'Autores', status: 'published', page: '1', pageSize: '1' },
      'coordinator-1',
      ['coordinador'],
    );
    expect(page).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 1,
      items: [
        {
          id: created.id,
          createdBy: { id: 'creator-1', name: 'Juliana Díaz' },
          updatedBy: { id: 'publisher-1', name: 'Sofía Gómez' },
          publishedBy: { id: 'publisher-1', name: 'Sofía Gómez' },
        },
      ],
    });

    await expect(
      service.getGuidesSummaryForUser('coordinator-1', ['coordinador']),
    ).resolves.toEqual({
      total: 2,
      modulos: 1,
      publicadas: 1,
      borradores: 1,
    });
    expect(draft.status).toBe('draft');
  });

  it('keeps a teacher module filter within the assigned-module access scope', async () => {
    const firstModule = await seedModule('Primer módulo');
    const secondModule = await seedModule('Segundo módulo');
    for (const module of [firstModule, secondModule]) {
      await service.configureModuleGuideFields(module.id, {
        fields: [
          { key: 'detalle', label: 'Detalle', type: 'text', required: false },
        ],
      });
      const guide = await createGuide(module);
      await service.publishGuide(guide.id);
      await service.assignTeacherToModule(module.id, 'teacher-filter');
    }

    const result = await service.findGuidesForUser(
      { moduleId: firstModule.id },
      'teacher-filter',
      ['docente'],
    );

    expect(result).toMatchObject({
      total: 1,
      items: [{ moduleId: firstModule.id, status: 'published' }],
    });
  });

  it('stores PDF and DOCX support materials and limits teacher downloads to assigned published guides', async () => {
    const module = await seedModule('Materiales');
    const guide = await createGuide(module, {
      intensidad: '40 horas · 10 semanas',
      evaluacion: 'Por proyecto',
      objetivos: 'Desarrollar materiales.',
      metodologia: 'Taller práctico guiado',
      criterios: 'Entrega del material.',
    });
    const pdf = Buffer.from('%PDF-1.7\ncontenido de prueba');
    const uploadedPdf = await service.addGuideSupportMaterial(guide.id, {
      originalname: 'lectura.pdf',
      mimetype: 'application/pdf',
      buffer: pdf,
      size: pdf.length,
    }, COORDINADOR);

    const archive = new JSZip();
    archive.file('word/document.xml', '<document />');
    const docx = await archive.generateAsync({ type: 'nodebuffer' });
    const uploadedDocx = await service.addGuideSupportMaterial(guide.id, {
      originalname: 'actividad.docx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docx,
      size: docx.length,
    }, COORDINADOR);

    await service.assignTeacherToModule(module.id, 'teacher-1');
    await expect(
      service.findGuideSupportMaterialsForUser(guide.id, 'teacher-1', [
        'docente',
      ]),
    ).rejects.toThrow('Guía publicada no encontrada');
    await service.publishGuide(guide.id);

    const materials = await service.findGuideSupportMaterialsForUser(
      guide.id,
      'teacher-1',
      ['docente'],
    );
    expect(materials).toHaveLength(2);
    expect(materials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: uploadedPdf.id,
          fileName: 'lectura.pdf',
          contentType: 'application/pdf',
          size: pdf.length,
        }),
        expect.objectContaining({
          id: uploadedDocx.id,
          fileName: 'actividad.docx',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ]),
    );
    expect(materials[0]).not.toHaveProperty('data');

    const downloaded = await service.getGuideSupportMaterialForUser(
      guide.id,
      uploadedPdf.id,
      'teacher-1',
      ['docente'],
    );
    expect(downloaded.data).toEqual(pdf);
    await expect(
      service.getGuideSupportMaterialForUser(
        guide.id,
        uploadedPdf.id,
        'teacher-2',
        ['docente'],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects support files that are not valid PDF or DOCX documents', async () => {
    const module = await seedModule('Validación de archivos');
    const guide = await createGuide(module);

    await expect(
      service.addGuideSupportMaterial(guide.id, {
        originalname: 'archivo.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('no es PDF'),
        size: 9,
      }, COORDINADOR),
    ).rejects.toThrow('El archivo no tiene un formato PDF válido');
    await expect(
      service.addGuideSupportMaterial(guide.id, {
        originalname: 'archivo.exe',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('MZ'),
        size: 2,
      }, COORDINADOR),
    ).rejects.toThrow('Solo se permiten archivos PDF o DOCX');
  });
  it('el docente autorizado sube materiales a guías publicadas y solo borra los suyos', async () => {
    const module = await seedModule('Materiales compartidos');
    const guide = await createGuide(module, {
      intensidad: '40 horas · 10 semanas',
      evaluacion: 'Por proyecto',
      objetivos: 'Desarrollar materiales.',
      metodologia: 'Taller práctico guiado',
      criterios: 'Entrega del material.',
    });
    const pdf = Buffer.from('%PDF-1.7\ncontenido');
    const archivo = {
      originalname: 'taller.pdf',
      mimetype: 'application/pdf',
      buffer: pdf,
      size: pdf.length,
    };
    const autorizado = { id: 'auth-1', name: 'Paola', roles: ['docente_autorizado'] };

    await expect(
      service.addGuideSupportMaterial(guide.id, archivo, autorizado),
    ).rejects.toThrow('Guía publicada no encontrada');
    await service.publishGuide(guide.id);

    const delCoordinador = await service.addGuideSupportMaterial(guide.id, archivo, COORDINADOR);
    const propio = await service.addGuideSupportMaterial(guide.id, archivo, autorizado);
    expect(propio.uploadedBy).toEqual({ id: 'auth-1', name: 'Paola' });

    await expect(
      service.removeGuideSupportMaterial(guide.id, delCoordinador.id, 'auth-1', ['docente_autorizado']),
    ).rejects.toThrow(ForbiddenException);
    await service.removeGuideSupportMaterial(guide.id, propio.id, 'auth-1', ['docente_autorizado']);
    await service.removeGuideSupportMaterial(guide.id, delCoordinador.id, 'coord-1', ['coordinador']);

    expect(
      await service.findGuideSupportMaterialsForUser(guide.id, 'coord-1', ['coordinador']),
    ).toHaveLength(0);
  });

  it('el docente autorizado consulta las guías publicadas de todos los módulos', async () => {
    const module = await seedModule('Sin asignar');
    const guide = await createGuide(module, {
      intensidad: '40 horas · 10 semanas',
      evaluacion: 'Por proyecto',
      objetivos: 'Desarrollar materiales.',
      metodologia: 'Taller práctico guiado',
      criterios: 'Entrega del material.',
    });
    await service.publishGuide(guide.id);

    await expect(service.findGuideForUser(guide.id, 'teacher-9', ['docente'])).rejects.toThrow(
      ForbiddenException,
    );
    expect((await service.findGuideForUser(guide.id, 'auth-9', ['docente_autorizado'])).id).toBe(
      guide.id,
    );
    const asignaciones = await service.findAssignmentsForTeacher('auth-9', ['docente_autorizado']);
    expect(asignaciones.moduleIds).toContain(module.id);
    expect(asignaciones.hidden.total).toBe(0);
  });
});
