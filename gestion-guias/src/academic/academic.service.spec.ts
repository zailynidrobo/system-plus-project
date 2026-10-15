import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AcademicService } from './academic.service.js';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../academic-program/entities/curricular-module.entity.js';
import { Competency } from '../academic-program/entities/competency.entity.js';
import { GuideFieldConfigRecord } from './entities/guide-field-config-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from './entities/personalized-guide-version-record.entity.js';
import { GuideSupportMaterialRecord } from './entities/guide-support-material-record.entity.js';

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
      const value = record[key as keyof T];
      if (operator?._type === 'isNull') return value === null;
      if (operator?._type === 'in') {
        const values = (operator as { _value?: unknown[] })._value ?? [];
        return values.includes(value);
      }
      return value === condition;
    });

  const repository = {
    find: async () => [...live()],
    findBy: async (where: FindOptionsWhere<T>) =>
      live().filter((record) => matches(record, where)),
    findOne: async (options: { where: FindOptionsWhere<T> }) =>
      live().find((record) => matches(record, options.where)) ?? null,
    findOneBy: async (where: FindOptionsWhere<T>) =>
      live().find((record) => matches(record, where)) ?? null,
    countBy: async (where: FindOptionsWhere<T>) =>
      live().filter((record) => matches(record, where)).length,
    findByIds: async (ids: string[]) =>
      records.filter((record) => ids.includes(record.id)),
    save: async (record: T) => {
      const index = records.findIndex((item) => item.id === record.id);
      if (index < 0) records.push(record);
      else records[index] = record;
      return record;
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
  ];

  beforeEach(() => {
    repositories = [
      memoryRepository<CurricularModule>(),
      memoryRepository<Competency>(),
      memoryRepository<GuideFieldConfigRecord>(),
      memoryRepository<AcademicGuideRecord>(),
      memoryRepository<PersonalizedGuideVersionRecord>(),
      memoryRepository<ModuleTeacherAssignmentRecord>(),
      memoryRepository<GuideSupportMaterialRecord>(),
    ];
    service = new AcademicService(...repositories);
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
    const guide = (moduleId: string) =>
      service.createGuide({ moduleId, title: 'Guía', content: {} });
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
        title: 'Guía',
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

  it('creates, edits, and publishes a guide with competency-specific fields', async () => {
    const module = await seedModule('Historia');
    const competency = await seedCompetency(
      module,
      'Fuentes históricas',
      'COMP-HIS-01',
    );
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
      title: 'Análisis de fuentes',
      content: {},
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
      status: 'published',
      moduleName: 'Historia',
      competencyName: 'COMP-HIS-01 · Fuentes históricas',
      content: { sourceType: 'secundaria', year: 2020 },
    });
    expect(published.publishedAt).toBeDefined();
    await expect(
      service.updateGuide(draft.id, { title: 'Cambio' }),
    ).rejects.toThrow(ConflictException);
  });

  it('preserves published guide snapshots when a module is deactivated', async () => {
    const module = await seedModule('Literatura');
    const draft = await service.createGuide({
      moduleId: module.id,
      title: 'Lectura crítica',
      content: {},
    });
    await service.publishGuide(draft.id);
    module.status = CurricularModuleStatus.INACTIVE;

    expect(await service.findGuide(draft.id)).toMatchObject({
      moduleName: 'Literatura',
      status: 'published',
    });
    await expect(
      service.createGuide({
        moduleId: module.id,
        title: 'Nueva guía',
        content: {},
      }),
    ).rejects.toThrow(BadRequestException);
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
    const draft = await service.createGuide({
      moduleId: module.id,
      title: 'Guía institucional',
      content: { activity: 'Experimento base' },
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
    const draft = await service.createGuide({
      moduleId: module.id,
      title: 'Guía persistente',
      content: { summary: 'Contenido institucional' },
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

    const restartedService = new AcademicService(...repositories);

    expect(await restartedService.findGuide(draft.id)).toMatchObject({
      title: 'Guía persistente',
      status: 'published',
    });
    expect(
      await restartedService.findGuidesForUser(undefined, 'teacher-1', [
        'docente',
      ]),
    ).toHaveLength(1);
    expect(
      await restartedService.findPersonalizedVersionsForTeacher('teacher-1'),
    ).toMatchObject([
      {
        id: version.id,
        content: { notes: 'Contenido del docente' },
      },
    ]);
  });

  it('stores PDF and DOCX support materials and limits teacher downloads to assigned published guides', async () => {
    const module = await seedModule('Materiales');
    const guide = await service.createGuide({
      moduleId: module.id,
      title: 'Guía con apoyo',
      content: {},
    });
    const pdf = Buffer.from('%PDF-1.7\ncontenido de prueba');
    const uploadedPdf = await service.addGuideSupportMaterial(guide.id, {
      originalname: 'lectura.pdf',
      mimetype: 'application/pdf',
      buffer: pdf,
      size: pdf.length,
    });

    const archive = new JSZip();
    archive.file('word/document.xml', '<document />');
    const docx = await archive.generateAsync({ type: 'nodebuffer' });
    const uploadedDocx = await service.addGuideSupportMaterial(guide.id, {
      originalname: 'actividad.docx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docx,
      size: docx.length,
    });

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
    const guide = await service.createGuide({
      moduleId: module.id,
      title: 'Guía',
      content: {},
    });

    await expect(
      service.addGuideSupportMaterial(guide.id, {
        originalname: 'archivo.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('no es PDF'),
        size: 9,
      }),
    ).rejects.toThrow('El archivo no tiene un formato PDF válido');
    await expect(
      service.addGuideSupportMaterial(guide.id, {
        originalname: 'archivo.exe',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('MZ'),
        size: 2,
      }),
    ).rejects.toThrow('Solo se permiten archivos PDF o DOCX');
  });
});
