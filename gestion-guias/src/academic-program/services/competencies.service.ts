import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../auth/current-user.decorator.js';
import { badRequest, conflict, notFound } from '../api-errors.js';
import {
  cleanText,
  formatCompetencyCode,
  normalizeForComparison,
} from '../curricular-codes.js';
import { toCompetencyView } from '../academic-program.views.js';
import { Competency } from '../entities/competency.entity.js';
import { CompetencyRevision } from '../entities/competency-revision.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../entities/curricular-module.entity.js';
import { GuideStatsProvider } from '../guide-stats.provider.js';
import { CompetencyTextDto } from '../dto/competency-text.dto.js';
import { CurricularModulesService } from './curricular-modules.service.js';

@Injectable()
export class CompetenciesService {
  constructor(
    @InjectRepository(Competency)
    private readonly competencies: Repository<Competency>,
    @InjectRepository(CompetencyRevision)
    private readonly revisions: Repository<CompetencyRevision>,
    private readonly modules: CurricularModulesService,
    private readonly guideStats: GuideStatsProvider,
    private readonly dataSource: DataSource,
  ) {}

  /** HE-02-HU-04: asociar una competencia nueva; el módulo admite varias simultáneamente. */
  async create(
    moduleId: string,
    dto: CompetencyTextDto,
    user: AuthenticatedUser,
  ) {
    const text = cleanText(dto.text);
    const normalizedText = normalizeForComparison(text);

    const competency = await this.dataSource.transaction(async (manager) => {
      const module = await this.lockEditableModule(manager, moduleId);
      await this.assertTextAvailable(manager, moduleId, normalizedText);

      const sequence = module.competencySequence + 1;
      await manager.update(CurricularModule, module.id, {
        competencySequence: sequence,
      });

      const saved = await manager.save(
        manager.create(Competency, {
          moduleId,
          code: formatCompetencyCode(module.competencyPrefix, sequence),
          sequence,
          text,
          normalizedText,
          version: 1,
          createdById: user.id,
          createdByName: user.name,
        }),
      );
      await this.saveRevision(manager, saved, user);
      return saved;
    });

    return toCompetencyView(competency);
  }

  /** Código que recibirá la próxima competencia del módulo (vista previa del formulario). */
  async previewNextCode(moduleId: string) {
    const module = await this.modules.getOrFail(moduleId);
    return {
      code: formatCompetencyCode(
        module.competencyPrefix,
        module.competencySequence + 1,
      ),
    };
  }

  async findByModule(moduleId: string) {
    await this.modules.getOrFail(moduleId);
    const competencies = await this.competencies.find({
      where: { moduleId },
      order: { sequence: 'ASC' },
    });
    const stats = await this.guideStats.getPublishedCountByCompetency(
      competencies.map((competency) => competency.id),
    );
    return competencies.map((competency) =>
      toCompetencyView(competency, stats.get(competency.id) ?? 0),
    );
  }

  async findOne(id: string) {
    const competency = await this.getOrFail(id);
    const module = await this.modules.getOrFail(competency.moduleId);
    const stats = await this.guideStats.getPublishedCountByCompetency([id]);
    return {
      ...toCompetencyView(competency, stats.get(id) ?? 0),
      module: {
        id: module.id,
        code: module.code,
        name: module.name,
        status: module.status,
      },
    };
  }

  /** HE-02-HU-05: editar solo el texto; código, módulo y demás competencias no cambian. */
  async update(id: string, dto: CompetencyTextDto, user: AuthenticatedUser) {
    const text = cleanText(dto.text);
    const normalizedText = normalizeForComparison(text);
    const { moduleId } = await this.getOrFail(id);

    const result = await this.dataSource.transaction(async (manager) => {
      await this.lockEditableModule(manager, moduleId);
      const competency = await manager.findOneBy(Competency, { id });
      if (!competency) throw notFound('NOT_FOUND', 'Competencia no encontrada');

      if (competency.text === text) {
        throw badRequest(
          'NO_CHANGES',
          'El texto de la competencia no presenta cambios',
        );
      }
      if (competency.normalizedText !== normalizedText) {
        await this.assertTextAvailable(manager, moduleId, normalizedText, id);
      }

      const previous = { text: competency.text, version: competency.version };
      competency.text = text;
      competency.normalizedText = normalizedText;
      competency.version += 1;
      competency.updatedById = user.id;
      competency.updatedByName = user.name;
      const saved = await manager.save(competency);
      await this.saveRevision(manager, saved, user);
      return { saved, previous };
    });

    const stats = await this.guideStats.getPublishedCountByCompetency([id]);
    return {
      ...toCompetencyView(result.saved, stats.get(id) ?? 0),
      previousText: result.previous.text,
      previousVersion: result.previous.version,
    };
  }

