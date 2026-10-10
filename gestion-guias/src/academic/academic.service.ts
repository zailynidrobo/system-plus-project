import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AcademicGuide,
  AcademicModule,
  Competency,
  GuideContent,
  GuideField,
  GuideFieldConfig,
  GuideFormType,
  PersonalizedGuideVersion,
} from './academic.entities.js';
import { GuideDocumentData } from './guide-document-export.service.js';
import { CreateAcademicModuleDto } from './dto/create-academic-module.dto.js';
import { UpdateAcademicModuleDto } from './dto/update-academic-module.dto.js';
import { CreateCompetencyDto } from './dto/create-competency.dto.js';
import { UpdateCompetencyDto } from './dto/update-competency.dto.js';
import { ConfigureGuideFieldsDto } from './dto/configure-guide-fields.dto.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { UpdateGuideDto } from './dto/update-guide.dto.js';
import { UpdatePersonalizedGuideVersionDto } from './dto/update-personalized-guide-version.dto.js';

@Injectable()
export class AcademicService {
  private readonly modules: AcademicModule[] = [];
  private readonly competencies: Competency[] = [];
  private readonly fieldConfigs: GuideFieldConfig[] = [];
  private readonly guides: AcademicGuide[] = [];
  private readonly personalizedVersions: PersonalizedGuideVersion[] = [];
  private readonly moduleTeacherAssignments = new Map<string, Set<string>>();

