import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program } from '../entities/program.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../entities/curricular-module.entity.js';
import { GuideStatsProvider } from '../guide-stats.provider.js';

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
  ) {}

  async onApplicationBootstrap() {
    await this.ensureDefaultProgram();
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

  findAll() {
    return this.programs.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getOrFail(id: string): Promise<Program> {
    const program = await this.programs.findOneBy({ id });
    if (!program)
      throw new NotFoundException('Programa académico no encontrado');
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