  /**
   * HE-02-HU-06: retira la competencia del módulo (borrado lógico). Las guías publicadas
   * conservan la versión que referenciaban y la competencia sigue consultable en el historial.
   */
  async remove(id: string, user: AuthenticatedUser) {
    const { moduleId } = await this.getOrFail(id);

    const module = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockEditableModule(manager, moduleId);
      const competency = await manager.findOneBy(Competency, { id });
      if (!competency) throw notFound('NOT_FOUND', 'Competencia no encontrada');

      await manager.update(Competency, id, {
        deletedById: user.id,
        deletedByName: user.name,
      });
      await manager.softDelete(Competency, id);
      return locked;
    });

    const [deleted, remainingActiveCompetencies, stats] = await Promise.all([
      this.competencies.findOneOrFail({ where: { id }, withDeleted: true }),
      this.competencies.countBy({ moduleId }),
      this.guideStats.getPublishedCountByCompetency([id]),
    ]);
    const publishedGuidesPreserved = stats.get(id) ?? 0;

    return {
      competency: toCompetencyView(deleted, publishedGuidesPreserved),
      module: { id: module.id, code: module.code, name: module.name },
      remainingActiveCompetencies,
      moduleAvailableForGuides: remainingActiveCompetencies > 0,
      publishedGuidesPreserved,
    };
  }

  /** Trazabilidad: todas las versiones del texto (incluye competencias eliminadas). */
  async getHistory(id: string) {
    const competency = await this.getOrFail(id, true);
    const revisions = await this.revisions.find({
      where: { competencyId: id },
      order: { version: 'ASC' },
    });
    return {
      competency: toCompetencyView(competency),
      revisions: revisions.map((revision) => this.toRevisionView(revision)),
    };
  }

  /**
   * Versión concreta de una competencia, aunque haya sido eliminada después.
   * Pensado para que las guías publicadas (HE-03) muestren la redacción con la que se publicaron.
   */
  async findVersion(id: string, version: number) {
    const competency = await this.getOrFail(id, true);
    const revision = await this.revisions.findOneBy({
      competencyId: id,
      version,
    });
    if (!revision)
      throw notFound('NOT_FOUND', 'Versión de competencia no encontrada');
    return {
      competencyId: competency.id,
      moduleId: competency.moduleId,
      code: competency.code,
      status: competency.deletedAt ? ('deleted' as const) : ('active' as const),
      isCurrentVersion: competency.version === version,
      ...this.toRevisionView(revision),
    };
  }

  private async getOrFail(
    id: string,
    withDeleted = false,
  ): Promise<Competency> {
    const competency = await this.competencies.findOne({
      where: { id },
      withDeleted,
    });
    if (!competency) throw notFound('NOT_FOUND', 'Competencia no encontrada');
    return competency;
  }

  /**
   * Bloquea la fila del módulo durante la transacción: serializa consecutivos, versiones y
   * control de duplicados entre operaciones simultáneas sobre el mismo módulo.
   */
  private async lockEditableModule(manager: EntityManager, moduleId: string) {
    const module = await manager.findOne(CurricularModule, {
      where: { id: moduleId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!module) throw notFound('NOT_FOUND', 'Módulo no encontrado');
    if (module.status === CurricularModuleStatus.DRAFT) {
      throw conflict(
        'MODULE_NOT_ACTIVE',
        'Registra el módulo antes de gestionar sus competencias',
      );
    }
    if (module.status === CurricularModuleStatus.INACTIVE) {
      throw conflict(
        'MODULE_NOT_ACTIVE',
        'El módulo está inhabilitado; habilítalo para gestionar sus competencias',
      );
    }
    return module;
  }

  private async assertTextAvailable(
    manager: EntityManager,
    moduleId: string,
    normalizedText: string,
    excludeId?: string,
  ) {
    const existing = await manager.findOneBy(Competency, {
      moduleId,
      normalizedText,
      ...(excludeId ? { id: Not(excludeId) } : {}),
    });
    if (!existing) return;
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'COMPETENCY_DUPLICATED',
      message: `El módulo ya tiene una competencia con ese texto (${existing.code})`,
      existingCompetency: { id: existing.id, code: existing.code },
    });
  }

  private saveRevision(
    manager: EntityManager,
    competency: Competency,
    user: AuthenticatedUser,
  ) {
    return manager.save(
      manager.create(CompetencyRevision, {
        competencyId: competency.id,
        version: competency.version,
        text: competency.text,
        editedById: user.id,
        editedByName: user.name,
      }),
    );
  }

  private toRevisionView(revision: CompetencyRevision) {
    return {
      version: revision.version,
      text: revision.text,
      editedBy: { id: revision.editedById, name: revision.editedByName },
      editedAt: revision.createdAt,
    };
  }
}
