import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../auth/current-user.decorator.js';
import { badRequest, conflict, notFound } from '../api-errors.js';
import {
  buildCompetencyPrefix,
  cleanText,
  ensureUniquePrefix,
  formatModuleCode,
  isUniqueViolation,
  normalizeForComparison,
} from '../curricular-codes.js';
import {
  toCompetencyView,
  toModuleAudit,
  toModuleView,
} from '../academic-program.views.js';
import { Competency } from '../entities/competency.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../entities/curricular-module.entity.js';
import { Program } from '../entities/program.entity.js';
import { GuideStatsProvider } from '../guide-stats.provider.js';
import { CreateCurricularModuleDto } from '../dto/create-curricular-module.dto.js';
import { UpdateCurricularModuleDto } from '../dto/update-curricular-module.dto.js';
import { DeactivateCurricularModuleDto } from '../dto/deactivate-curricular-module.dto.js';
import { ListCurricularModulesQuery } from '../dto/list-curricular-modules.query.js';
import { NameAvailabilityQuery } from '../dto/name-availability.query.js';
import { ProgramsService } from './programs.service.js';

const SORT_COLUMNS = {
  name: 'module.normalizedName',
  code: 'module.sequence',
  updatedAt: 'module.updatedAt',
} as const;

@Injectable()
export class CurricularModulesService {
  constructor(
    @InjectRepository(CurricularModule)
    private readonly modules: Repository<CurricularModule>,
    @InjectRepository(Competency)
    private readonly competencies: Repository<Competency>,
    private readonly programs: ProgramsService,
    private readonly guideStats: GuideStatsProvider,
    private readonly dataSource: DataSource,
  ) {}

