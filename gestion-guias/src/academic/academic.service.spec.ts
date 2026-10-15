import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import JSZip from 'jszip';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AcademicService } from './academic.service.js';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import { AcademicModuleRecord } from './entities/academic-module-record.entity.js';
import { AcademicCompetencyRecord } from './entities/academic-competency-record.entity.js';
import { GuideFieldConfigRecord } from './entities/guide-field-config-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from './entities/personalized-guide-version-record.entity.js';
import { GuideSupportMaterialRecord } from './entities/guide-support-material-record.entity.js';

function memoryRepository<T extends { id: string }>() {
  const records: T[] = [];
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
    find: async () => [...records],
    findBy: async (where: FindOptionsWhere<T>) =>
      records.filter((record) => matches(record, where)),
    findOne: async (options: { where: FindOptionsWhere<T> }) =>
      records.find((record) => matches(record, options.where)) ?? null,
    findOneBy: async (where: FindOptionsWhere<T>) =>
      records.find((record) => matches(record, where)) ?? null,
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

describe('AcademicService HE-02 and HE-03', () => {
  let service: AcademicService;
  let repositories: [
    Repository<AcademicModuleRecord>,
    Repository<AcademicCompetencyRecord>,
    Repository<GuideFieldConfigRecord>,
    Repository<AcademicGuideRecord>,
    Repository<PersonalizedGuideVersionRecord>,
    Repository<ModuleTeacherAssignmentRecord>,
    Repository<GuideSupportMaterialRecord>,
  ];

  beforeEach(() => {
    repositories = [
      memoryRepository<AcademicModuleRecord>(),
      memoryRepository<AcademicCompetencyRecord>(),
      memoryRepository<GuideFieldConfigRecord>(),
      memoryRepository<AcademicGuideRecord>(),
      memoryRepository<PersonalizedGuideVersionRecord>(),
      memoryRepository<ModuleTeacherAssignmentRecord>(),
      memoryRepository<GuideSupportMaterialRecord>(),
    ];
    service = new AcademicService(...repositories);
  });

  it('creates, edits, and deactivates a module while preserving its competency history', async () => {
    const module = await service.createModule({ name: 'Matemáticas' });
    const competency = await service.createCompetency({ name: 'Álgebra' });

    await service.associateCompetency(module.id, competency.id);
    await service.updateCompetency(competency.id, {
      description: 'Expresiones algebraicas',
    });
    const updated = await service.updateModule(module.id, {
      name: 'Matemáticas I',
    });
    const deactivated = await service.deactivateModule(module.id);

    expect(updated.competencies).toContainEqual(
      expect.objectContaining({
        id: competency.id,
        description: 'Expresiones algebraicas',
      }),
    );
    expect(deactivated).toMatchObject({
      name: 'Matemáticas I',
      isActive: false,
    });
    expect((await service.findCompetency(competency.id)).name).toBe('Álgebra');
  });

  it('deletes a competency and removes its module association', async () => {
    const module = await service.createModule({ name: 'Ciencias' });
    const competency = await service.createCompetency({ name: 'Biología' });
    await service.associateCompetency(module.id, competency.id);

    expect(await service.deleteCompetency(competency.id)).toEqual({
      deleted: true,
    });
    expect((await service.findModule(module.id)).competencies).toEqual([]);
    expect(await service.findAllCompetencies()).toEqual([]);
  });

  it('creates, edits, and publishes a guide with competency-specific fields', async () => {
    const module = await service.createModule({ name: 'Historia' });
    const competency = await service.createCompetency({
      name: 'Fuentes históricas',
    });
    await service.associateCompetency(module.id, competency.id);
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
      competencyName: 'Fuentes históricas',
      content: { sourceType: 'secundaria', year: 2020 },
    });
    expect(published.publishedAt).toBeDefined();
    await expect(
      service.updateGuide(draft.id, { title: 'Cambio' }),
    ).rejects.toThrow(ConflictException);
  });

  it('preserves published guide snapshots when a module is deactivated', async () => {
    const module = await service.createModule({ name: 'Literatura' });
    const draft = await service.createGuide({
      moduleId: module.id,
      title: 'Lectura crítica',
      content: {},
    });
    await service.publishGuide(draft.id);
    await service.deactivateModule(module.id);

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
    const module = await service.createModule({ name: 'Ciencias' });
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
    const module = await service.createModule({ name: 'Persistencia' });
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
    const module = await service.createModule({ name: 'Materiales' });
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
    const module = await service.createModule({
      name: 'Validación de archivos',
    });
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