  createModule(dto: CreateAcademicModuleDto) {
    if (
      this.modules.some(
        (module) => module.name.toLowerCase() === dto.name.toLowerCase(),
      )
    ) {
      throw new ConflictException('Ya existe un módulo con ese nombre');
    }
    const module: AcademicModule = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      isActive: true,
      competencyIds: [],
    };
    this.modules.push(module);
    return this.withCompetencies(module);
  }

  findAllModules() {
    return this.modules.map((module) => this.withCompetencies(module));
  }

  findModule(id: string) {
    return this.withCompetencies(this.getModuleOrFail(id));
  }

  updateModule(id: string, dto: UpdateAcademicModuleDto) {
    const module = this.getModuleOrFail(id);
    if (
      dto.name !== undefined &&
      this.modules.some(
        (other) =>
          other.id !== id &&
          other.name.toLowerCase() === dto.name!.toLowerCase(),
      )
    ) {
      throw new ConflictException('Ya existe un módulo con ese nombre');
    }
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }
    if (dto.name !== undefined) module.name = dto.name;
    if (dto.description !== undefined) module.description = dto.description;
    return this.withCompetencies(module);
  }

  deactivateModule(id: string) {
    const module = this.getModuleOrFail(id);
    module.isActive = false;
    return this.withCompetencies(module);
  }

  createCompetency(dto: CreateCompetencyDto) {
    const competency: Competency = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
    };
    this.competencies.push(competency);
    return competency;
  }

  findAllCompetencies() {
    return [...this.competencies];
  }

  findCompetency(id: string) {
    return this.getCompetencyOrFail(id);
  }

  updateCompetency(id: string, dto: UpdateCompetencyDto) {
    const competency = this.getCompetencyOrFail(id);
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }
    if (dto.name !== undefined) competency.name = dto.name;
    if (dto.description !== undefined) competency.description = dto.description;
    return competency;
  }

  deleteCompetency(id: string) {
    this.getCompetencyOrFail(id);
    const index = this.competencies.findIndex(
      (competency) => competency.id === id,
    );
    this.competencies.splice(index, 1);
    for (const module of this.modules) {
      module.competencyIds = module.competencyIds.filter(
        (competencyId) => competencyId !== id,
      );
    }
    for (let index = this.fieldConfigs.length - 1; index >= 0; index--) {
      if (this.fieldConfigs[index].competencyId === id)
        this.fieldConfigs.splice(index, 1);
    }
    return { deleted: true };
  }

  associateCompetency(moduleId: string, competencyId: string) {
    const module = this.getModuleOrFail(moduleId);
    this.getCompetencyOrFail(competencyId);
    if (module.competencyIds.includes(competencyId)) {
      throw new ConflictException(
        'La competencia ya está asociada a este módulo',
      );
    }
    module.competencyIds.push(competencyId);
    return this.withCompetencies(module);
  }

  disassociateCompetency(moduleId: string, competencyId: string) {
    const module = this.getModuleOrFail(moduleId);
    if (!module.competencyIds.includes(competencyId)) {
      throw new NotFoundException(
        'La competencia no está asociada a este módulo',
      );
    }
    module.competencyIds = module.competencyIds.filter(
      (id) => id !== competencyId,
    );
    return this.withCompetencies(module);
  }

  configureModuleGuideFields(moduleId: string, dto: ConfigureGuideFieldsDto) {
    this.getModuleOrFail(moduleId);
    this.validateFieldDefinitions(dto.fields);
    return this.saveFieldConfig({
      moduleId,
      formType: 'base',
      fields: dto.fields,
    });
  }

  configureTeacherGuideFields(moduleId: string, dto: ConfigureGuideFieldsDto) {
    this.getModuleOrFail(moduleId);
    this.validateFieldDefinitions(dto.fields);
    return this.saveFieldConfig({
      moduleId,
      formType: 'teacher',
      fields: dto.fields,
    });
  }

  configureCompetencyGuideFields(
    moduleId: string,
    competencyId: string,
    dto: ConfigureGuideFieldsDto,
  ) {
    const module = this.getModuleOrFail(moduleId);
    this.getCompetencyOrFail(competencyId);
    if (!module.competencyIds.includes(competencyId)) {
      throw new BadRequestException(
        'La competencia no está asociada a este módulo',
      );
    }
    this.validateFieldDefinitions(dto.fields);
    return this.saveFieldConfig({
      moduleId,
      competencyId,
      formType: 'base',
      fields: dto.fields,
    });
  }

  createGuide(dto: CreateGuideDto) {
    const module = this.getActiveModuleOrFail(dto.moduleId);
    let competency: Competency | undefined;
    if (dto.competencyId !== undefined) {
      competency = this.getCompetencyOrFail(dto.competencyId);
      if (!module.competencyIds.includes(competency.id)) {
        throw new BadRequestException(
          'La competencia no está asociada a este módulo',
        );
      }
    }

    const fields = this.resolveGuideFields(module.id, competency?.id, 'base');
    this.validateGuideContent(dto.content, fields, false);
    const now = new Date().toISOString();
    const guide: AcademicGuide = {
      id: randomUUID(),
      moduleId: module.id,
      moduleName: module.name,
      competencyId: competency?.id,
      competencyName: competency?.name,
      title: dto.title,
      content: { ...dto.content },
      fields,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    this.guides.push(guide);
    return guide;
  }

  findAllGuides(moduleId?: string) {
    if (moduleId !== undefined) this.getModuleOrFail(moduleId);
    return this.guides.filter(
      (guide) => moduleId === undefined || guide.moduleId === moduleId,
    );
  }

  findGuide(id: string) {
    return this.getGuideOrFail(id);
  }

  updateGuide(id: string, dto: UpdateGuideDto) {
    const guide = this.getGuideOrFail(id);
    if (guide.status !== 'draft') {
      throw new ConflictException('Una guía publicada no se puede editar');
    }
    if (dto.title === undefined && dto.content === undefined) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }
    const content = dto.content ?? guide.content;
    this.validateGuideContent(content, guide.fields, false);
    if (dto.title !== undefined) guide.title = dto.title;
    if (dto.content !== undefined) guide.content = { ...dto.content };
    guide.updatedAt = new Date().toISOString();
    return guide;
  }

  publishGuide(id: string) {
    const guide = this.getGuideOrFail(id);
    if (guide.status === 'published') {
      throw new ConflictException('La guía ya está publicada');
    }
    this.validateGuideContent(guide.content, guide.fields, true);
    guide.status = 'published';
    guide.publishedAt = new Date().toISOString();
    guide.updatedAt = guide.publishedAt;
    return guide;
  }

  assignTeacherToModule(moduleId: string, teacherId: string) {
    this.getModuleOrFail(moduleId);
    const moduleIds =
      this.moduleTeacherAssignments.get(teacherId) ?? new Set<string>();
    moduleIds.add(moduleId);
    this.moduleTeacherAssignments.set(teacherId, moduleIds);
    return { moduleId, teacherId, assigned: true };
  }

  unassignTeacherFromModule(moduleId: string, teacherId: string) {
    this.getModuleOrFail(moduleId);
    const moduleIds = this.moduleTeacherAssignments.get(teacherId);
    if (!moduleIds?.delete(moduleId)) {
      throw new NotFoundException('La asignación docente no existe');
    }
    return { moduleId, teacherId, assigned: false };
  }

  findGuidesForUser(
    moduleId: string | undefined,
    userId: string,
    roles: string[],
  ) {
    if (moduleId !== undefined) this.getModuleOrFail(moduleId);

    if (roles.includes('coordinador')) {
      return this.findAllGuides(moduleId);
    }

    if (!roles.includes('docente')) {
      throw new ForbiddenException('No tienes permiso para consultar guías');
    }

    const assignedModuleIds =
      this.moduleTeacherAssignments.get(userId) ?? new Set<string>();
    if (moduleId !== undefined && !assignedModuleIds.has(moduleId)) {
      throw new ForbiddenException('No tienes asignado este módulo');
    }
    return this.guides.filter(
      (guide) =>
        guide.status === 'published' &&
        assignedModuleIds.has(guide.moduleId) &&
        (moduleId === undefined || guide.moduleId === moduleId),
    );
  }

  findGuideForUser(id: string, userId: string, roles: string[]) {
    const guide = this.getGuideOrFail(id);
    if (roles.includes('coordinador')) return guide;
    if (!roles.includes('docente')) {
      throw new ForbiddenException(
        'No tienes permiso para consultar esta guía',
      );
    }
    this.assertTeacherCanAccessModule(guide.moduleId, userId);
    if (guide.status !== 'published') {
      throw new NotFoundException('Guía publicada no encontrada');
    }
    return guide;
  }

  getGuideDocumentData(id: string): GuideDocumentData {
    const guide = this.getGuideOrFail(id);
    return {
      title: 'GUÍA BASE DEL MÓDULO',
      subtitle: `Plantilla A · ${guide.title}`,
      metadata: [
        { label: 'Módulo', value: guide.moduleName },
        {
          label: 'Competencia',
          value: guide.competencyName ?? 'No especificada',
        },
        { label: 'Estado', value: guide.status },
        {
          label: 'Fecha de publicación',
          value: guide.publishedAt ?? 'No publicada',
        },
      ],
      fields: guide.fields,
      content: guide.content,
    };
  }

  getPersonalizedVersionDocumentData(
    id: string,
    teacherId: string,
  ): GuideDocumentData {
    const version = this.findPersonalizedVersionForTeacher(id, teacherId);
    return {
      title: 'GUÍA DOCENTE',
      subtitle: `Plantilla B · ${version.title}`,
      metadata: [
        { label: 'Módulo', value: version.moduleName },
        { label: 'Docente autor', value: teacherId },
        { label: 'Última actualización', value: version.updatedAt },
      ],
      reference: {
        title: version.title,
        fields: version.baseFields,
        content: version.baseContent,
      },
      fields: version.fields,
      content: version.content,
    };
  }

  createPersonalizedVersion(baseGuideId: string, teacherId: string) {
    const guide = this.getGuideOrFail(baseGuideId);
    if (guide.status !== 'published') {
      throw new ConflictException(
        'Solo se puede personalizar una guía publicada',
      );
    }
    this.assertTeacherCanAccessModule(guide.moduleId, teacherId);
    const now = new Date().toISOString();
    const version: PersonalizedGuideVersion = {
      id: randomUUID(),
      baseGuideId: guide.id,
      moduleId: guide.moduleId,
      moduleName: guide.moduleName,
      teacherId,
      title: guide.title,
      baseContent: { ...guide.content },
      baseFields: guide.fields.map((field) => ({
        ...field,
        options: field.options ? [...field.options] : undefined,
      })),
      content: {},
      fields: this.resolveGuideFields(guide.moduleId, undefined, 'teacher'),
      createdAt: now,
      updatedAt: now,
    };
    this.personalizedVersions.push(version);
    return version;
  }

  findPersonalizedVersionsForTeacher(teacherId: string) {
    return this.personalizedVersions.filter(
      (version) => version.teacherId === teacherId,
    );
  }

  findPersonalizedVersionForTeacher(id: string, teacherId: string) {
    const version = this.getPersonalizedVersionOrFail(id);
    if (version.teacherId !== teacherId) {
      throw new ForbiddenException(
        'Solo puedes consultar tus propias versiones',
      );
    }
    return version;
  }

  updatePersonalizedVersion(
    id: string,
    teacherId: string,
    dto: UpdatePersonalizedGuideVersionDto,
  ) {
    const version = this.findPersonalizedVersionForTeacher(id, teacherId);
    if (dto.content === undefined || Object.keys(dto.content).length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para actualizar',
      );
    }
    const content = { ...version.content, ...dto.content };
    this.validateGuideContent(content, version.fields, false);
    version.content = content;
    version.updatedAt = new Date().toISOString();
    return version;
  }

  private getModuleOrFail(id: string) {
    const module = this.modules.find((item) => item.id === id);
    if (!module) throw new NotFoundException('Módulo no encontrado');
    return module;
  }

  private getActiveModuleOrFail(id: string) {
    const module = this.getModuleOrFail(id);
    if (!module.isActive)
      throw new BadRequestException(
        'No se pueden crear guías para un módulo inactivo',
      );
    return module;
  }

  private getCompetencyOrFail(id: string) {
    const competency = this.competencies.find((item) => item.id === id);
    if (!competency) throw new NotFoundException('Competencia no encontrada');
    return competency;
  }

  private getGuideOrFail(id: string) {
    const guide = this.guides.find((item) => item.id === id);
    if (!guide) throw new NotFoundException('Guía no encontrada');
    return guide;
  }

  private getPersonalizedVersionOrFail(id: string) {
    const version = this.personalizedVersions.find((item) => item.id === id);
    if (!version)
      throw new NotFoundException('Versión personalizada no encontrada');
    return version;
  }

  private assertTeacherCanAccessModule(moduleId: string, teacherId: string) {
    if (!this.moduleTeacherAssignments.get(teacherId)?.has(moduleId)) {
      throw new ForbiddenException('No tienes asignado este módulo');
    }
  }

  private withCompetencies(module: AcademicModule) {
    return {
      ...module,
      competencies: module.competencyIds
        .map((id) =>
          this.competencies.find((competency) => competency.id === id),
        )
        .filter(
          (competency): competency is Competency => competency !== undefined,
        ),
    };
  }

  private saveFieldConfig(config: GuideFieldConfig) {
    const index = this.fieldConfigs.findIndex(
      (current) =>
        current.moduleId === config.moduleId &&
        current.competencyId === config.competencyId &&
        current.formType === config.formType,
    );
    const stored = {
      ...config,
      fields: config.fields.map((field) => ({ ...field })),
    };
    if (index === -1) this.fieldConfigs.push(stored);
    else this.fieldConfigs[index] = stored;
    return stored;
  }

  private resolveGuideFields(
    moduleId: string,
    competencyId?: string,
    formType: GuideFormType = 'base',
  ) {
    if (formType === 'base' && competencyId !== undefined) {
      const competencyConfig = this.fieldConfigs.find(
        (config) =>
          config.moduleId === moduleId &&
          config.competencyId === competencyId &&
          config.formType === 'base',
      );
      if (competencyConfig)
        return competencyConfig.fields.map((field) => ({ ...field }));
    }
    const moduleConfig = this.fieldConfigs.find(
      (config) =>
        config.moduleId === moduleId &&
        config.competencyId === undefined &&
        config.formType === formType,
    );
    return moduleConfig?.fields.map((field) => ({ ...field })) ?? [];
  }

  private validateFieldDefinitions(fields: GuideField[]) {
    const keys = new Set<string>();
    for (const field of fields) {
      if (keys.has(field.key)) {
        throw new BadRequestException(`El campo '${field.key}' está duplicado`);
      }
      keys.add(field.key);
      if (
        field.type === 'select' &&
        (!field.options || field.options.length === 0)
      ) {
        throw new BadRequestException(
          `El campo '${field.key}' requiere opciones`,
        );
      }
      if (field.type !== 'select' && field.options !== undefined) {
        throw new BadRequestException(
          `El campo '${field.key}' no admite opciones`,
        );
      }
    }
  }

  private validateGuideContent(
    content: GuideContent,
    fields: GuideField[],
    requireRequired: boolean,
  ) {
    const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
    for (const key of Object.keys(content)) {
      if (!fieldsByKey.has(key)) {
        throw new BadRequestException(
          `El campo '${key}' no está configurado para esta guía`,
        );
      }
    }

    for (const field of fields) {
      const value = content[field.key];
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0);
      if (empty) {
        if (requireRequired && field.required) {
          throw new BadRequestException(
            `El campo '${field.label}' es obligatorio para publicar`,
          );
        }
        if (value !== undefined && value !== null) {
          throw new BadRequestException(
            `El campo '${field.label}' no puede estar vacío`,
          );
        }
        continue;
      }

      if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new BadRequestException(
            `El campo '${field.label}' debe ser numérico`,
          );
        }
      } else if (typeof value !== 'string') {
        throw new BadRequestException(
          `El campo '${field.label}' debe ser texto`,
        );
      } else if (field.type === 'date' && Number.isNaN(Date.parse(value))) {
        throw new BadRequestException(
          `El campo '${field.label}' debe contener una fecha válida`,
        );
      } else if (field.type === 'select' && !field.options?.includes(value)) {
        throw new BadRequestException(
          `El valor del campo '${field.label}' no está entre las opciones`,
        );
      }
    }
  }
}