  /** HE-02-HU-01: registrar un módulo (o guardarlo como borrador). */
  async create(
    programId: string,
    dto: CreateCurricularModuleDto,
    user: AuthenticatedUser,
  ) {
    const name = cleanText(dto.name);
    const normalizedName = normalizeForComparison(name);
    await this.programs.getOrFail(programId);
    await this.assertNameAvailable(programId, normalizedName);

    try {
      const created = await this.dataSource.transaction(async (manager) => {
        // Bloquea el programa para asignar consecutivo y sigla sin colisiones concurrentes.
        const program = await manager.findOne(Program, {
          where: { id: programId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!program)
          throw notFound('NOT_FOUND', 'Programa académico no encontrado');

        const siblings = await manager.find(CurricularModule, {
          where: { programId },
          select: { id: true, sequence: true, competencyPrefix: true },
        });
        const sequence =
          Math.max(0, ...siblings.map((module) => module.sequence)) + 1;

        return manager.save(
          manager.create(CurricularModule, {
            programId,
            code: formatModuleCode(program.code, sequence),
            sequence,
            name,
            normalizedName,
            description: dto.description?.trim() || null,
            status: dto.draft
              ? CurricularModuleStatus.DRAFT
              : CurricularModuleStatus.ACTIVE,
            competencyPrefix: ensureUniquePrefix(
              buildCompetencyPrefix(name),
              siblings.map((module) => module.competencyPrefix),
            ),
            competencySequence: 0,
            createdById: user.id,
            createdByName: user.name,
          }),
        );
      });
      return this.findOne(created.id);
    } catch (error) {
      // Otro registro simultáneo tomó el mismo nombre: responde con el 409 descriptivo.
      if (isUniqueViolation(error))
        await this.assertNameAvailable(programId, normalizedName);
      throw error;
    }
  }

  /** Validación en vivo del formulario ("Nombre disponible"). */
  async checkNameAvailability(programId: string, query: NameAvailabilityQuery) {
    await this.programs.getOrFail(programId);
    const existing = await this.findByNormalizedName(
      programId,
      normalizeForComparison(query.name),
      query.excludeModuleId,
    );
    return {
      available: existing === null,
      existingModule: existing && (await this.toListItems([existing]))[0],
    };
  }

  /** Listado con búsqueda por nombre/código, filtro por estado y orden. */
  async findAll(programId: string, query: ListCurricularModulesQuery) {
    await this.programs.getOrFail(programId);
    const onlyAvailable = query.availableForGuides === 'true';

    const builder = this.modules
      .createQueryBuilder('module')
      .where('module.programId = :programId', { programId });

    const status = onlyAvailable ? CurricularModuleStatus.ACTIVE : query.status;
    if (status) builder.andWhere('module.status = :status', { status });

    const search = query.search?.trim();
    if (search) {
      builder
        .andWhere(
          new Brackets((where) =>
            where
              .where('module.name ILIKE :search')
              .orWhere('module.code ILIKE :search'),
          ),
        )
        .setParameter('search', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
    }

    builder.orderBy(
      SORT_COLUMNS[query.sort ?? 'name'],
      (query.order ?? 'asc').toUpperCase() as 'ASC' | 'DESC',
    );

    const items = await this.toListItems(await builder.getMany());
    return onlyAvailable
      ? items.filter((item) => item.availableForGuides)
      : items;
  }

  /** Detalle del módulo con sus competencias activas y resumen curricular. */
  async findOne(id: string) {
    const module = await this.getOrFail(id);
    const program = await this.programs.getOrFail(module.programId);
    const allCompetencies = await this.competencies.find({
      where: { moduleId: id },
      withDeleted: true,
      order: { sequence: 'ASC' },
    });
    const competencies = allCompetencies.filter(
      (competency) => competency.deletedAt === null,
    );

    const [moduleStats, competencyStats] = await Promise.all([
      this.guideStats.getModuleStats([id]),
      this.guideStats.getPublishedCountByCompetency(
        competencies.map((competency) => competency.id),
      ),
    ]);
    const guides = moduleStats.get(id) ?? { total: 0, published: 0 };

    const timestamps = [
      module.updatedAt,
      ...allCompetencies.flatMap((competency) => [
        competency.updatedAt,
        competency.deletedAt,
      ]),
    ].filter((date): date is Date => date !== null);
    const lastUpdatedAt = new Date(
      Math.max(...timestamps.map((date) => date.getTime())),
    );

    return {
      ...toModuleView(module, competencies.length, guides),
      program: { id: program.id, code: program.code, name: program.name },
      audit: toModuleAudit(module),
      competencies: competencies.map((competency) =>
        toCompetencyView(competency, competencyStats.get(competency.id) ?? 0),
      ),
      summary: {
        activeCompetencies: competencies.length,
        publishedGuides: guides.published,
        lastUpdatedAt,
      },
    };
  }

  /** HE-02-HU-02: editar nombre y/o descripción sin alterar competencias ni guías. */
  async update(
    id: string,
    dto: UpdateCurricularModuleDto,
    user: AuthenticatedUser,
  ) {
    if (dto.name === undefined && dto.description === undefined) {
      throw badRequest(
        'NOTHING_TO_UPDATE',
        'Debe proporcionar al menos un dato para actualizar',
      );
    }
    const module = await this.getOrFail(id);

    if (dto.name !== undefined) {
      const name = cleanText(dto.name);
      const normalizedName = normalizeForComparison(name);
      if (normalizedName !== module.normalizedName) {
        await this.assertNameAvailable(module.programId, normalizedName, id);
      }
      module.name = name;
      module.normalizedName = normalizedName;
    }
    if (dto.description !== undefined)
      module.description = dto.description.trim();
    module.updatedById = user.id;
    module.updatedByName = user.name;

    try {
      await this.modules.save(module);
    } catch (error) {
      if (isUniqueViolation(error)) {
        await this.assertNameAvailable(
          module.programId,
          module.normalizedName,
          id,
        );
      }
      throw error;
    }
    return this.findOne(id);
  }

  /** Pasa un borrador a módulo activo ("Registrar módulo" desde un borrador). */
  async register(id: string, user: AuthenticatedUser) {
    const module = await this.getOrFail(id);
    if (module.status !== CurricularModuleStatus.DRAFT) {
      throw conflict(
        'INVALID_STATUS',
        'Solo los módulos en borrador pueden registrarse',
      );
    }
    if (!module.description?.trim()) {
      throw badRequest(
        'DESCRIPTION_REQUIRED',
        'La descripción es obligatoria para registrar el módulo',
      );
    }
    module.status = CurricularModuleStatus.ACTIVE;
    module.updatedById = user.id;
    module.updatedByName = user.name;
    await this.modules.save(module);
    return this.findOne(id);
  }

  /**
   * HE-02-HU-03: inhabilitar sin borrado físico. El módulo deja de estar disponible
   * para nuevas guías y conserva competencias, guías existentes y auditoría.
   */
  async deactivate(
    id: string,
    dto: DeactivateCurricularModuleDto,
    user: AuthenticatedUser,
  ) {
    const module = await this.getOrFail(id);
    if (module.status === CurricularModuleStatus.INACTIVE) {
      throw conflict('INVALID_STATUS', 'El módulo ya está inhabilitado');
    }
    if (module.status === CurricularModuleStatus.DRAFT) {
      throw conflict(
        'INVALID_STATUS',
        'Un módulo en borrador no se puede inhabilitar',
      );
    }
    module.status = CurricularModuleStatus.INACTIVE;
    module.inactivatedAt = new Date();
    module.inactivatedById = user.id;
    module.inactivatedByName = user.name;
    module.inactivationReason = dto.reason?.trim() || null;
    module.updatedById = user.id;
    module.updatedByName = user.name;
    await this.modules.save(module);
    return this.findOne(id);
  }

  /** La inhabilitación es reversible. */
  async reactivate(id: string, user: AuthenticatedUser) {
    const module = await this.getOrFail(id);
    if (module.status !== CurricularModuleStatus.INACTIVE) {
      throw conflict(
        'INVALID_STATUS',
        'Solo los módulos inhabilitados pueden habilitarse',
      );
    }
    module.status = CurricularModuleStatus.ACTIVE;
    module.inactivatedAt = null;
    module.inactivatedById = null;
    module.inactivatedByName = null;
    module.inactivationReason = null;
    module.updatedById = user.id;
    module.updatedByName = user.name;
    await this.modules.save(module);
    return this.findOne(id);
  }

  /**
   * Regla para el componente de guías (HE-03): solo se crean guías nuevas sobre
   * módulos activos que tengan al menos una competencia activa.
   */
  async assertAvailableForGuides(id: string): Promise<CurricularModule> {
    const module = await this.getOrFail(id);
    if (module.status !== CurricularModuleStatus.ACTIVE) {
      throw badRequest(
        'MODULE_NOT_ACTIVE',
        'El módulo no está disponible para crear nuevas guías',
      );
    }
    if ((await this.competencies.countBy({ moduleId: id })) === 0) {
      throw badRequest(
        'MODULE_WITHOUT_COMPETENCIES',
        'El módulo debe tener al menos una competencia activa para crear guías',
      );
    }
    return module;
  }

  async getOrFail(id: string): Promise<CurricularModule> {
    const module = await this.modules.findOneBy({ id });
    if (!module) throw notFound('NOT_FOUND', 'Módulo no encontrado');
    return module;
  }

  private findByNormalizedName(
    programId: string,
    normalizedName: string,
    excludeId?: string,
  ) {
    const builder = this.modules
      .createQueryBuilder('module')
      .where('module.programId = :programId', { programId })
      .andWhere('module.normalizedName = :normalizedName', { normalizedName });
    if (excludeId) builder.andWhere('module.id != :excludeId', { excludeId });
    return builder.getOne();
  }

  /** HE-02-HU-01 CA-02: impide duplicados y devuelve el módulo existente para "Ver módulo". */
  private async assertNameAvailable(
    programId: string,
    normalizedName: string,
    excludeId?: string,
  ) {
    const existing = await this.findByNormalizedName(
      programId,
      normalizedName,
      excludeId,
    );
    if (!existing) return;
    const [existingModule] = await this.toListItems([existing]);
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'MODULE_NAME_DUPLICATED',
      message: `Ya existe "${existing.name}" en el programa. Los nombres de módulo deben ser únicos.`,
      existingModule,
    });
  }

  private async toListItems(modules: CurricularModule[]) {
    const ids = modules.map((module) => module.id);
    const [competencyCounts, guideStats] = await Promise.all([
      this.countActiveCompetencies(ids),
      this.guideStats.getModuleStats(ids),
    ]);
    return modules.map((module) =>
      toModuleView(
        module,
        competencyCounts.get(module.id) ?? 0,
        guideStats.get(module.id),
      ),
    );
  }

  private async countActiveCompetencies(
    moduleIds: string[],
  ): Promise<Map<string, number>> {
    if (moduleIds.length === 0) return new Map();
    const rows = await this.competencies
      .createQueryBuilder('competency')
      .select('competency.moduleId', 'moduleId')
      .addSelect('COUNT(*)', 'count')
      .where('competency.moduleId IN (:...moduleIds)', { moduleIds })
      .groupBy('competency.moduleId')
      .getRawMany<{ moduleId: string; count: string }>();
    return new Map(rows.map((row) => [row.moduleId, Number(row.count)]));
  }
}
