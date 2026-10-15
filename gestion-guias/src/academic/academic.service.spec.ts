import { BadRequestException, ConflictException } from '@nestjs/common';
import { AcademicService } from './academic.service.js';

describe('AcademicService HE-02 and HE-03', () => {
  let service: AcademicService;

  beforeEach(() => {
    service = new AcademicService();
  });

  it('creates, edits, and deactivates a module while preserving its competency history', () => {
    const module = service.createModule({ name: 'Matemáticas' });
    const competency = service.createCompetency({ name: 'Álgebra' });

    service.associateCompetency(module.id, competency.id);
    service.updateCompetency(competency.id, { description: 'Expresiones algebraicas' });
    const updated = service.updateModule(module.id, { name: 'Matemáticas I' });
    const deactivated = service.deactivateModule(module.id);

    expect(updated.competencies).toContainEqual(
      expect.objectContaining({ id: competency.id, description: 'Expresiones algebraicas' }),
    );
    expect(deactivated).toMatchObject({ name: 'Matemáticas I', isActive: false });
    expect(service.findCompetency(competency.id).name).toBe('Álgebra');
  });

  it('deletes a competency and removes its module association', () => {
    const module = service.createModule({ name: 'Ciencias' });
    const competency = service.createCompetency({ name: 'Biología' });
    service.associateCompetency(module.id, competency.id);

    expect(service.deleteCompetency(competency.id)).toEqual({ deleted: true });
    expect(service.findModule(module.id).competencies).toEqual([]);
    expect(service.findAllCompetencies()).toEqual([]);
  });

  it('creates a guide using competency-specific configurable fields, edits its draft, and publishes it', () => {
    const module = service.createModule({ name: 'Historia' });
    const competency = service.createCompetency({ name: 'Fuentes históricas' });
    service.associateCompetency(module.id, competency.id);
    service.configureModuleGuideFields(module.id, {
      fields: [
        { key: 'summary', label: 'Resumen', type: 'text', required: true },
      ],
    });
    service.configureCompetencyGuideFields(module.id, competency.id, {
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

    const draft = service.createGuide({
      moduleId: module.id,
      competencyId: competency.id,
      title: 'Análisis de fuentes',
      content: {},
    });

    expect(() =>
      service.updateGuide(draft.id, { content: { summary: 'No está configurado' } }),
    ).toThrow(BadRequestException);
    expect(() => service.publishGuide(draft.id)).toThrow(BadRequestException);

    service.updateGuide(draft.id, { content: { sourceType: 'secundaria', year: 2020 } });
    const published = service.publishGuide(draft.id);

    expect(published).toMatchObject({
      status: 'published',
      moduleName: 'Historia',
      competencyName: 'Fuentes históricas',
      content: { sourceType: 'secundaria', year: 2020 },
    });
    expect(published.publishedAt).toBeDefined();
    expect(() => service.updateGuide(draft.id, { title: 'Cambio' })).toThrow(ConflictException);
  });

  it('preserves published guide snapshots when a module is deactivated', () => {
    const module = service.createModule({ name: 'Literatura' });
    const draft = service.createGuide({
      moduleId: module.id,
      title: 'Lectura crítica',
      content: {},
    });
    service.publishGuide(draft.id);
    service.deactivateModule(module.id);

    expect(service.findGuide(draft.id)).toMatchObject({
      moduleName: 'Literatura',
      status: 'published',
    });
    expect(() =>
      service.createGuide({ moduleId: module.id, title: 'Nueva guía', content: {} }),
    ).toThrow(BadRequestException);
  });
});
