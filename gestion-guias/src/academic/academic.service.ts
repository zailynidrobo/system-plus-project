import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
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
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import { AcademicModuleRecord } from './entities/academic-module-record.entity.js';
import { AcademicCompetencyRecord } from './entities/academic-competency-record.entity.js';
import { GuideFieldConfigRecord } from './entities/guide-field-config-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from './entities/personalized-guide-version-record.entity.js';
import { GuideSupportMaterialRecord } from './entities/guide-support-material-record.entity.js';
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
  private static readonly maxSupportMaterialSize = 10 * 1024 * 1024;

  constructor(
    @InjectRepository(AcademicModuleRecord)
    private readonly modules: Repository<AcademicModuleRecord>,
    @InjectRepository(AcademicCompetencyRecord)
    private readonly competencies: Repository<AcademicCompetencyRecord>,
    @InjectRepository(GuideFieldConfigRecord)
    private readonly fieldConfigs: Repository<GuideFieldConfigRecord>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    @InjectRepository(PersonalizedGuideVersionRecord)
    private readonly personalizedVersions: Repository<PersonalizedGuideVersionRecord>,
    @InjectRepository(ModuleTeacherAssignmentRecord)
    private readonly moduleTeacherAssignments: Repository<ModuleTeacherAssignmentRecord>,
    @InjectRepository(GuideSupportMaterialRecord)
    private readonly guideSupportMaterials: Repository<GuideSupportMaterialRecord>,
  ) {}

  async createModule(dto: CreateAcademicModuleDto) {
    const normalizedName = dto.name.trim().toLowerCase();
    if (await this.modules.findOneBy({ normalizedName })) {
      throw new ConflictException('Ya existe un módulo con ese nombre');
    }
    const module = await this.modules.save({
      id: randomUUID(),
      name: dto.name,
      normalizedName,
      description: dto.description ?? null,
      isActive: true,
      competencyIds: [],
    });
    return this.withCompetencies(module);
  }

  async findAllModules() {
    const modules = await this.modules.find();
    return Promise.all(modules.map((module) => this.withCompetencies(module)));
  }

  async findModule(id: string) {
    return this.withCompetencies(await this.getModuleOrFail(id));
  }

  async updateModule(id: string, dto: UpdateAcademicModuleDto) {
    const module = await this.getModuleOrFail(id);
    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim().toLowerCase();
      const duplicate = await this.modules.findOneBy({ normalizedName });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Ya existe un módulo con ese nombre');
      }
      module.name = dto.name;
      module.normalizedName = normalizedName;
    }
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }
    if (dto.description !== undefined) module.description = dto.description;
    return this.withCompetencies(await this.modules.save(module));
  }

  async deactivateModule(id: string) {
    const module = await this.getModuleOrFail(id);
    module.isActive = false;
    return this.withCompetencies(await this.modules.save(module));
  }

  async createCompetency(dto: CreateCompetencyDto) {
    const competency = await this.competencies.save({
      id: randomUUID(),
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.toCompetency(competency);
  }

  async findAllCompetencies() {
    const records = await this.competencies.find();
    return records.map((competency) => this.toCompetency(competency));
  }

  async findCompetency(id: string) {
    return this.toCompetency(await this.getCompetencyRecordOrFail(id));
  }

  async updateCompetency(id: string, dto: UpdateCompetencyDto) {
    const competency = await this.getCompetencyRecordOrFail(id);
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'Debe proporcionar al menos un dato para actualizar',
      );
    }
    if (dto.name !== undefined) competency.name = dto.name;
    if (dto.description !== undefined) competency.description = dto.description;
    return this.toCompetency(await this.competencies.save(competency));
  }

  async deleteCompetency(id: string) {
    await this.getCompetencyRecordOrFail(id);
    const modules = await this.modules.find();
    for (const module of modules) {
      if (module.competencyIds.includes(id)) {
        module.competencyIds = module.competencyIds.filter(
          (competencyId) => competencyId !== id,
        );
        await this.modules.save(module);
      }
    }
    await this.fieldConfigs.delete({ competencyId: id });
    await this.competencies.delete(id);
    return { deleted: true };
  }

  async associateCompetency(moduleId: string, competencyId: string) {
    const module = await this.getModuleOrFail(moduleId);
    await this.getCompetencyRecordOrFail(competencyId);
    if (module.competencyIds.includes(competencyId)) {
      throw new ConflictException(
        'La competencia ya está asociada a este módulo',
      );
    }
    module.competencyIds.push(competencyId);
    return this.withCompetencies(await this.modules.save(module));
  }

  async disassociateCompetency(moduleId: string, competencyId: string) {
    const module = await this.getModuleOrFail(moduleId);
    if (!module.competencyIds.includes(competencyId)) {
      throw new NotFoundException(
        'La competencia no está asociada a este módulo',
      );
    }
    module.competencyIds = module.competencyIds.filter(
      (id) => id !== competencyId,
    );
    return this.withCompetencies(await this.modules.save(module));
  }

  async configureModuleGuideFields(
    moduleId: string,
    dto: ConfigureGuideFieldsDto,
  ) {
    await this.getModuleOrFail(moduleId);
    this.validateFieldDefinitions(dto.fields);
    return this.saveFieldConfig({
      moduleId,
      formType: 'base',
      fields: dto.fields,
    });
  }

  async configureTeacherGuideFields(
    moduleId: string,
    dto: ConfigureGuideFieldsDto,
  ) {
    await this.getModuleOrFail(moduleId);
    this.validateFieldDefinitions(dto.fields);
    return this.saveFieldConfig({
      moduleId,
      formType: 'teacher',
      fields: dto.fields,
    });
  }

  async configureCompetencyGuideFields(
    moduleId: string,
    competencyId: string,
    dto: ConfigureGuideFieldsDto,
  ) {
    const module = await this.getModuleOrFail(moduleId);
    await this.getCompetencyRecordOrFail(competencyId);
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

  async createGuide(dto: CreateGuideDto) {
    const module = await this.getActiveModuleOrFail(dto.moduleId);
    let competency: Competency | undefined;
    if (dto.competencyId !== undefined) {
      competency = await this.findCompetency(dto.competencyId);
      if (!module.competencyIds.includes(competency.id)) {
        throw new BadRequestException(
          'La competencia no está asociada a este módulo',
        );
      }
    }

    const fields = await this.resolveGuideFields(
      module.id,
      competency?.id,
      'base',
    );
    this.validateGuideContent(dto.content, fields, false);
    const now = new Date();
    const guide = await this.guides.save({
      id: randomUUID(),
      moduleId: module.id,
      moduleName: module.name,
      competencyId: competency?.id ?? null,
      competencyName: competency?.name ?? null,
      title: dto.title,
      content: { ...dto.content },
      fields,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    });
    return this.toGuide(guide);
  }

  async findAllGuides(moduleId?: string) {
    if (moduleId !== undefined) await this.getModuleOrFail(moduleId);
    const records =
      moduleId === undefined
        ? await this.guides.find()
        : await this.guides.findBy({ moduleId });
    return records.map((guide) => this.toGuide(guide));
  }

  async findGuide(id: string) {
    return this.toGuide(await this.getGuideOrFail(id));
  }

  async updateGuide(id: string, dto: UpdateGuideDto) {
    const guide = await this.getGuideOrFail(id);
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
    guide.updatedAt = new Date();
    return this.toGuide(await this.guides.save(guide));
  }

  async publishGuide(id: string) {
    const guide = await this.getGuideOrFail(id);
    if (guide.status === 'published') {
      throw new ConflictException('La guía ya está publicada');
    }
    this.validateGuideContent(guide.content, guide.fields, true);
    guide.status = 'published';
    guide.publishedAt = new Date();
    guide.updatedAt = guide.publishedAt;
    return this.toGuide(await this.guides.save(guide));
  }

  async assignTeacherToModule(moduleId: string, teacherId: string) {
    await this.getModuleOrFail(moduleId);
    const existing = await this.moduleTeacherAssignments.findOneBy({
      moduleId,
      teacherId,
    });
    if (!existing) {
      await this.moduleTeacherAssignments.save({
        id: randomUUID(),
        moduleId,
        teacherId,
      });
    }
    return { moduleId, teacherId, assigned: true };
  }

  async unassignTeacherFromModule(moduleId: string, teacherId: string) {
    await this.getModuleOrFail(moduleId);
    const existing = await this.moduleTeacherAssignments.findOneBy({
      moduleId,
      teacherId,
    });
    if (!existing) {
      throw new NotFoundException('La asignación docente no existe');
    }
    await this.moduleTeacherAssignments.remove(existing);
    return { moduleId, teacherId, assigned: false };
  }

  async findGuidesForUser(
    moduleId: string | undefined,
    userId: string,
    roles: string[],
  ) {
    if (moduleId !== undefined) await this.getModuleOrFail(moduleId);
    if (roles.includes('coordinador')) return this.findAllGuides(moduleId);
    if (!roles.includes('docente')) {
      throw new ForbiddenException('No tienes permiso para consultar guías');
    }
    const assignments = await this.moduleTeacherAssignments.findBy({
      teacherId: userId,
    });
    const assignedModuleIds = new Set(
      assignments.map((assignment) => assignment.moduleId),
    );
    if (moduleId !== undefined && !assignedModuleIds.has(moduleId)) {
      throw new ForbiddenException('No tienes asignado este módulo');
    }
    const guides =
      moduleId === undefined
        ? await this.guides.find()
        : await this.guides.findBy({ moduleId });
    return guides
      .filter(
        (guide) =>
          guide.status === 'published' && assignedModuleIds.has(guide.moduleId),
      )
      .map((guide) => this.toGuide(guide));
  }

  async findGuideForUser(id: string, userId: string, roles: string[]) {
    const guide = await this.getGuideOrFail(id);
    if (roles.includes('coordinador')) return this.toGuide(guide);
    if (!roles.includes('docente')) {
      throw new ForbiddenException(
        'No tienes permiso para consultar esta guía',
      );
    }
    await this.assertTeacherCanAccessModule(guide.moduleId, userId);
    if (guide.status !== 'published') {
      throw new NotFoundException('Guía publicada no encontrada');
    }
    return this.toGuide(guide);
  }

  async addGuideSupportMaterial(
    guideId: string,
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
  ) {
    await this.getGuideOrFail(guideId);
    const material = await this.validateSupportMaterial(file);
    const record = await this.guideSupportMaterials.save({
      id: randomUUID(),
      guideId,
      fileName: material.fileName,
      contentType: material.contentType,
      size: file.size,
      data: file.buffer,
      createdAt: new Date(),
    });
    return this.toGuideSupportMaterial(record);
  }

  async findGuideSupportMaterialsForUser(
    guideId: string,
    userId: string,
    roles: string[],
  ) {
    await this.findGuideForUser(guideId, userId, roles);
    const records = await this.guideSupportMaterials.find({
      where: { guideId },
      order: { createdAt: 'ASC' },
      select: {
        id: true,
        guideId: true,
        fileName: true,
        contentType: true,
        size: true,
        createdAt: true,
      },
    });
    return records.map((record) => this.toGuideSupportMaterial(record));
  }

  async getGuideSupportMaterialForUser(
    guideId: string,
    materialId: string,
    userId: string,
    roles: string[],
  ) {
    await this.findGuideForUser(guideId, userId, roles);
    const record = await this.guideSupportMaterials.findOne({
      where: { id: materialId, guideId },
      select: {
        id: true,
        guideId: true,
        fileName: true,
        contentType: true,
        size: true,
        createdAt: true,
        data: true,
      },
    });
    if (!record) throw new NotFoundException('Material de apoyo no encontrado');
    return record;
  }

  async getGuideDocumentData(id: string): Promise<GuideDocumentData> {
    const guide = await this.getGuideOrFail(id);
    return {
      template: 'base',
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
          value: guide.publishedAt?.toISOString() ?? 'No publicada',
        },
      ],
      fields: guide.fields,
      content: guide.content,
    };
  }

  async getPersonalizedVersionDocumentData(
    id: string,
    teacherId: string,
  ): Promise<GuideDocumentData> {
    const version = await this.findPersonalizedVersionForTeacher(id, teacherId);
    return {
      template: 'teacher',
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

  async createPersonalizedVersion(baseGuideId: string, teacherId: string) {
    const guide = await this.getGuideOrFail(baseGuideId);
    if (guide.status !== 'published') {
      throw new ConflictException(
        'Solo se puede personalizar una guía publicada',
      );
    }
    await this.assertTeacherCanAccessModule(guide.moduleId, teacherId);
    const now = new Date();
    const version = await this.personalizedVersions.save({
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
      fields: await this.resolveGuideFields(
        guide.moduleId,
        undefined,
        'teacher',
      ),
      createdAt: now,
      updatedAt: now,
    });
    return this.toPersonalizedVersion(version);
  }

  async findPersonalizedVersionsForTeacher(teacherId: string) {
    const versions = await this.personalizedVersions.findBy({ teacherId });
    return versions.map((version) => this.toPersonalizedVersion(version));
  }

  async findPersonalizedVersionForTeacher(id: string, teacherId: string) {
    const version = await this.getPersonalizedVersionOrFail(id);
    if (version.teacherId !== teacherId) {
      throw new ForbiddenException(
        'Solo puedes consultar tus propias versiones',
      );
    }
    return this.toPersonalizedVersion(version);
  }

  async updatePersonalizedVersion(
    id: string,
    teacherId: string,
    dto: UpdatePersonalizedGuideVersionDto,
  ) {
    const version = await this.getPersonalizedVersionOrFail(id);
    if (version.teacherId !== teacherId) {
      throw new ForbiddenException(
        'Solo puedes consultar tus propias versiones',
      );
    }
    if (dto.content === undefined || Object.keys(dto.content).length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para actualizar',
      );
    }
    const content = { ...version.content, ...dto.content };
    this.validateGuideContent(content, version.fields, false);
    version.content = content;
    version.updatedAt = new Date();
    return this.toPersonalizedVersion(
      await this.personalizedVersions.save(version),
    );
  }

  private async getModuleOrFail(id: string) {
    const module = await this.modules.findOneBy({ id });
    if (!module) throw new NotFoundException('Módulo no encontrado');
    return module;
  }

  private async getActiveModuleOrFail(id: string) {
    const module = await this.getModuleOrFail(id);
    if (!module.isActive) {
      throw new BadRequestException(
        'No se pueden crear guías para un módulo inactivo',
      );
    }
    return module;
  }

  private async getCompetencyRecordOrFail(id: string) {
    const competency = await this.competencies.findOneBy({ id });
    if (!competency) throw new NotFoundException('Competencia no encontrada');
    return competency;
  }

  private async getGuideOrFail(id: string) {
    const guide = await this.guides.findOneBy({ id });
    if (!guide) throw new NotFoundException('Guía no encontrada');
    return guide;
  }

  private async getPersonalizedVersionOrFail(id: string) {
    const version = await this.personalizedVersions.findOneBy({ id });
    if (!version) {
      throw new NotFoundException('Versión personalizada no encontrada');
    }
    return version;
  }

  private async assertTeacherCanAccessModule(
    moduleId: string,
    teacherId: string,
  ) {
    const assignment = await this.moduleTeacherAssignments.findOneBy({
      moduleId,
      teacherId,
    });
    if (!assignment) {
      throw new ForbiddenException('No tienes asignado este módulo');
    }
  }

  private async withCompetencies(module: AcademicModuleRecord) {
    const competencies =
      module.competencyIds.length === 0
        ? []
        : (
            await this.competencies.findBy({
              id: In(module.competencyIds),
            })
          ).map((competency) => this.toCompetency(competency));
    return {
      ...this.toModule(module),
      competencies,
    };
  }

  private async saveFieldConfig(config: GuideFieldConfig) {
    const current = await this.fieldConfigs.findOneBy({
      moduleId: config.moduleId,
      competencyId:
        config.competencyId === undefined ? IsNull() : config.competencyId,
      formType: config.formType,
    });
    const saved = await this.fieldConfigs.save({
      ...(current ? { id: current.id } : { id: randomUUID() }),
      moduleId: config.moduleId,
      competencyId: config.competencyId ?? null,
      formType: config.formType,
      fields: config.fields.map((field) => ({ ...field })),
    });
    return this.toFieldConfig(saved);
  }

  private async resolveGuideFields(
    moduleId: string,
    competencyId?: string,
    formType: GuideFormType = 'base',
  ) {
    if (formType === 'base' && competencyId !== undefined) {
      const competencyConfig = await this.fieldConfigs.findOneBy({
        moduleId,
        competencyId,
        formType,
      });
      if (competencyConfig) return competencyConfig.fields;
    }
    const moduleConfig = await this.fieldConfigs.findOneBy({
      moduleId,
      competencyId: IsNull(),
      formType,
    });
    return moduleConfig?.fields ?? [];
  }

  private toModule(record: AcademicModuleRecord): AcademicModule {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? undefined,
      isActive: record.isActive,
      competencyIds: record.competencyIds,
    };
  }

  private toCompetency(record: AcademicCompetencyRecord): Competency {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? undefined,
    };
  }

  private toFieldConfig(record: GuideFieldConfigRecord): GuideFieldConfig {
    return {
      moduleId: record.moduleId,
      competencyId: record.competencyId ?? undefined,
      formType: record.formType,
      fields: record.fields,
    };
  }

  private toGuide(record: AcademicGuideRecord): AcademicGuide {
    return {
      id: record.id,
      moduleId: record.moduleId,
      moduleName: record.moduleName,
      competencyId: record.competencyId ?? undefined,
      competencyName: record.competencyName ?? undefined,
      title: record.title,
      content: record.content,
      fields: record.fields,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      publishedAt: record.publishedAt?.toISOString(),
    };
  }

  private toGuideSupportMaterial(record: GuideSupportMaterialRecord) {
    return {
      id: record.id,
      guideId: record.guideId,
      fileName: record.fileName,
      contentType: record.contentType,
      size: record.size,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private async validateSupportMaterial(file: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }) {
    if (file.size > AcademicService.maxSupportMaterialSize) {
      throw new PayloadTooLargeException(
        'El material de apoyo no puede superar los 10 MB',
      );
    }
    const submittedName = file.originalname.split(/[\\/]/).pop() ?? '';
    const extension = submittedName.split('.').pop()?.toLowerCase();
    const fileName = Array.from(submittedName)
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 32 && codePoint !== 127;
      })
      .slice(0, 255)
      .join('');
    if (!fileName || (extension !== 'pdf' && extension !== 'docx')) {
      throw new UnsupportedMediaTypeException(
        'Solo se permiten archivos PDF o DOCX',
      );
    }

    if (extension === 'pdf') {
      if (
        file.mimetype !== 'application/pdf' ||
        file.buffer.subarray(0, 5).toString() !== '%PDF-'
      ) {
        throw new UnsupportedMediaTypeException(
          'El archivo no tiene un formato PDF válido',
        );
      }
      return { fileName, contentType: 'application/pdf' };
    }

    const docxContentType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (
      file.mimetype !== docxContentType ||
      file.buffer.subarray(0, 2).toString() !== 'PK'
    ) {
      throw new UnsupportedMediaTypeException(
        'El archivo no tiene un formato DOCX válido',
      );
    }
    try {
      const archive = await JSZip.loadAsync(file.buffer);
      if (!archive.file('word/document.xml')) {
        throw new Error('Missing Word document');
      }
    } catch {
      throw new UnsupportedMediaTypeException(
        'El archivo no contiene un documento DOCX válido',
      );
    }
    return { fileName, contentType: docxContentType };
  }

  private toPersonalizedVersion(
    record: PersonalizedGuideVersionRecord,
  ): PersonalizedGuideVersion {
    return {
      id: record.id,
      baseGuideId: record.baseGuideId,
      moduleId: record.moduleId,
      moduleName: record.moduleName,
      teacherId: record.teacherId,
      title: record.title,
      baseContent: record.baseContent,
      baseFields: record.baseFields,
      content: record.content,
      fields: record.fields,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
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
