import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { notFound } from '../api-errors.js';
import { Program } from '../entities/program.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../entities/curricular-module.entity.js';
import { Competency } from '../entities/competency.entity.js';
import { CompetencyRevision } from '../entities/competency-revision.entity.js';
import { GuideStatsProvider } from '../guide-stats.provider.js';
import {
  ensureUniquePrefix,
  formatCompetencyCode,
  formatModuleCode,
  normalizeForComparison,
} from '../curricular-codes.js';
import { DEFAULT_CURRICULUM } from '../default-curriculum.js';

const SEED_ACTOR_ID = 'system-curriculum-seed';
const SEED_ACTOR_NAME = 'Carga curricular inicial';

/** Programa con el que arranca el sistema (único programa del alcance actual). */
export const DEFAULT_PROGRAM = {
  code: 'TS',
  name: 'Técnico en Sistemas',
  campus: 'Sede Piendamó',
  cohort: 2026,
} as const;

@Injectable()
export class ProgramsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Program) private readonly programs: Repository<Program>,
    @InjectRepository(CurricularModule)
    private readonly modules: Repository<CurricularModule>,
    private readonly guideStats: GuideStatsProvider,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    const program = await this.ensureDefaultProgram();
    await this.ensureDefaultCurriculum(program.id);
  }

  async ensureDefaultProgram(): Promise<Program> {
    const existing = await this.programs.findOneBy({
      code: DEFAULT_PROGRAM.code,
    });
    if (existing) return existing;
    await this.programs
      .createQueryBuilder()
      .insert()
      .values({ ...DEFAULT_PROGRAM, isActive: true })
      .orIgnore()
      .execute();
    return this.programs.findOneByOrFail({ code: DEFAULT_PROGRAM.code });
  }

  private async ensureDefaultCurriculum(programId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const program = await manager.findOne(Program, {
        where: { id: programId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!program)
        throw notFound('NOT_FOUND', 'Programa académico no encontrado');

      const modules = await manager.find(CurricularModule, {
        where: { programId },
      });
      let nextModuleSequence = Math.max(
        0,
        ...modules.map((module) => module.sequence),
      );

      for (const seed of DEFAULT_CURRICULUM) {
        const normalizedName = normalizeForComparison(seed.name);
        let module = modules.find(
          (candidate) => candidate.normalizedName === normalizedName,
        );

        if (!module) {
          const sequence = ++nextModuleSequence;
          const competencyPrefix = ensureUniquePrefix(
            seed.prefix,
            modules.map((candidate) => candidate.competencyPrefix),
          );
          module = await manager.save(
            manager.create(CurricularModule, {
              programId,
              code: formatModuleCode(program.code, sequence),
              sequence,
              name: seed.name,
              normalizedName,
              description: seed.description,
              status: CurricularModuleStatus.ACTIVE,
              competencyPrefix,
              competencySequence: 0,
              createdById: SEED_ACTOR_ID,
              createdByName: SEED_ACTOR_NAME,
            }),
          );
          modules.push(module);
        }

        const competencies = await manager.find(Competency, {
          where: { moduleId: module.id },
          withDeleted: true,
        });
        let nextCompetencySequence = Math.max(
          module.competencySequence,
          0,
          ...competencies.map((competency) => competency.sequence),
        );

        for (const text of seed.competencies) {
          const normalizedText = normalizeForComparison(text);
          if (
            competencies.some(
              (competency) => competency.normalizedText === normalizedText,
            )
          ) {
            continue;
          }

          const sequence = ++nextCompetencySequence;
          const competency = await manager.save(
            manager.create(Competency, {
              moduleId: module.id,
              code: formatCompetencyCode(module.competencyPrefix, sequence),
              sequence,
              text,
              normalizedText,
              version: 1,
              createdById: SEED_ACTOR_ID,
              createdByName: SEED_ACTOR_NAME,
            }),
          );
          await manager.save(
            manager.create(CompetencyRevision, {
              competencyId: competency.id,
              version: 1,
              text,
              editedById: SEED_ACTOR_ID,
              editedByName: SEED_ACTOR_NAME,
            }),
          );
          competencies.push(competency);
        }

        if (module.competencySequence !== nextCompetencySequence) {
          module.competencySequence = nextCompetencySequence;
          await manager.save(module);
        }
      }
    });
  }

  findAll() {
    return this.programs.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getOrFail(id: string): Promise<Program> {
    const program = await this.programs.findOneBy({ id });
    if (!program)
      throw notFound('NOT_FOUND', 'Programa académico no encontrado');
    return program;
  }

  /** Datos de las tarjetas superiores del listado "Programa académico". */
  async getSummary(id: string) {
    const program = await this.getOrFail(id);
    const modules = await this.modules.find({
      where: { programId: id },
      select: { id: true, status: true },
    });
    const countByStatus = (status: CurricularModuleStatus) =>
      modules.filter((module) => module.status === status).length;

    const guideStats = await this.guideStats.getModuleStats(
      modules.map((module) => module.id),
    );
    let totalGuides = 0;
    let publishedGuides = 0;
    for (const stats of guideStats.values()) {
      totalGuides += stats.total;
      publishedGuides += stats.published;
    }

    return {
      program,
      curriculumPlan: { status: 'vigente', cohort: program.cohort },
      modules: {
        total: modules.length,
        active: countByStatus(CurricularModuleStatus.ACTIVE),
        inactive: countByStatus(CurricularModuleStatus.INACTIVE),
        draft: countByStatus(CurricularModuleStatus.DRAFT),
      },
      guides: { total: totalGuides, published: publishedGuides },
    };
  }
}
